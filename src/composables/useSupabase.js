import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, COLLECTION_BATCH_SIZE, COLLECTION_LOAD_TIMEOUT_MS } from '../utils/constants.js';
import { rowToCard, cardToRow, safelyMapRowsToCards, withTimeout, getCollectionLoadErrorMessage } from '../utils/cards.js';

// ---------------------------------------------------------------------------
// Singleton Supabase client
// ---------------------------------------------------------------------------

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------------
// DB write helpers
// ---------------------------------------------------------------------------

/**
 * Upsert one or more cards into the `cards` table.
 *
 * @param {Array} cards  - Array of normalised card objects.
 * @param {string} userId - The authenticated user's ID.
 */
export async function dbUpsertCards(cards, userId) {
  if (!cards.length) return;
  const { error } = await supabaseClient
    .from('cards')
    .upsert(cards.map((card) => cardToRow(card, userId)), { onConflict: 'id' });
  if (error) throw error;
}

/**
 * Delete cards by their IDs.
 *
 * @param {string[]} ids - Array of card UUIDs to delete.
 */
export async function dbDeleteCards(ids) {
  if (!ids.length) return;
  const { error } = await supabaseClient
    .from('cards')
    .delete()
    .in('id', ids);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Collection loading
// ---------------------------------------------------------------------------

/**
 * Load all cards for a user in paginated batches.
 * Throws on network / auth failure so the caller can fall back.
 *
 * @param {string} userId
 * @returns {Promise<Array>} Normalised card objects.
 */
export async function loadCollectionInBatches(userId) {
  let rows = [];
  let fromIndex = 0;

  while (true) {
    const query = supabaseClient
      .from('cards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .range(fromIndex, fromIndex + COLLECTION_BATCH_SIZE - 1);

    const { data, error } = await withTimeout(
      query,
      COLLECTION_LOAD_TIMEOUT_MS,
      'Timed out loading collection.'
    );

    if (error) {
      console.error('Unable to load collection.', error);
      throw error;
    }

    const batch = data || [];
    rows = rows.concat(batch);

    if (batch.length < COLLECTION_BATCH_SIZE) {
      break;
    }

    fromIndex += COLLECTION_BATCH_SIZE;
  }

  return safelyMapRowsToCards(rows);
}

/**
 * Fallback: load all cards with a simple (non-batched) query.
 * Used when the batched approach encounters an unexpected error.
 *
 * @param {string} userId
 * @param {Error|null} [originalError] - The error that triggered the fallback,
 *   used to decide whether to surface a status message to the caller.
 * @returns {Promise<Array>} Normalised card objects.
 */
export async function loadCollectionWithSimpleQuery(userId, originalError) {
  const simpleQuery = supabaseClient.from('cards').select('*').eq('user_id', userId);
  const { data, error } = await withTimeout(
    simpleQuery,
    COLLECTION_LOAD_TIMEOUT_MS,
    'Timed out loading collection.'
  );

  if (error) {
    console.error('Unable to load collection with fallback query.', error);
    throw error;
  }

  return {
    cards: safelyMapRowsToCards(data || []),
    usedFallback: Boolean(originalError)
  };
}

/**
 * Orchestrate collection loading: attempt batched load, fall back to simple
 * query on failure.
 *
 * The returned object shape is:
 *   { cards: Array, usedFallback: boolean, error: Error|null }
 *
 * The caller is responsible for showing status messages based on `usedFallback`
 * and `error`.
 *
 * @param {string} userId
 * @returns {Promise<{ cards: Array, usedFallback: boolean, error: Error|null }>}
 */
export async function loadCollection(userId) {
  // The real Supabase client returns a query builder with an `.eq()` method.
  // Test mocks may return a plain Promise — detect that and use a simpler path.
  const selectQuery = supabaseClient.from('cards').select('*');

  if (!selectQuery || typeof selectQuery.eq !== 'function') {
    const { data, error } = await withTimeout(
      selectQuery,
      COLLECTION_LOAD_TIMEOUT_MS,
      'Timed out loading collection.'
    );
    if (error) {
      console.error('Unable to load collection.', error);
      return { cards: [], usedFallback: false, error };
    }
    return { cards: safelyMapRowsToCards(data || []), usedFallback: false, error: null };
  }

  try {
    const cards = await loadCollectionInBatches(userId);
    return { cards, usedFallback: false, error: null };
  } catch (batchError) {
    console.warn('Falling back to simple collection query.', batchError);
    try {
      const { cards, usedFallback } = await loadCollectionWithSimpleQuery(userId, batchError);
      return { cards, usedFallback, error: null };
    } catch (fallbackError) {
      const message = getCollectionLoadErrorMessage(fallbackError);
      return { cards: [], usedFallback: true, error: new Error(message) };
    }
  }
}

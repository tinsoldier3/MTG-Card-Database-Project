<script setup>
import { ref, computed } from 'vue'
import { useCollectionStore } from '../store/collection.js'
import { COMMANDER_DECKS } from '../utils/constants.js'
import {
  normalizeDeckName, getDeckDisplayLabel, isBoxOrBinder,
  normalizeStoredCard, createStoredCard, applyCardPrinting,
  parseDeckFileText, consolidateImportIdentifiers, findCollectionMatchIndex
} from '../utils/cards.js'
import { fetchNamedCard, fetchCardsByIdentifiers } from '../composables/useScryfall.js'
import { supabaseClient } from '../composables/useSupabase.js'

const props = defineProps({
  search: { type: String, default: '' },
  sort:   { type: String, default: 'name' }
})
const emit = defineEmits(['update:search', 'update:sort'])

const store = useCollectionStore()

// ── Add card form ──────────────────────────────────────────────────────────
const cardNameInput = ref('')
const quantityInput = ref(1)
const foilInput     = ref(false)
const deckNameInput = ref('')
const addLoading    = ref(false)

// ── Import form ────────────────────────────────────────────────────────────
const fileInput            = ref(null)
const importDeckNameInput  = ref('')
const collectionFileInput  = ref(null)

// ── All deck names for datalists ───────────────────────────────────────────
const allDeckNames = computed(() => {
  const names = Array.from(new Set(
    store.collection.map(c => normalizeDeckName(c.deck || 'unsorted'))
  ))
  Object.keys(COMMANDER_DECKS).forEach(n => { if (!names.includes(n)) names.push(n) })
  return names.sort((a, b) => getDeckDisplayLabel(a).localeCompare(getDeckDisplayLabel(b)))
})

// ── Add card ───────────────────────────────────────────────────────────────
async function addCard() {
  const name = cardNameInput.value.trim()
  if (!name) { store.showStatusMessage('Please type a card name first.'); return }

  const deckName = normalizeDeckName(deckNameInput.value || 'unsorted')
  const quantity = Math.max(1, parseInt(quantityInput.value, 10) || 1)
  const foil     = foilInput.value

  addLoading.value = true
  try {
    const card = await fetchNamedCard(name)

    const existingIndex = store.collection.findIndex(c =>
      normalizeDeckName(c.deck || 'unsorted') === deckName &&
      c.name === card.name &&
      c.foil === foil
    )

    if (existingIndex !== -1) {
      const prev = store.collection[existingIndex]
      const updated = { ...prev, quantity: (prev.quantity || 1) + quantity }
      store.collection[existingIndex] = updated
      store.showStatusMessage(`${quantity}x ${card.name} added (now ${updated.quantity} total).`)
      try {
        await store.dbUpsertCards([updated])
      } catch (err) {
        store.collection[existingIndex] = prev
        store.showStatusMessage(`Could not add ${card.name}. Please try again.`)
      }
    } else {
      const newCard = createStoredCard(card, { deck: deckName, foil, quantity })
      store.collection.push(newCard)
      store.showStatusMessage(`${quantity}x ${card.name} added to ${getDeckDisplayLabel(deckName)}.`)
      try {
        await store.dbUpsertCards([newCard])
      } catch (err) {
        const idx = store.collection.findIndex(c => c.id === newCard.id)
        if (idx !== -1) store.collection.splice(idx, 1)
        store.showStatusMessage(`Could not add ${card.name}. Please try again.`)
      }
    }

    cardNameInput.value = ''
    quantityInput.value = 1
    foilInput.value = false
  } catch (err) {
    store.showStatusMessage(err.message || 'Card not found.')
  } finally {
    addLoading.value = false
  }
}

// ── Import deck ────────────────────────────────────────────────────────────
async function importDeck(mode) {
  const deckName = normalizeDeckName(importDeckNameInput.value)
  if (!deckName) { store.showStatusMessage('Please enter a deck name before importing.'); return }

  const file = fileInput.value?.files?.[0]
  if (!file) { store.showStatusMessage('Please select a .txt deck file first.'); return }

  const text = await file.text()
  const identifiers = consolidateImportIdentifiers(parseDeckFileText(text))
  if (identifiers.length === 0) { store.showStatusMessage('No card lines found in that file.'); return }

  store.showProgress(`Importing ${identifiers.length} cards…`)

  try {
    const result = await fetchCardsByIdentifiers(identifiers, (pct, label) => {
      store.updateProgress(pct)
      store.progress.label = label
    })

    if (mode === 'replace') {
      const idsToDelete = store.collection
        .filter(c => normalizeDeckName(c.deck || 'unsorted') === deckName)
        .map(c => c.id)
      await store.dbDeleteCards(idsToDelete)
      store.collection = store.collection.filter(
        c => normalizeDeckName(c.deck || 'unsorted') !== deckName
      )
    }

    const toUpsert = []
    let addedCount = 0, updatedCount = 0

    result.allCards.forEach(entry => {
      const newCard = createStoredCard(entry.card, {
        deck: deckName,
        foil: entry.identifier?.foil ?? false,
        set: entry.identifier?.set ?? '',
        collectorNumber: entry.identifier?.collector_number ?? '',
        quantity: entry.identifier?.quantity ?? 1
      })

      if (mode === 'merge') {
        const existingIndex = store.collection.findIndex(c =>
          normalizeDeckName(c.deck || 'unsorted') === deckName &&
          c.name === newCard.name &&
          c.foil === newCard.foil
        )
        if (existingIndex !== -1) {
          const existing = store.collection[existingIndex]
          const mergedQty = Math.max(existing.quantity || 1, newCard.quantity || 1)
          const updated = { ...newCard, id: existing.id, quantity: mergedQty }
          store.collection[existingIndex] = updated
          toUpsert.push(updated)
          updatedCount++
        } else {
          store.collection.push(newCard)
          toUpsert.push(newCard)
          addedCount++
        }
      } else {
        store.collection.push(newCard)
        toUpsert.push(newCard)
        addedCount++
      }
    })

    await store.dbUpsertCards(toUpsert)

    const parts = []
    if (addedCount)            parts.push(`${addedCount} added`)
    if (updatedCount)          parts.push(`${updatedCount} updated`)
    if (result.notFound.length) parts.push(`${result.notFound.length} not found`)
    store.progress.label = 'Import complete — ' + (parts.join(', ') || 'nothing changed')
    store.updateProgress(100)
    store.showStatusMessage(`${result.allCards.length} cards imported to ${getDeckDisplayLabel(deckName)}.`)
    if (fileInput.value) fileInput.value.value = ''
  } catch (err) {
    console.error('Import failed', err)
    store.showStatusMessage('Deck import failed. Please try again.')
  }

  setTimeout(() => store.hideProgress(), 3000)
}

// ── Repair prints ──────────────────────────────────────────────────────────
async function repairDeckPrints() {
  const deckName = normalizeDeckName(importDeckNameInput.value)
  if (!deckName) { store.showStatusMessage('Please enter a deck name before repairing.'); return }

  const file = fileInput.value?.files?.[0]
  if (!file) { store.showStatusMessage('Please select the deck .txt file first.'); return }

  const deckCards = store.collection
    .map((card, index) => ({ card, index, matched: false }))
    .filter(e => normalizeDeckName(e.card.deck || 'unsorted') === deckName)

  if (deckCards.length === 0) { store.showStatusMessage('No saved cards in that deck yet.'); return }

  const text = await file.text()
  const identifiers = parseDeckFileText(text)
  if (identifiers.length === 0) { store.showStatusMessage('No card lines found in that file.'); return }

  store.showProgress(`Repairing prints for ${deckName}…`)

  try {
    const result = await fetchCardsByIdentifiers(identifiers, (pct, label) => {
      store.updateProgress(pct)
      store.progress.label = label
    })

    const toUpsert = []
    let updatedCount = 0

    result.allCards.forEach(entry => {
      if (!entry.identifier) return
      const matchIndex = findCollectionMatchIndex(deckCards, entry.identifier)
      if (matchIndex < 0) return
      const match = deckCards[matchIndex]
      const updatedCard = applyCardPrinting(match.card, entry.card, {
        deck: deckName,
        foil: entry.identifier.foil,
        set: entry.identifier.set,
        collectorNumber: entry.identifier.collector_number
      })
      store.collection[match.index] = updatedCard
      toUpsert.push(updatedCard)
      updatedCount++
    })

    await store.dbUpsertCards(toUpsert)
    store.progress.label = `Repair complete! Updated ${updatedCount} cards in ${getDeckDisplayLabel(deckName)}.`
    store.updateProgress(100)
    store.showStatusMessage(`Updated ${updatedCount} cards to their intended printings.`)
  } catch (err) {
    console.error('Repair failed', err)
    store.showStatusMessage('Repairing deck prints failed. Please try again.')
  }

  setTimeout(() => store.hideProgress(), 3000)
}

// ── Export collection ──────────────────────────────────────────────────────
function exportCollection() {
  const payload = {
    exportedAt: new Date().toISOString(),
    cardCount: store.collection.length,
    collection: store.collection
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `mtg-collection-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  store.showStatusMessage('Collection exported as a JSON backup.')
}

// ── Import backup ──────────────────────────────────────────────────────────
async function importBackup() {
  const file = collectionFileInput.value?.files?.[0]
  if (!file) { store.showStatusMessage('Please choose a JSON backup file first.'); return }

  try {
    const text = await file.text()
    const parsed = JSON.parse(text)
    const importedCards = Array.isArray(parsed) ? parsed : parsed.collection
    if (!Array.isArray(importedCards)) throw new Error('Invalid backup format.')

    const normalizedCards = importedCards.map(normalizeStoredCard)
    const { error: delErr } = await supabaseClient
      .from('cards').delete().eq('user_id', store.currentUserId)
    if (delErr) throw delErr
    await store.dbUpsertCards(normalizedCards)
    store.collection = normalizedCards
    if (collectionFileInput.value) collectionFileInput.value.value = ''
    store.showStatusMessage('Collection backup imported successfully.')
  } catch (err) {
    console.error('Backup import failed', err)
    store.showStatusMessage('That JSON backup could not be imported.')
  }
}
</script>

<template>
  <div class="controls-panel">

    <!-- ── Search & Sort ────────────────────────────────────────── -->
    <div class="controls-row">
      <input
        type="search"
        class="search-input"
        placeholder="Search cards, types, decks…"
        :value="props.search"
        @input="emit('update:search', $event.target.value)"
        aria-label="Search collection"
      />
      <select
        :value="props.sort"
        @change="emit('update:sort', $event.target.value)"
        aria-label="Sort order"
      >
        <option value="name">Sort: Name</option>
        <option value="type">Sort: Type</option>
        <option value="color">Sort: Color</option>
        <option value="set">Sort: Set</option>
        <option value="collector">Sort: Collector #</option>
      </select>
    </div>

    <!-- ── Add Cards ─────────────────────────────────────────────── -->
    <details class="controls-section" open>
      <summary class="controls-section-title">Add Cards</summary>
      <div class="controls-section-body">
        <div class="field-row">
          <div class="field-group" style="flex:2">
            <label>Card name</label>
            <input
              v-model="cardNameInput"
              type="text"
              placeholder="e.g. Sol Ring"
              @keydown.enter="addCard"
              autocomplete="off"
            />
          </div>
          <div class="field-group" style="flex:1">
            <label>Quantity</label>
            <input v-model.number="quantityInput" type="number" min="1" style="width:70px" />
          </div>
          <div class="field-group" style="align-self:flex-end">
            <label>
              <input v-model="foilInput" type="checkbox" />
              Foil
            </label>
          </div>
        </div>
        <div class="field-row">
          <div class="field-group" style="flex:2">
            <label>Deck / Location</label>
            <input
              v-model="deckNameInput"
              type="text"
              list="add-deck-options"
              placeholder="e.g. atraxa or unsorted"
              autocomplete="off"
            />
            <datalist id="add-deck-options">
              <option v-for="dn in allDeckNames" :key="dn" :value="dn" />
            </datalist>
          </div>
          <div class="field-group" style="align-self:flex-end">
            <button
              type="button"
              @click="addCard"
              :disabled="addLoading"
              class="primary-btn"
            >{{ addLoading ? 'Looking up…' : 'Add card' }}</button>
          </div>
        </div>
      </div>
    </details>

    <!-- ── Import & Export ───────────────────────────────────────── -->
    <details class="controls-section">
      <summary class="controls-section-title">Import &amp; Export</summary>
      <div class="controls-section-body">

        <!-- Deck import -->
        <div class="subsection">
          <p class="subsection-label">Import deck from .txt file</p>
          <div class="field-row">
            <div class="field-group" style="flex:2">
              <label>Deck name</label>
              <input
                v-model="importDeckNameInput"
                type="text"
                list="import-deck-options"
                placeholder="e.g. atraxa"
                autocomplete="off"
              />
              <datalist id="import-deck-options">
                <option v-for="dn in allDeckNames" :key="dn" :value="dn" />
              </datalist>
            </div>
            <div class="field-group" style="flex:2">
              <label>Deck file (.txt)</label>
              <input ref="fileInput" type="file" accept=".txt" />
            </div>
          </div>
          <div class="button-row">
            <button type="button" @click="importDeck('replace')">Replace</button>
            <button type="button" @click="importDeck('merge')">Merge</button>
            <button type="button" @click="repairDeckPrints">Repair Prints</button>
          </div>
        </div>

        <!-- Collection backup -->
        <div class="subsection">
          <p class="subsection-label">Collection backup</p>
          <div class="button-row">
            <button type="button" @click="exportCollection" class="primary-btn">Export collection</button>
          </div>
          <div class="field-row" style="margin-top:8px; align-items:flex-end">
            <div class="field-group" style="flex:2">
              <label>Import backup (.json)</label>
              <input ref="collectionFileInput" type="file" accept=".json" />
            </div>
            <div class="field-group" style="align-self:flex-end">
              <button type="button" @click="importBackup">Import backup</button>
            </div>
          </div>
        </div>

      </div>
    </details>

  </div>
</template>

<style scoped>
.controls-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.controls-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 180px;
}

.controls-section {
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.controls-section-title {
  padding: 10px 14px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  background: var(--panel);
  color: var(--text);
  list-style: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

.controls-section-title::before {
  content: '▶';
  font-size: 10px;
  transition: transform 0.15s;
}

details[open] .controls-section-title::before {
  transform: rotate(90deg);
}

.controls-section-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--bg);
  border-top: 1px solid var(--border);
}

.field-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: flex-start;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 120px;
}

.field-group label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.65;
  color: var(--text);
}

.subsection {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 6px;
}

.subsection + .subsection {
  border-top: 1px solid var(--border);
  padding-top: 14px;
  margin-top: 4px;
}

.subsection-label {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  opacity: 0.8;
  color: var(--text);
}

.button-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.primary-btn {
  font-weight: 600;
}
</style>

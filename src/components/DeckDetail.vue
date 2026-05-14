<template>
  <div>
    <a href="#decks" class="deck-detail-back">&larr; All Decks</a>

    <div class="deck-detail-layout">
      <!-- ===== SIDEBAR ===== -->
      <aside class="deck-detail-sidebar">
        <!-- Commander art -->
        <div
          v-if="commanderImageUrl"
          class="deck-detail-commander-art"
        >
          <img :src="commanderImageUrl" :alt="commanderName" />
        </div>

        <!-- Info block -->
        <div class="deck-detail-sidebar-info">
          <h2 class="deck-detail-title">{{ displayLabel }}</h2>

          <div v-if="commanderDeck" class="deck-detail-meta">
            <span class="deck-detail-commander">
              {{ commanderDeck.commander.join(' &amp; ') }}
            </span>
            <span class="deck-detail-colors">
              <span
                v-for="color in commanderDeck.colors"
                :key="color"
                :class="'color-pip color-pip-' + color.toLowerCase()"
                :title="color"
              ></span>
            </span>
          </div>

          <div class="deck-detail-stats">
            {{ totalCards }} cards
            <template v-if="illegalCount > 0">
              &bull; {{ illegalCount }} outside color identity
            </template>
            <span class="deck-detail-price">
              <template v-if="priceLoading"> &bull; loading price&hellip;</template>
              <template v-else-if="price !== null"> &bull; ${{ price }} est.</template>
            </span>
          </div>
        </div>

        <!-- Color distribution -->
        <div v-if="colorDistRows.length > 0" class="deck-detail-color-dist">
          <h4 class="deck-detail-breakdown-heading">Colors</h4>
          <div
            v-for="row in colorDistRows"
            :key="row.color"
            class="color-dist-row"
          >
            <span
              :class="'color-pip color-pip-' + row.color.toLowerCase()"
              :title="row.label"
            ></span>
            <div class="color-dist-track">
              <div
                :class="'color-dist-fill color-dist-fill-' + row.color.toLowerCase()"
                :style="{ width: row.pct + '%', height: '100%' }"
              ></div>
            </div>
            <span class="color-dist-count">{{ row.count }}</span>
          </div>
        </div>

        <!-- Breakdown bars -->
        <div v-if="nonEmptyCategories.length > 0" class="deck-detail-breakdown">
          <h4 class="deck-detail-breakdown-heading">Breakdown</h4>
          <div class="breakdown-bars">
            <a
              v-for="cat in nonEmptyCategories"
              :key="cat"
              :href="'#detail-section-' + cat.toLowerCase()"
              class="breakdown-bar-row"
            >
              <div class="breakdown-bar-label">
                <span class="breakdown-cat-name">{{ cat }}</span>
                <span class="breakdown-cat-count">{{ categoryCount(cat) }}</span>
              </div>
              <div class="breakdown-bar-track">
                <div
                  class="breakdown-bar-fill"
                  :style="{ width: categoryBarPct(cat) + '%' }"
                ></div>
              </div>
            </a>
          </div>
        </div>

        <!-- Actions -->
        <div class="deck-detail-sidebar-actions">
          <a
            href="#builder"
            class="btn-deck-action"
            @click="openInBuilder"
          >Open in Deck Builder</a>
          <button
            type="button"
            class="btn-deck-action btn-deck-action-secondary"
            @click="copyDecklist"
          >{{ decklistBtnLabel }}</button>
        </div>
      </aside>

      <!-- ===== MAIN ===== -->
      <div class="deck-detail-main">
        <!-- Mana curve -->
        <div v-if="deckEntries.length > 0" class="deck-detail-mana-curve-section">
          <h4 class="deck-detail-breakdown-heading">Mana Curve</h4>
          <p v-if="curveLoading" class="deck-detail-loading-text">Loading&hellip;</p>
          <div v-else class="mana-curve-chart">
            <div
              v-for="bucket in curveBuckets"
              :key="bucket"
              class="mana-curve-col"
            >
              <div class="mana-curve-count">
                {{ curveData[bucket] > 0 ? curveData[bucket] : '' }}
              </div>
              <div
                class="mana-curve-bar"
                :style="{ height: curveBarHeight(bucket) + 'px' }"
              ></div>
              <div class="mana-curve-label">{{ bucket }}</div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <p v-if="deckEntries.length === 0" class="empty-state">
          No cards in this deck yet.
        </p>

        <!-- Card sections grouped by type category -->
        <template v-else>
          <section
            v-for="cat in nonEmptyCategories"
            :key="cat"
            :id="'detail-section-' + cat.toLowerCase()"
            class="deck-detail-section"
          >
            <h3 class="deck-detail-section-heading">
              {{ cat }} ({{ categoryCount(cat) }})
            </h3>
            <div class="deck-card-list">
              <div
                v-for="entry in sortedCategoryEntries(cat)"
                :key="entry.index"
                :class="[
                  'deck-card-row',
                  isIllegal(entry.card) ? 'deck-card-row-illegal' : ''
                ]"
                :data-card-index="entry.index"
              >
                <!-- Name / type / badges -->
                <div class="deck-card-name-wrap">
                  <span
                    :class="['deck-card-name', entry.card.image ? '' : '']"
                    :data-card-image="entry.card.image || undefined"
                    @mouseenter="showPreview($event, entry.card.image)"
                    @mouseleave="hidePreview"
                  >{{ entry.card.name }}</span>
                  <span class="deck-card-type">{{ entry.card.type || '' }}</span>
                  <span
                    v-if="entry.card.foil"
                    class="deck-card-foil"
                    title="Foil"
                  >&#10024;</span>
                  <span
                    v-if="isIllegal(entry.card)"
                    class="status-badge illegal deck-card-illegal-badge"
                  >Illegal</span>
                  <span
                    v-if="entry.card.condition"
                    class="deck-card-condition-badge"
                    :title="getConditionLabel(entry.card.condition)"
                  >{{ entry.card.condition }}</span>
                </div>

                <!-- Controls -->
                <div class="deck-card-controls">
                  <div class="qty-stepper">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      @click="store.updateCardQuantity(entry.index, -1)"
                    >&minus;</button>
                    <span class="qty-value">{{ entry.card.quantity || 1 }}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      @click="store.updateCardQuantity(entry.index, 1)"
                    >+</button>
                  </div>
                  <button
                    type="button"
                    class="deck-card-details-btn"
                    @click="openDetails(entry.index, entry.card)"
                  >Details</button>
                  <button
                    type="button"
                    class="deck-card-remove-btn"
                    @click="store.removeCard(entry.index)"
                  >Remove</button>
                </div>
              </div>
            </div>
          </section>
        </template>
      </div>
    </div>

    <!-- Floating image preview -->
    <div
      v-if="previewVisible"
      class="card-preview-popup"
      :style="{ left: previewX + 'px', top: previewY + 'px' }"
    >
      <img :src="previewSrc" alt="Card preview" />
    </div>

    <!-- Card details modal -->
    <CardDetailsModal
      v-if="detailsModalOpen"
      :card-index="detailsCardIndex"
      :card="detailsCard"
      @close="detailsModalOpen = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useCollectionStore } from '../store/collection.js'
import { COMMANDER_DECKS, DECK_TYPE_CATEGORIES, BUILDER_DECK_KEY } from '../utils/constants.js'
import {
  normalizeDeckName,
  getDeckDisplayLabel,
  getDeckTypeCategory,
  getDeckLegality,
  getConditionLabel,
  generateDecklist,
  calcDeckPrice,
  buildManaCurveData
} from '../utils/cards.js'
import CardDetailsModal from './CardDetailsModal.vue'

const store = useCollectionStore()

// ── Derived deck data ─────────────────────────────────────────────────────────

const currentDeckDetail = computed(() => store.currentDeckDetail)

const deckEntries = computed(() => {
  const entries = []
  store.collection.forEach((card, index) => {
    if (normalizeDeckName(card.deck || 'unsorted') === currentDeckDetail.value) {
      entries.push({ card, index })
    }
  })
  return entries
})

const displayLabel = computed(() => getDeckDisplayLabel(currentDeckDetail.value))
const commanderDeck = computed(() => COMMANDER_DECKS[currentDeckDetail.value] || null)

const commanderName = computed(() => {
  if (!commanderDeck.value) return ''
  return commanderDeck.value.commander.join(' & ')
})

const commanderImageUrl = computed(() => {
  if (!commanderDeck.value) return ''
  const commanderEntry = deckEntries.value.find(e =>
    commanderDeck.value.commander.some(name => name === e.card.name)
  )
  return commanderEntry && commanderEntry.card.image ? commanderEntry.card.image : ''
})

const totalCards = computed(() =>
  deckEntries.value.reduce((sum, e) => sum + (e.card.quantity || 1), 0)
)

const illegalCount = computed(() =>
  deckEntries.value.filter(e => {
    const legality = getDeckLegality(e.card)
    return legality.checked && !legality.legal
  }).length
)

function isIllegal(card) {
  const legality = getDeckLegality(card)
  return legality.checked && !legality.legal
}

// ── Category grouping ─────────────────────────────────────────────────────────

const groups = computed(() => {
  const g = {}
  DECK_TYPE_CATEGORIES.forEach(cat => { g[cat] = [] })
  deckEntries.value.forEach(entry => {
    const cat = getDeckTypeCategory(entry.card, currentDeckDetail.value)
    g[cat].push(entry)
  })
  return g
})

const nonEmptyCategories = computed(() =>
  DECK_TYPE_CATEGORIES.filter(cat => groups.value[cat].length > 0)
)

function categoryCount(cat) {
  return (groups.value[cat] || []).reduce((sum, e) => sum + (e.card.quantity || 1), 0)
}

function categoryBarPct(cat) {
  if (totalCards.value === 0) return 0
  return Math.max(2, Math.round((categoryCount(cat) / totalCards.value) * 100))
}

function sortedCategoryEntries(cat) {
  return (groups.value[cat] || []).slice().sort((a, b) =>
    a.card.name.localeCompare(b.card.name)
  )
}

// ── Color distribution ────────────────────────────────────────────────────────

const colorDistRows = computed(() => {
  const counts = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
  const colorNames = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' }
  deckEntries.value.forEach(e => {
    const qty = e.card.quantity || 1
    const colors = e.card.colorIdentity || []
    if (colors.length === 0) {
      counts.C += qty
    } else {
      colors.forEach(c => {
        if (Object.prototype.hasOwnProperty.call(counts, c)) counts[c] += qty
      })
    }
  })
  const present = ['W', 'U', 'B', 'R', 'G', 'C'].filter(c => counts[c] > 0)
  if (present.length === 0) return []
  const max = Math.max(...present.map(c => counts[c]))
  return present.map(c => ({
    color: c,
    label: colorNames[c] || c,
    count: counts[c],
    pct: Math.max(4, Math.round((counts[c] / max) * 100))
  }))
})

// ── Scryfall async (price + mana curve) ──────────────────────────────────────

const priceLoading = ref(false)
const price = ref(null)
const curveLoading = ref(false)
const curveData = ref({ '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6+': 0 })
const curveBuckets = ['0', '1', '2', '3', '4', '5', '6+']

const curveMax = computed(() =>
  Math.max(...curveBuckets.map(b => curveData.value[b] || 0))
)

function curveBarHeight(bucket) {
  const count = curveData.value[bucket] || 0
  if (curveMax.value === 0) return 2
  return Math.max(2, Math.round((count / curveMax.value) * 60))
}

async function fetchDeckScryfallData(entries) {
  const ids = []
  const seen = {}
  entries.forEach(e => {
    const id = e.card.scryfallId
    if (id && typeof id === 'string' && id.length > 0 && !seen[id]) {
      ids.push(id)
      seen[id] = true
    }
  })
  if (ids.length === 0) return {}

  const result = {}
  for (let i = 0; i < ids.length; i += 75) {
    const batch = ids.slice(i, i + 75)
    try {
      const response = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: batch.map(id => ({ id })) })
      })
      if (!response.ok) continue
      const data = await response.json()
      if (data.object === 'list' && Array.isArray(data.data)) {
        data.data.forEach(card => {
          result[card.id] = { cmc: card.cmc || 0, prices: card.prices || {} }
        })
      }
    } catch (e) {
      console.warn('Scryfall deck data fetch failed:', e)
    }
  }
  return result
}

async function loadAsyncStats() {
  if (deckEntries.value.length === 0) return

  const cacheKey = currentDeckDetail.value
  priceLoading.value = true
  curveLoading.value = true

  try {
    let scryfallData = store.deckScryfallCache[cacheKey]
    if (!scryfallData) {
      scryfallData = await fetchDeckScryfallData(deckEntries.value)
      store.deckScryfallCache[cacheKey] = scryfallData
    }

    const computedPrice = calcDeckPrice(deckEntries.value, scryfallData)
    price.value = computedPrice

    const computedCurve = buildManaCurveData(deckEntries.value, scryfallData, cacheKey)
    curveData.value = computedCurve
  } catch (e) {
    console.warn('Could not load deck async stats:', e)
  } finally {
    priceLoading.value = false
    curveLoading.value = false
  }
}

// ── Hover preview ─────────────────────────────────────────────────────────────

const previewVisible = ref(false)
const previewSrc = ref('')
const previewX = ref(0)
const previewY = ref(0)

function showPreview(event, imageUrl) {
  if (!imageUrl) return
  previewSrc.value = imageUrl
  const rect = event.target.getBoundingClientRect()
  const popupWidth = 220
  let leftPos = rect.right + 16
  if (leftPos + popupWidth > window.innerWidth - 8) {
    leftPos = rect.left - popupWidth - 16
  }
  const topPos = Math.min(Math.max(8, rect.top - 20), window.innerHeight - 320)
  previewX.value = leftPos
  previewY.value = topPos
  previewVisible.value = true
}

function hidePreview() {
  previewVisible.value = false
}

// ── Card details modal ────────────────────────────────────────────────────────

const detailsModalOpen = ref(false)
const detailsCardIndex = ref(-1)
const detailsCard = ref(null)

function openDetails(index, card) {
  detailsCardIndex.value = index
  detailsCard.value = card
  detailsModalOpen.value = true
}

// ── Decklist copy ─────────────────────────────────────────────────────────────

const decklistBtnLabel = ref('Copy Decklist')

async function copyDecklist() {
  const text = generateDecklist(groups.value)
  try {
    await navigator.clipboard.writeText(text)
    decklistBtnLabel.value = 'Copied!'
    setTimeout(() => { decklistBtnLabel.value = 'Copy Decklist' }, 2000)
  } catch {
    alert('Deck list:\n\n' + text)
  }
}

// ── Deck builder link ─────────────────────────────────────────────────────────

function openInBuilder() {
  localStorage.setItem(BUILDER_DECK_KEY, currentDeckDetail.value)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(() => {
  loadAsyncStats()
})

watch(currentDeckDetail, () => {
  price.value = null
  priceLoading.value = false
  curveData.value = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6+': 0 }
  curveLoading.value = false
  loadAsyncStats()
})
</script>

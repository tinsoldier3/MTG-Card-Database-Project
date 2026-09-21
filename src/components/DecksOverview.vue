<template>
  <div class="decks-overview-grid">
    <a
      v-for="deckName in filteredDeckNames"
      :key="deckName"
      :href="'#deck/' + encodeURIComponent(deckName)"
      class="deck-tile"
    >
      <div class="deck-tile-header">
        <div class="deck-tile-name">{{ getDeckDisplayLabel(deckName, store.deckMap) }}</div>
        <button
          class="deck-tile-edit-btn"
          :title="'Edit ' + getDeckDisplayLabel(deckName, store.deckMap)"
          @click.prevent="openEditModal(deckName)"
        >✎</button>
      </div>

      <template v-if="commanderInfo(deckName)">
        <div class="deck-tile-commander">
          {{ commanderInfo(deckName).commander.join(' & ') }}
        </div>
        <div class="deck-tile-colors">
          <span
            v-for="color in commanderInfo(deckName).colors"
            :key="color"
            :class="'color-pip color-pip-' + color.toLowerCase()"
            :title="color"
          ></span>
        </div>
      </template>

      <div class="deck-tile-stats">
        <template v-if="deckCardCount(deckName) > 0">
          {{ deckCardCount(deckName) }} cards
          <template v-if="deckIllegalCount(deckName) > 0">
            &bull; {{ deckIllegalCount(deckName) }} illegal
          </template>
        </template>
        <template v-else>No cards yet</template>
      </div>
    </a>

    <button class="deck-tile deck-tile-new" @click="openCreateModal">
      <span class="deck-tile-new-icon">+</span>
      <span class="deck-tile-new-label">New Deck</span>
    </button>

    <p v-if="filteredDeckNames.length === 0 && search" class="empty-state">
      No decks match your search.
    </p>
  </div>

  <DeckModal
    :show="modalOpen"
    :deck="editingDeck"
    @close="modalOpen = false"
    @saved="modalOpen = false"
  />
</template>

<script setup>
import { ref, computed } from 'vue'
import { useCollectionStore } from '../store/collection.js'
import {
  normalizeDeckName,
  getDeckDisplayLabel,
  getDeckLegality,
  isBoxOrBinder
} from '../utils/cards.js'
import DeckModal from './DeckModal.vue'

const props = defineProps({
  search: {
    type: String,
    default: ''
  }
})

const store = useCollectionStore()

const modalOpen = ref(false)
const editingDeck = ref(null)

function openCreateModal() {
  editingDeck.value = null
  modalOpen.value = true
}

function openEditModal(deckName) {
  editingDeck.value = store.decks.find(d => d.name === deckName) || null
  modalOpen.value = true
}

// Build the full list of deck names: unique normalized names from collection
// (excluding boxes/binders), unioned with all known deck keys from the store.
const allDeckNames = computed(() => {
  const fromCollection = store.collection
    .filter(card => !isBoxOrBinder(normalizeDeckName(card.deck || 'unsorted')))
    .map(card => normalizeDeckName(card.deck || 'unsorted'))

  const unique = Array.from(new Set(fromCollection))

  Object.keys(store.deckMap).forEach(deckName => {
    if (!unique.includes(deckName)) unique.push(deckName)
  })

  unique.sort((a, b) =>
    getDeckDisplayLabel(a, store.deckMap).localeCompare(getDeckDisplayLabel(b, store.deckMap))
  )

  return unique
})

const filteredDeckNames = computed(() => {
  const query = (props.search || '').toLowerCase().trim()
  if (!query) return allDeckNames.value
  return allDeckNames.value.filter(deckName =>
    getDeckDisplayLabel(deckName, store.deckMap).toLowerCase().includes(query) ||
    deckName.includes(query)
  )
})

function commanderInfo(deckName) {
  return store.deckMap[deckName] || null
}

function deckCards(deckName) {
  return store.collection.filter(
    card => normalizeDeckName(card.deck || 'unsorted') === deckName
  )
}

function deckCardCount(deckName) {
  return deckCards(deckName).reduce((sum, card) => sum + (card.quantity || 1), 0)
}

function deckIllegalCount(deckName) {
  return deckCards(deckName).filter(card => {
    const legality = getDeckLegality(card, store.deckMap)
    return legality.checked && !legality.legal
  }).length
}
</script>

<style scoped>
.deck-tile-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.25rem;
}

.deck-tile-edit-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  opacity: 0;
  padding: 0 0.1rem;
  line-height: 1;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.deck-tile:hover .deck-tile-edit-btn {
  opacity: 0.6;
}

.deck-tile-edit-btn:hover {
  opacity: 1 !important;
}

.deck-tile-new {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 2px dashed currentColor;
  background: transparent;
  cursor: pointer;
  opacity: 0.45;
  transition: opacity 0.15s;
  text-decoration: none;
  min-height: 90px;
}

.deck-tile-new:hover {
  opacity: 0.8;
}

.deck-tile-new-icon {
  font-size: 1.6rem;
  line-height: 1;
}

.deck-tile-new-label {
  font-size: 0.85rem;
  font-weight: 600;
}
</style>

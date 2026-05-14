<template>
  <div class="decks-overview-grid">
    <a
      v-for="deckName in filteredDeckNames"
      :key="deckName"
      :href="'#deck/' + encodeURIComponent(deckName)"
      class="deck-tile"
    >
      <div class="deck-tile-name">{{ getDeckDisplayLabel(deckName) }}</div>

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

    <p v-if="filteredDeckNames.length === 0" class="empty-state">
      {{ search ? 'No decks match your search.' : 'No decks in your collection yet.' }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useCollectionStore } from '../store/collection.js'
import { COMMANDER_DECKS } from '../utils/constants.js'
import {
  normalizeDeckName,
  getDeckDisplayLabel,
  getDeckLegality,
  isBoxOrBinder
} from '../utils/cards.js'

const props = defineProps({
  search: {
    type: String,
    default: ''
  }
})

const store = useCollectionStore()

// Build the full list of deck names: unique normalized names from the collection
// (excluding boxes/binders), unioned with all known COMMANDER_DECKS keys.
const allDeckNames = computed(() => {
  const fromCollection = store.collection
    .filter(card => !isBoxOrBinder(normalizeDeckName(card.deck || 'unsorted')))
    .map(card => normalizeDeckName(card.deck || 'unsorted'))

  const unique = Array.from(new Set(fromCollection))

  Object.keys(COMMANDER_DECKS).forEach(deckName => {
    if (!unique.includes(deckName)) unique.push(deckName)
  })

  unique.sort((a, b) => getDeckDisplayLabel(a).localeCompare(getDeckDisplayLabel(b)))

  return unique
})

const filteredDeckNames = computed(() => {
  const query = (props.search || '').toLowerCase().trim()
  if (!query) return allDeckNames.value
  return allDeckNames.value.filter(deckName =>
    getDeckDisplayLabel(deckName).toLowerCase().includes(query) ||
    deckName.includes(query)
  )
})

function commanderInfo(deckName) {
  return COMMANDER_DECKS[deckName] || null
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
    const legality = getDeckLegality(card)
    return legality.checked && !legality.legal
  }).length
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-box deck-modal">
      <h3>{{ deck ? 'Edit Deck' : 'New Deck' }}</h3>

      <div class="modal-field">
        <label>Deck Name</label>
        <input
          v-model="label"
          type="text"
          placeholder="e.g. Atraxa"
          class="modal-input"
          @keydown.enter="save"
        />
      </div>

      <div class="modal-field">
        <label>Colors</label>
        <div class="deck-modal-colors">
          <label v-for="color in ALL_COLORS" :key="color" class="deck-modal-color-label">
            <input type="checkbox" :value="color" v-model="colors" class="deck-modal-color-cb" />
            <span :class="'color-pip color-pip-' + color.toLowerCase()" :title="COLOR_NAMES[color]"></span>
            <span class="deck-modal-color-name">{{ COLOR_NAMES[color] }}</span>
          </label>
        </div>
      </div>

      <div class="modal-field">
        <label>Commanders</label>
        <div v-for="(_, i) in commanders" :key="i" class="deck-modal-commander-row">
          <input
            v-model="commanders[i]"
            type="text"
            placeholder="Commander name"
            class="modal-input deck-modal-commander-input"
          />
          <button class="deck-modal-remove-btn" @click="commanders.splice(i, 1)" title="Remove">×</button>
        </div>
        <button class="deck-modal-add-btn" @click="commanders.push('')">+ Add Commander</button>
      </div>

      <p v-if="error" class="deck-modal-error">{{ error }}</p>

      <div class="modal-actions">
        <button
          v-if="deck"
          class="btn btn-danger"
          :disabled="saving"
          @click="confirmDelete"
        >Delete</button>
        <div class="modal-actions-right">
          <button class="btn" :disabled="saving" @click="$emit('close')">Cancel</button>
          <button
            class="btn btn-primary"
            :disabled="saving || !label.trim()"
            @click="save"
          >{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useCollectionStore } from '../store/collection.js'
import { COLOR_NAMES } from '../utils/constants.js'
import { normalizeDeckName } from '../utils/cards.js'

const ALL_COLORS = ['W', 'U', 'B', 'R', 'G']

const props = defineProps({
  show: { type: Boolean, default: false },
  deck: { type: Object, default: null },
})

const emit = defineEmits(['close', 'saved'])

const store = useCollectionStore()

const label = ref('')
const colors = ref([])
const commanders = ref([])
const saving = ref(false)
const error = ref('')

watch(() => props.show, (val) => {
  if (!val) return
  if (props.deck) {
    label.value = props.deck.label || ''
    colors.value = [...(props.deck.colors || [])]
    commanders.value = [...(props.deck.commanders || [])]
  } else {
    label.value = ''
    colors.value = []
    commanders.value = []
  }
  error.value = ''
}, { immediate: true })

async function save() {
  const trimmed = label.value.trim()
  if (!trimmed) return

  error.value = ''
  saving.value = true
  try {
    const filteredCommanders = commanders.value.map(c => c.trim()).filter(Boolean)
    if (props.deck) {
      await store.updateDeck(props.deck.id, {
        label: trimmed,
        colors: colors.value,
        commanders: filteredCommanders,
      })
    } else {
      const normalizedName = normalizeDeckName(trimmed)
      const exists = store.decks.some(d => d.name === normalizedName)
      if (exists) {
        error.value = 'A deck with that name already exists.'
        saving.value = false
        return
      }
      await store.createDeck(trimmed, colors.value, filteredCommanders)
    }
    emit('saved')
    emit('close')
  } catch (err) {
    error.value = err.message || 'Could not save deck. Please try again.'
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!props.deck) return
  const cardCount = store.collection.filter(
    c => normalizeDeckName(c.deck || 'unsorted') === props.deck.name
  ).length
  const msg = cardCount > 0
    ? `Delete "${props.deck.label}"? The ${cardCount} card(s) in this deck will be moved to Unsorted.`
    : `Delete "${props.deck.label}"?`
  if (!window.confirm(msg)) return

  saving.value = true
  error.value = ''
  try {
    await store.deleteDeck(props.deck.id)
    emit('saved')
    emit('close')
  } catch (err) {
    error.value = err.message || 'Could not delete deck. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.deck-modal {
  max-width: 420px;
  width: 100%;
}

.modal-field {
  margin-bottom: 1rem;
}

.modal-field label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.35rem;
  opacity: 0.7;
}

.modal-input {
  width: 100%;
  box-sizing: border-box;
}

.deck-modal-colors {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.deck-modal-color-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  user-select: none;
}

.deck-modal-color-cb {
  width: auto;
  margin: 0;
}

.deck-modal-color-name {
  font-size: 0.82rem;
}

.deck-modal-commander-row {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
  align-items: center;
}

.deck-modal-commander-input {
  flex: 1;
}

.deck-modal-remove-btn {
  background: none;
  border: none;
  color: var(--color-danger, #c0392b);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
}

.deck-modal-add-btn {
  background: none;
  border: 1px dashed currentColor;
  border-radius: 4px;
  padding: 0.25rem 0.6rem;
  font-size: 0.82rem;
  cursor: pointer;
  opacity: 0.7;
  margin-top: 0.25rem;
}

.deck-modal-add-btn:hover {
  opacity: 1;
}

.deck-modal-error {
  color: var(--color-danger, #c0392b);
  font-size: 0.85rem;
  margin: 0.5rem 0;
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.25rem;
  gap: 0.5rem;
}

.modal-actions-right {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}
</style>

<template>
  <div class="card-details-modal-overlay" @mousedown.self="$emit('close')">
    <div class="card-details-modal" role="dialog" aria-modal="true" :aria-labelledby="modalTitleId">
      <!-- Header -->
      <div class="card-details-modal-header">
        <h3 :id="modalTitleId" class="card-details-modal-title">{{ card.name }}</h3>
        <button
          type="button"
          class="card-details-modal-close"
          aria-label="Close"
          @click="$emit('close')"
        >&times;</button>
      </div>

      <!-- Body -->
      <div class="card-details-modal-body">
        <!-- Condition -->
        <div class="card-details-field-group">
          <label :for="fieldId('condition')">Condition</label>
          <select :id="fieldId('condition')" v-model="form.condition">
            <option value="">-- Select condition --</option>
            <option
              v-for="cond in CARD_CONDITIONS"
              :key="cond.value"
              :value="cond.value"
            >{{ cond.label }}</option>
          </select>
        </div>

        <!-- Date acquired -->
        <div class="card-details-field-group">
          <label :for="fieldId('acquiredDate')">Date Acquired</label>
          <input
            :id="fieldId('acquiredDate')"
            v-model="form.acquiredDate"
            type="date"
          />
        </div>

        <!-- Purchase price -->
        <div class="card-details-field-group">
          <label :for="fieldId('purchasePrice')">Purchase Price ($)</label>
          <input
            :id="fieldId('purchasePrice')"
            v-model="form.purchasePriceRaw"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 4.99"
          />
        </div>

        <!-- Notes -->
        <div class="card-details-field-group">
          <label :for="fieldId('notes')">Notes</label>
          <textarea
            :id="fieldId('notes')"
            v-model="form.notes"
            rows="3"
            placeholder="Any notes about this card…"
          ></textarea>
        </div>
      </div>

      <!-- Footer -->
      <div class="card-details-modal-footer">
        <button
          type="button"
          class="card-details-cancel-btn"
          @click="$emit('close')"
        >Cancel</button>
        <button
          type="button"
          class="card-details-save-btn"
          :disabled="saving"
          @click="save"
        >{{ saving ? 'Saving…' : 'Save' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useCollectionStore } from '../store/collection.js'
import { CARD_CONDITIONS } from '../utils/constants.js'

const props = defineProps({
  cardIndex: {
    type: Number,
    required: true
  },
  card: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const store = useCollectionStore()
const saving = ref(false)

// Stable ID prefix so multiple modals won't clash if ever rendered simultaneously
const uid = Math.random().toString(36).slice(2)
const modalTitleId = `card-details-title-${uid}`
function fieldId(name) {
  return `card-details-${uid}-${name}`
}

// Initialize form state from the card prop
const form = reactive({
  condition: props.card.condition || '',
  acquiredDate: props.card.acquiredDate || '',
  purchasePriceRaw:
    props.card.purchasePrice != null ? String(props.card.purchasePrice) : '',
  notes: props.card.notes || ''
})

async function save() {
  saving.value = true
  try {
    const purchasePrice =
      form.purchasePriceRaw !== '' && form.purchasePriceRaw !== null
        ? parseFloat(form.purchasePriceRaw)
        : null

    const updates = {
      condition: form.condition || '',
      acquiredDate: form.acquiredDate || '',
      purchasePrice: Number.isFinite(purchasePrice) && purchasePrice >= 0
        ? purchasePrice
        : null,
      notes: form.notes || ''
    }

    await store.updateCardMetadata(props.cardIndex, updates)
    emit('close')
  } catch (err) {
    console.error('Could not save card details:', err)
  } finally {
    saving.value = false
  }
}
</script>

<script setup>
import { ref } from 'vue'
import { useCollectionStore } from '../store/collection.js'

const store = useCollectionStore()

// ── Form state ─────────────────────────────────────────────────────────────

const newPassword = ref('')

// Message state: { text, type: 'error' | 'success' }
const message = ref({ text: '', type: '' })

const updating = ref(false)

// ── Helpers ────────────────────────────────────────────────────────────────

function showError(text) {
  message.value = { text, type: 'error' }
}

function showSuccess(text) {
  message.value = { text, type: 'success' }
}

function clearMessage() {
  message.value = { text: '', type: '' }
}

// ── Update password action ─────────────────────────────────────────────────

async function handleUpdatePassword() {
  clearMessage()
  const pw = newPassword.value

  if (!pw) {
    showError('Please enter a new password.')
    return
  }

  if (pw.length < 6) {
    showError('Password must be at least 6 characters.')
    return
  }

  updating.value = true

  try {
    await store.updatePassword(pw)
    newPassword.value = ''
    // store.updatePassword sets isPasswordRecovery = false and calls initApp,
    // so the auth state change / computed in App.vue will show the main shell.
    // We show a brief success message in case there is any delay.
    showSuccess('Password updated! Loading your collection…')
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.')
  } finally {
    updating.value = false
  }
}

function onKeydown(e) {
  if (e.key === 'Enter') handleUpdatePassword()
}
</script>

<template>
  <div class="auth-panel" id="resetPasswordPanel">
    <div class="auth-box">
      <h2>Set a New Password</h2>
      <p>Enter a new password for your account.</p>

      <!-- New password input -->
      <div>
        <label
          for="newPasswordInput"
          style="display:block; margin-bottom:6px; font-size:14px; font-weight:500;"
        >New Password</label>
        <input
          id="newPasswordInput"
          v-model="newPassword"
          type="password"
          placeholder="At least 6 characters"
          autocomplete="new-password"
          style="width:100%; box-sizing:border-box;"
          @keydown="onKeydown"
        />
      </div>

      <!-- Action button -->
      <div class="auth-actions">
        <button
          id="updatePasswordButton"
          :disabled="updating"
          @click="handleUpdatePassword"
        >{{ updating ? 'Updating…' : 'Update Password' }}</button>
      </div>

      <!-- Inline message (error or success) -->
      <p
        v-if="message.text"
        id="resetMessage"
        class="auth-message"
        :class="{
          'auth-message-error':   message.type === 'error',
          'auth-message-success': message.type === 'success',
        }"
      >{{ message.text }}</p>
    </div>
  </div>
</template>

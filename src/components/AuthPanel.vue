<script setup>
import { ref } from 'vue'
import { useCollectionStore } from '../store/collection.js'

const store = useCollectionStore()

// ── Form state ─────────────────────────────────────────────────────────────

const email    = ref('')
const password = ref('')

// Message state: { text, type: 'error' | 'success' }
const message = ref({ text: '', type: '' })

// Loading state to disable buttons during async calls
const signingIn  = ref(false)
const signingUp  = ref(false)
const forgetting = ref(false)

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

// ── Auth actions ───────────────────────────────────────────────────────────

async function handleSignIn() {
  clearMessage()
  const emailVal    = email.value.trim()
  const passwordVal = password.value

  if (!emailVal || !passwordVal) {
    showError('Please enter your email and password.')
    return
  }

  signingIn.value  = true
  signingUp.value  = true   // disable both buttons while working

  try {
    await store.signIn(emailVal, passwordVal)
    // On success the auth state change handler takes over; no manual nav needed
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.')
  } finally {
    signingIn.value = false
    signingUp.value = false
  }
}

async function handleSignUp() {
  clearMessage()
  const emailVal    = email.value.trim()
  const passwordVal = password.value

  if (!emailVal || !passwordVal) {
    showError('Please enter your email and password.')
    return
  }

  if (passwordVal.length < 6) {
    showError('Password must be at least 6 characters.')
    return
  }

  signingIn.value = true
  signingUp.value = true

  try {
    const result = await store.signUp(emailVal, passwordVal)
    if (result === 'confirm-email') {
      showSuccess('Account created! Check your email to confirm before signing in.')
    }
    // If result === 'signed-in', auth state change handler takes over
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.')
  } finally {
    signingIn.value = false
    signingUp.value = false
  }
}

async function handleForgotPassword() {
  clearMessage()
  const emailVal = email.value.trim()

  if (!emailVal) {
    showError('Enter your email address above first.')
    return
  }

  forgetting.value = true

  try {
    await store.forgotPassword(emailVal)
    showSuccess('Password reset email sent — check your inbox.')
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.')
  } finally {
    forgetting.value = false
  }
}

function onPasswordKeydown(e) {
  if (e.key === 'Enter') handleSignIn()
}
</script>

<template>
  <div class="auth-panel">
    <div class="auth-box">
      <h2>My MTG Collection</h2>
      <p>Sign in to access your collection.</p>

      <!-- Email input -->
      <div>
        <label for="authEmail" style="display:block; margin-bottom:6px; font-size:14px; font-weight:500;">
          Email
        </label>
        <input
          id="authEmail"
          v-model="email"
          type="email"
          placeholder="you@example.com"
          autocomplete="email"
          style="width:100%; box-sizing:border-box;"
        />
      </div>

      <!-- Password input -->
      <div style="margin-top:14px;">
        <label for="authPassword" style="display:block; margin-bottom:6px; font-size:14px; font-weight:500;">
          Password
        </label>
        <input
          id="authPassword"
          v-model="password"
          type="password"
          placeholder="••••••••"
          autocomplete="current-password"
          style="width:100%; box-sizing:border-box;"
          @keydown="onPasswordKeydown"
        />
      </div>

      <!-- Action buttons -->
      <div class="auth-actions">
        <button
          id="signInButton"
          :disabled="signingIn"
          @click="handleSignIn"
        >{{ signingIn ? 'Signing in…' : 'Sign in' }}</button>

        <button
          id="signUpButton"
          :disabled="signingUp"
          @click="handleSignUp"
        >{{ signingUp && !signingIn ? 'Creating account…' : 'Create account' }}</button>
      </div>

      <!-- Forgot password link -->
      <button
        id="forgotPasswordButton"
        class="forgot-password-btn"
        :disabled="forgetting"
        @click="handleForgotPassword"
      >{{ forgetting ? 'Sending…' : 'Forgot password?' }}</button>

      <!-- Inline message (error or success) -->
      <p
        v-if="message.text"
        id="authMessage"
        class="auth-message"
        :class="{
          'auth-message-error':   message.type === 'error',
          'auth-message-success': message.type === 'success',
        }"
      >{{ message.text }}</p>
    </div>
  </div>
</template>

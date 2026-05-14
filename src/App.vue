<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useCollectionStore } from './store/collection.js'
import { supabaseClient } from './composables/useSupabase.js'
import AuthPanel from './components/AuthPanel.vue'
import ResetPasswordPanel from './components/ResetPasswordPanel.vue'
import DecksOverview from './components/DecksOverview.vue'
import DeckDetail from './components/DeckDetail.vue'
import DeckBuilder from './components/DeckBuilder.vue'
import CardGrid from './components/CardGrid.vue'
import ControlsPanel from './components/ControlsPanel.vue'

const store = useCollectionStore()

// ── Auth state ─────────────────────────────────────────────────────────────

let authListener = null

onMounted(async () => {
  // Apply saved theme immediately on mount
  applyThemeToBody(store.theme)

  // Subscribe to Supabase auth state changes
  const { data } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      store.isPasswordRecovery = true
    } else if (event === 'SIGNED_IN' && session) {
      if (store.isPasswordRecovery) return
      store.currentUserId = session.user.id
      await store.initApp(session.user.email)
    } else if (event === 'SIGNED_OUT') {
      store.isPasswordRecovery = false
      store.collection = []
      store.currentUserId = null
      store.userEmail = ''
    }
  })
  authListener = data

  // Check for an existing session on page load
  const { data: { session } } = await supabaseClient.auth.getSession()
  if (!store.isPasswordRecovery) {
    if (session) {
      store.currentUserId = session.user.id
      await store.initApp(session.user.email)
    }
    // If no session and not password recovery, AuthPanel is shown via v-if
  }

  // Listen for hash changes to update the current view
  window.addEventListener('hashchange', onHashChange)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange)
  if (authListener && authListener.subscription) {
    authListener.subscription.unsubscribe()
  }
})

function onHashChange() {
  store.setViewFromHash()
}

// ── Theme ──────────────────────────────────────────────────────────────────

function applyThemeToBody(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark-mode')
  } else {
    document.documentElement.classList.remove('dark-mode')
  }
}

// Keep body class in sync with store.theme reactively
watch(
  () => store.theme,
  (newTheme) => applyThemeToBody(newTheme),
  { immediate: true }
)

// ── Derived state ──────────────────────────────────────────────────────────

const isSignedIn = computed(() => !!store.currentUserId)
const isPasswordRecovery = computed(() => store.isPasswordRecovery)
const themeIcon = computed(() => store.theme === 'dark' ? '☀️' : '🌙')

// Search / sort state shared between ControlsPanel and CardGrid
const search = ref('')
const sort = ref('name')

// Nav active helpers
function isNavActive(views) {
  return views.includes(store.currentView)
}
</script>

<template>
  <!-- Auth panel: shown when not signed in and not in password recovery -->
  <AuthPanel v-if="!isSignedIn && !isPasswordRecovery" />

  <!-- Password reset panel: shown after clicking a reset-password email link -->
  <ResetPasswordPanel v-else-if="isPasswordRecovery" />

  <!-- Main app shell: shown when signed in -->
  <div v-else class="app-shell">

    <!-- ── Page header ────────────────────────────────────────────── -->
    <header class="page-header">
      <div class="header-top">
        <h1>My MTG Collection</h1>
        <div class="header-right">
          <span class="user-email" id="userEmail">{{ store.userEmail }}</span>
          <button class="sign-out-btn" @click="store.signOut()">Sign out</button>
          <button
            class="theme-toggle"
            :title="store.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="store.toggleTheme()"
          >{{ themeIcon }}</button>
        </div>
      </div>

      <!-- ── Navigation ───────────────────────────────────────────── -->
      <nav class="main-nav">
        <a
          href="#decks"
          class="nav-link"
          :class="{ active: isNavActive(['decks', 'deck-detail']) }"
          id="decksLink"
        >Decks</a>
        <a
          href="#builder"
          class="nav-link"
          :class="{ active: isNavActive(['builder']) }"
          id="builderLink"
        >Deck Builder</a>
        <a
          href="#boxes"
          class="nav-link"
          :class="{ active: isNavActive(['boxes']) }"
          id="boxesLink"
        >Collection Boxes</a>
        <a
          href="#sets"
          class="nav-link"
          :class="{ active: isNavActive(['sets']) }"
          id="setsLink"
        >By Set</a>
      </nav>
    </header>

    <!-- ── View outlet ───────────────────────────────────────────── -->
    <main>
      <template v-if="store.currentView === 'decks'">
        <ControlsPanel v-model:search="search" v-model:sort="sort" />
        <DecksOverview :search="search" />
      </template>
      <DeckDetail  v-else-if="store.currentView === 'deck-detail'" />
      <DeckBuilder v-else-if="store.currentView === 'builder'" />
      <template v-else-if="store.currentView === 'boxes' || store.currentView === 'sets'">
        <ControlsPanel v-model:search="search" v-model:sort="sort" />
        <CardGrid :search="search" :sort="sort" />
      </template>
    </main>

    <!-- ── Status message toast ──────────────────────────────────── -->
    <div
      id="statusMessage"
      class="status-message"
      :class="{ hidden: !store.statusMessageVisible }"
      role="status"
      aria-live="polite"
    >{{ store.statusMessage }}</div>

    <!-- ── Progress bar ──────────────────────────────────────────── -->
    <div
      id="progressContainer"
      class="progress-container"
      :class="{ hidden: !store.progress.visible }"
    >
      <div id="progressText" class="progress-text">{{ store.progress.label }}</div>
      <div class="progress-track">
        <div
          id="progressBar"
          class="progress-bar"
          :style="{ width: store.progress.pct + '%' }"
        ></div>
      </div>
    </div>

  </div>
</template>

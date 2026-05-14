import { defineStore } from 'pinia'
import { supabaseClient } from '../composables/useSupabase.js'
import { STORAGE_KEY } from '../utils/constants.js'
import {
  normalizeStoredCard, rowToCard, cardToRow,
  safelyMapRowsToCards, getCollectionLoadErrorMessage,
  withTimeout, normalizeDeckName
} from '../utils/cards.js'

const COLLECTION_BATCH_SIZE = 1000
const COLLECTION_LOAD_TIMEOUT_MS = 20000

export const useCollectionStore = defineStore('collection', {
  state: () => ({
    collection: [],
    currentUserId: null,
    userEmail: '',
    currentView: 'decks',
    currentDeckDetail: '',
    setNameCache: {},
    deckScryfallCache: {},
    isPasswordRecovery: false,
    realtimeChannel: null,
    theme: localStorage.getItem('mtgTheme') || 'light',
    statusMessage: '',
    statusMessageVisible: false,
    statusMessageTimeout: null,
    progress: { visible: false, pct: 0, label: '' },
  }),

  actions: {
    // ── View routing ──────────────────────────────────────────
    setViewFromHash() {
      const hash = window.location.hash.substring(1)
      if (hash === 'builder') {
        this.currentView = 'builder'
      } else if (hash === 'boxes') {
        this.currentView = 'boxes'
      } else if (hash === 'sets') {
        this.currentView = 'sets'
      } else if (hash.startsWith('deck/')) {
        this.currentView = 'deck-detail'
        this.currentDeckDetail = normalizeDeckName(decodeURIComponent(hash.substring(5)))
      } else {
        this.currentView = 'decks'
      }
    },

    setView(view, detail = '') {
      this.currentView = view
      this.currentDeckDetail = detail
    },

    // ── Theme ─────────────────────────────────────────────────
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('mtgTheme', this.theme)
    },

    // ── Status / Progress ──────────────────────────────────────
    showStatusMessage(msg) {
      clearTimeout(this.statusMessageTimeout)
      this.statusMessage = msg
      this.statusMessageVisible = true
      this.statusMessageTimeout = setTimeout(() => {
        this.statusMessageVisible = false
      }, 4000)
    },

    showProgress(label) {
      this.progress = { visible: true, pct: 0, label }
    },

    updateProgress(pct) {
      this.progress.pct = pct
    },

    hideProgress() {
      this.progress.visible = false
    },

    // ── Collection loading ────────────────────────────────────
    async loadCollectionInBatches() {
      let allRows = []
      let from = 0
      while (true) {
        const result = await withTimeout(
          supabaseClient.from('cards').select('*').eq('user_id', this.currentUserId)
            .range(from, from + COLLECTION_BATCH_SIZE - 1),
          COLLECTION_LOAD_TIMEOUT_MS,
          'Collection load timed out.'
        )
        if (result.error) throw result.error
        allRows = allRows.concat(result.data || [])
        if (!result.data || result.data.length < COLLECTION_BATCH_SIZE) break
        from += COLLECTION_BATCH_SIZE
      }
      return safelyMapRowsToCards(allRows)
    },

    async loadCollectionWithSimpleQuery() {
      const result = await withTimeout(
        supabaseClient.from('cards').select('*').eq('user_id', this.currentUserId),
        COLLECTION_LOAD_TIMEOUT_MS,
        'Collection load timed out.'
      )
      if (result.error) throw result.error
      return safelyMapRowsToCards(result.data || [])
    },

    async loadCollection() {
      try {
        return await this.loadCollectionInBatches()
      } catch (batchError) {
        console.warn('Batch load failed, trying simple query:', batchError)
        this.showStatusMessage('Collection loading took longer than expected. Retrying...')
        return await this.loadCollectionWithSimpleQuery()
      }
    },

    // ── Card CRUD ─────────────────────────────────────────────
    async dbUpsertCards(cards) {
      if (!cards.length) return
      const { error } = await supabaseClient
        .from('cards')
        .upsert(cards.map(c => cardToRow(c, this.currentUserId)), { onConflict: 'id' })
      if (error) throw error
    },

    async dbDeleteCards(ids) {
      if (!ids.length) return
      const { error } = await supabaseClient.from('cards').delete().in('id', ids)
      if (error) throw error
    },

    async updateCardQuantity(index, delta) {
      const card = this.collection[index]
      const currentQty = card.quantity || 1
      const newQty = Math.max(1, currentQty + delta)
      if (newQty === currentQty) return
      const updatedCard = { ...card, quantity: newQty }
      this.collection[index] = updatedCard
      this.showStatusMessage(`${card.name} quantity set to ${newQty}.`)
      try {
        await this.dbUpsertCards([updatedCard])
      } catch (err) {
        console.error('Could not update quantity.', err)
        this.collection[index] = card
        this.showStatusMessage(`Could not update ${card.name} quantity. Please try again.`)
      }
    },

    async moveCardToDeck(index, deckName) {
      const card = this.collection[index]
      const normalized = normalizeDeckName(deckName)
      if (!normalized || normalized === card.deck) return
      const updatedCard = { ...card, deck: normalized }
      this.collection[index] = updatedCard
      try {
        await this.dbUpsertCards([updatedCard])
        this.showStatusMessage(`${card.name} moved to ${deckName}.`)
      } catch (err) {
        console.error('Could not move card.', err)
        this.collection[index] = card
        this.showStatusMessage(`Could not move ${card.name}. Please try again.`)
      }
    },

    async removeCard(index) {
      const card = this.collection[index]
      this.collection.splice(index, 1)
      try {
        await this.dbDeleteCards([card.id])
        this.showStatusMessage(`${card.name} removed.`)
      } catch (err) {
        console.error('Could not remove card.', err)
        this.collection.splice(index, 0, card)
        this.showStatusMessage(`Could not remove ${card.name}. Please try again.`)
      }
    },

    async updateCardMetadata(index, updates) {
      const card = this.collection[index]
      if (!card) return
      const updatedCard = { ...card, ...updates }
      this.collection[index] = updatedCard
      this.showStatusMessage(`${card.name} details saved.`)
      try {
        await this.dbUpsertCards([updatedCard])
      } catch (err) {
        console.error('Could not save card details.', err)
        this.collection[index] = card
        this.showStatusMessage(`Could not save details for ${card.name}. Please try again.`)
      }
    },

    // ── Realtime ──────────────────────────────────────────────
    handleRealtimeEvent(payload) {
      const { eventType } = payload
      if (eventType === 'INSERT') {
        if (!this.collection.some(c => c.id === payload.new.id)) {
          this.collection.push(rowToCard(payload.new))
        }
      } else if (eventType === 'UPDATE') {
        const idx = this.collection.findIndex(c => c.id === payload.new.id)
        if (idx !== -1) {
          const updated = rowToCard(payload.new)
          if (JSON.stringify(this.collection[idx]) !== JSON.stringify(updated)) {
            this.collection[idx] = updated
          }
        }
      } else if (eventType === 'DELETE') {
        const idx = this.collection.findIndex(c => c.id === payload.old.id)
        if (idx !== -1) this.collection.splice(idx, 1)
      }
    },

    subscribeToCollection() {
      if (this.realtimeChannel) supabaseClient.removeChannel(this.realtimeChannel)
      this.realtimeChannel = supabaseClient
        .channel('cards-' + this.currentUserId)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'cards', filter: 'user_id=eq.' + this.currentUserId },
          (payload) => this.handleRealtimeEvent(payload)
        )
        .subscribe()
    },

    unsubscribeFromCollection() {
      if (this.realtimeChannel) {
        supabaseClient.removeChannel(this.realtimeChannel)
        this.realtimeChannel = null
      }
    },

    // ── Init ──────────────────────────────────────────────────
    async initApp(email) {
      this.userEmail = email || ''
      try {
        this.collection = await this.loadCollection()
      } catch (err) {
        this.collection = []
        const msg = getCollectionLoadErrorMessage(err)
        this.showStatusMessage(msg)
        console.error('Collection load failed:', err)
        return
      }

      // Auto-migrate localStorage on first sign-in
      if (this.collection.length === 0) {
        try {
          const localRaw = localStorage.getItem(STORAGE_KEY)
          if (localRaw) {
            const localCards = JSON.parse(localRaw).map(normalizeStoredCard)
            if (localCards.length > 0) {
              await this.dbUpsertCards(localCards)
              this.collection = localCards
              localStorage.removeItem(STORAGE_KEY)
              this.showStatusMessage(`Migrated ${localCards.length} cards from local storage to Supabase.`)
            }
          }
        } catch (e) {
          console.warn('Could not auto-migrate localStorage data.', e)
        }
      }

      this.subscribeToCollection()
      this.setViewFromHash()
    },

    // ── Auth ──────────────────────────────────────────────────
    friendlyAuthError(error) {
      const msg = (error && error.message) ? error.message.toLowerCase() : ''
      if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('wrong password') || msg.includes('email not confirmed'))
        return 'Incorrect email or password. Double-check your credentials and try again.'
      if (msg.includes('already registered') || msg.includes('user already exists'))
        return 'That email is already registered. Try signing in instead.'
      if (msg.includes('weak password') || msg.includes('at least 6') || msg.includes('password should'))
        return 'Password must be at least 6 characters.'
      if (msg.includes('rate limit') || msg.includes('too many'))
        return 'Too many attempts — wait a minute then try again.'
      if (msg.includes('network') || msg.includes('fetch'))
        return 'Network error — check your connection and try again.'
      return error.message || 'Something went wrong. Please try again.'
    },

    async signIn(email, password) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password })
      if (error) throw new Error(this.friendlyAuthError(error))
      this.currentUserId = data.user.id
      await this.initApp(data.user.email)
    },

    async signUp(email, password) {
      const { data, error } = await supabaseClient.auth.signUp({ email, password })
      if (error) throw new Error(this.friendlyAuthError(error))
      if (data.user && !data.session) return 'confirm-email'
      this.currentUserId = data.user.id
      await this.initApp(data.user.email)
      return 'signed-in'
    },

    async signOut() {
      this.unsubscribeFromCollection()
      this.collection = []
      this.currentUserId = null
      this.userEmail = ''
      await supabaseClient.auth.signOut()
    },

    async forgotPassword(email) {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://tinsoldier3.github.io/MTG-Card-Database-Project/'
      })
      if (error) throw new Error(this.friendlyAuthError(error))
    },

    async updatePassword(newPassword) {
      const { error } = await supabaseClient.auth.updateUser({ password: newPassword })
      if (error) throw new Error(this.friendlyAuthError(error))
      this.isPasswordRecovery = false
      const { data: { session } } = await supabaseClient.auth.getSession()
      if (session) {
        this.currentUserId = session.user.id
        await this.initApp(session.user.email)
      }
      this.showStatusMessage('Password updated successfully.')
    },
  },
})

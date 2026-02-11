import { defineStore } from 'pinia'
import { ref } from 'vue'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/services/firebase/config'
import { authService } from '@/services/firebase/auth'

export const useAdminStore = defineStore('admin', () => {
  // State
  const isOpen = ref(false)
  const activeTab = ref('settings') // 'settings', 'workspaceSettings', 'defaultTiers'
  const error = ref('')
  const success = ref('')

  // Global Settings State
  const globalSettings = ref({
    anonymousUserMode: 'view', // 'interact' or 'view' - default to 'view' for safety
    useHeadlessBrowser: false // Use headless browser for op.gg scraping (slower but more reliable)
  })
  const isSavingSettings = ref(false)

  // Editor Mode State (for tier management)
  const isEditorModeActive = ref(false)

  // Actions
  async function open(tab = null) {
    isOpen.value = true
    error.value = ''
    success.value = ''
    if (tab) {
      activeTab.value = tab
    }
    await loadGlobalSettings()
  }

  function close() {
    isOpen.value = false
    error.value = ''
    success.value = ''
  }

  // Editor Mode Functions (for tier management)
  function toggleEditorMode() {
    isEditorModeActive.value = !isEditorModeActive.value
  }

  function setEditorMode(value) {
    isEditorModeActive.value = value
  }

  async function loadGlobalSettings() {
    try {
      const settingsRef = doc(db, 'settings', 'global')
      const settingsDoc = await getDoc(settingsRef)

      if (settingsDoc.exists()) {
        const data = settingsDoc.data()
        globalSettings.value = {
          anonymousUserMode: data.anonymousUserMode || 'interact',
          useHeadlessBrowser: data.useHeadlessBrowser || false
        }
        console.log('Loaded global settings:', globalSettings.value)
      }
    } catch (err) {
      console.error('Error loading global settings:', err)
    }
  }

  async function saveGlobalSettings() {
    if (!authService.isAuthenticated()) {
      error.value = 'Authentication required'
      return
    }

    const isAdmin = await authService.isAdmin()
    if (!isAdmin) {
      error.value = 'Admin access required'
      return
    }

    isSavingSettings.value = true
    error.value = ''

    try {
      const settingsRef = doc(db, 'settings', 'global')
      await setDoc(settingsRef, {
        anonymousUserMode: globalSettings.value.anonymousUserMode,
        useHeadlessBrowser: globalSettings.value.useHeadlessBrowser,
        lastUpdated: serverTimestamp(),
        updatedBy: authService.getUserId()
      }, { merge: true })

      success.value = 'Settings saved successfully'
      setTimeout(() => { success.value = '' }, 3000)
    } catch (err) {
      console.error('Error saving global settings:', err)
      error.value = err.message || 'Failed to save settings'
    } finally {
      isSavingSettings.value = false
    }
  }

  return {
    // State
    isOpen,
    activeTab,
    error,
    success,
    globalSettings,
    isSavingSettings,
    isEditorModeActive,
    // Actions
    open,
    close,
    toggleEditorMode,
    setEditorMode,
    loadGlobalSettings,
    saveGlobalSettings
  }
})

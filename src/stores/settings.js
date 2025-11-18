import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  // State
  const settings = ref({
    pool: {
      frozenChampions: false,
      compactMode: false,
      disableAnimations: false,
      centerCards: true
    },
    drafting: {}
  })
  
  const isSettingsOpen = ref(false)
  const settingsTab = ref('pool')
  
  // Watch settings and save to localStorage
  watch(settings, (newSettings) => {
    saveSettings()
  }, { deep: true })
  
  // Actions
  function loadSettings() {
    const saved = localStorage.getItem('fearlessSettings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        settings.value = { ...settings.value, ...parsed }
      } catch (error) {
        console.error('Error loading settings:', error)
      }
    }
  }
  
  function saveSettings() {
    localStorage.setItem('fearlessSettings', JSON.stringify(settings.value))
  }
  
  function openSettings() {
    isSettingsOpen.value = true
  }
  
  function closeSettings() {
    isSettingsOpen.value = false
  }
  
  // Initialize
  loadSettings()
  
  return {
    // State
    settings,
    isSettingsOpen,
    settingsTab,
    // Actions
    loadSettings,
    saveSettings,
    openSettings,
    closeSettings
  }
})



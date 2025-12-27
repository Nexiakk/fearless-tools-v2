import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  // State
  const settings = ref({
    pool: {
      frozenChampions: false,
      compactMode: false, // Deprecated, kept for backward compatibility
      normalCardSize: 100, // Percentage scale (50-200), default 100
      highlightCardSize: 100, // Percentage scale (50-200), default 100
      unavailableCardSize: 83, // Percentage scale (50-200), default 83 (smaller than normal)
      disableAnimations: false,
      centerCards: true,
      enableSearch: true // Enable search bar feature, default: enabled
    },
    drafting: {
      integrateUnavailableChampions: true // default: enabled
    }
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
        // Deep merge to preserve defaults for missing properties
        if (parsed.pool) {
          settings.value.pool = { ...settings.value.pool, ...parsed.pool }
          // Initialize new size properties if they don't exist
          if (settings.value.pool.normalCardSize === undefined) {
            settings.value.pool.normalCardSize = parsed.pool.compactMode ? 83 : 100
          }
          if (settings.value.pool.highlightCardSize === undefined) {
            settings.value.pool.highlightCardSize = 100
          }
          if (settings.value.pool.unavailableCardSize === undefined) {
            settings.value.pool.unavailableCardSize = 83
          }
        }
        if (parsed.drafting) {
          settings.value.drafting = { ...settings.value.drafting, ...parsed.drafting }
        }
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
  
  function resetSettings() {
    // Reset to default values
    settings.value = {
      pool: {
        frozenChampions: false,
        compactMode: false, // Deprecated, kept for backward compatibility
        normalCardSize: 100, // Percentage scale (50-200), default 100
        highlightCardSize: 100, // Percentage scale (50-200), default 100
        unavailableCardSize: 83, // Percentage scale (50-200), default 83 (smaller than normal)
        disableAnimations: false,
        centerCards: true,
        enableSearch: true // Enable search bar feature, default: enabled
      },
      drafting: {
        integrateUnavailableChampions: true // default: enabled
      }
    }
    // Save the reset settings
    saveSettings()
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
    closeSettings,
    resetSettings
  }
})



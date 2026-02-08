import { defineStore } from "pinia";
import { ref } from "vue";

export const useSettingsStore = defineStore("settings", () => {
  // State
  const settings = ref({
    pool: {
      frozenChampions: false,
      compactMode: false, // Deprecated, kept for backward compatibility
      normalCardSize: 83, // Percentage scale (50-200), default 100
      highlightCardSize: 100, // Percentage scale (50-200), default 100
      unavailableCardSize: 83, // Percentage scale (50-200), default 83 (smaller than normal)
      disableAnimations: false,
      centerCards: true,
      enableSearch: true, // Enable search bar feature, default: enabled
      showEventHistory: false, // Show EventHistory sidebar, default: enabled
    },
    drafting: {
      integrateUnavailableChampions: true, // default: enabled
      disableDraftDeletionWarning: false, // default: show warning
    },
  });

  const isSettingsOpen = ref(false);
  const settingsTab = ref("pool");

  // Actions
  function loadSettings() {
    const saved = localStorage.getItem("fearlessSettings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Deep merge to preserve defaults for missing properties
        if (parsed.pool) {
          // First, merge saved settings with defaults
          const mergedPool = { ...settings.value.pool, ...parsed.pool };

          // Then handle backward compatibility for size properties
          if (
            parsed.pool.compactMode !== undefined &&
            parsed.pool.normalCardSize === undefined
          ) {
            mergedPool.normalCardSize = parsed.pool.compactMode ? 83 : 100;
          }
          if (parsed.pool.highlightCardSize === undefined) {
            mergedPool.highlightCardSize = 100;
          }
          if (parsed.pool.unavailableCardSize === undefined) {
            mergedPool.unavailableCardSize = 83;
          }

          settings.value.pool = mergedPool;
        }
        if (parsed.drafting) {
          settings.value.drafting = {
            ...settings.value.drafting,
            ...parsed.drafting,
          };
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    }
  }

  function saveSettings() {
    localStorage.setItem("fearlessSettings", JSON.stringify(settings.value));
  }

  function openSettings() {
    isSettingsOpen.value = true;
  }

  function closeSettings() {
    isSettingsOpen.value = false;
  }

  function updatePoolSetting(key, value) {
    settings.value.pool[key] = value;
    saveSettings();
  }

  function updateDraftingSetting(key, value) {
    settings.value.drafting[key] = value;
    saveSettings();
  }

  function resetSettings() {
    // Reset to default values
    settings.value = {
      pool: {
        frozenChampions: false,
        compactMode: false, // Deprecated, kept for backward compatibility
        normalCardSize: 83, // Percentage scale (50-200), default 100
        highlightCardSize: 100, // Percentage scale (50-200), default 100
        unavailableCardSize: 83, // Percentage scale (50-200), default 83 (smaller than normal)
        disableAnimations: false,
        centerCards: false,
        enableSearch: false, // Enable search bar feature, default: enabled
        showEventHistory: true, // Show EventHistory sidebar, default: enabled
      },
      drafting: {
        integrateUnavailableChampions: true, // default: enabled
        disableDraftDeletionWarning: false, // default: show warning
      },
    };
    // Save the reset settings
    saveSettings();
  }

  // Settings are now saved through updatePoolSetting() and updateDraftingSetting() methods

  // Initialize
  loadSettings();

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
    updatePoolSetting,
    updateDraftingSetting,
    resetSettings,
  };
});

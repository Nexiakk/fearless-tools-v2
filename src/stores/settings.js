import { defineStore } from "pinia";
import { ref } from "vue";

export const useSettingsStore = defineStore("settings", () => {
  // State
  const settings = ref({
    pool: {
      compactMode: false, // Deprecated, kept for backward compatibility
      normalCardSize: 83, // Percentage scale (50-200), default 83
      highlightCardSize: 100, // Percentage scale (50-200), default 100
      unavailableCardSize: 83, // Percentage scale (50-200), default 83 (smaller than normal)
      disableAnimations: false,
      centerCards: true,
      enableSearch: false, // Enable search bar feature, default: enabled
      showEventHistory: true, // Show EventHistory sidebar, default: enabled
      // NEW: Card size presets
      cardSizePreset: "compact", // 'standard' | 'compact' | 'custom'
      useGlobalTierSize: true, // Use single value for all tier cards
      tierCardSizes: {
        // Per-tier sizes (when useGlobalTierSize is false)
        op: 100,
        highlight: 100,
      },
      globalTierCardSize: 100, // Global tier card size (when useGlobalTierSize is true)
      // NEW: Global page content scale
      pageContentScale: 100, // Global page content scale (50-150), default 100
      // NEW: Unavailable/Banned champions grouping
      unavailableChampionsGrouping: "top", // 'top' | 'bottom' | 'hidden', default: 'top'
    },
    drafting: {
      integrateUnavailableChampions: false, // default: enabled
      disableDraftDeletionWarning: false, // default: show warning
      tierHighlightMode: "sort", // 'sort' | 'always' | 'none', default: 'sort'
      pickedMode: "default", // 'default' | 'bottom' | 'hidden', default: 'default'
      championGridZoomIndex: 4, // default: index 4 (1.0 scale)
    },
  });

  const isSettingsOpen = ref(false);
  const settingsTab = ref("pool");

  // Preset configurations
  const PRESETS = {
    standard: {
      normalCardSize: 100,
      unavailableCardSize: 83,
      highlightCardSize: 100,
    },
    compact: {
      normalCardSize: 83,
      unavailableCardSize: 83,
      highlightCardSize: 100,
    },
    custom: {
      // Uses current values, doesn't override
    },
  };

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

          // Handle new card size preset settings
          if (parsed.pool.cardSizePreset === undefined) {
            // Determine preset based on current settings
            if (mergedPool.normalCardSize === 100) {
              mergedPool.cardSizePreset = "standard";
            } else if (mergedPool.normalCardSize === 83) {
              mergedPool.cardSizePreset = "compact";
            } else {
              mergedPool.cardSizePreset = "custom";
            }
          }
          if (parsed.pool.useGlobalTierSize === undefined) {
            mergedPool.useGlobalTierSize = true;
          }
          if (parsed.pool.tierCardSizes === undefined) {
            mergedPool.tierCardSizes = { op: 100, highlight: 100 };
          }
          if (parsed.pool.globalTierCardSize === undefined) {
            mergedPool.globalTierCardSize =
              parsed.pool.highlightCardSize || 100;
          }
          // Handle new page content scale setting
          if (parsed.pool.pageContentScale === undefined) {
            mergedPool.pageContentScale = 100;
          }
          // Handle new unavailable champions grouping setting
          if (parsed.pool.unavailableChampionsGrouping === undefined) {
            mergedPool.unavailableChampionsGrouping = "top";
          }

          settings.value.pool = mergedPool;
        }
        if (parsed.drafting) {
          // Backward compatibility for new drafting settings
          if (parsed.drafting.tierHighlightMode === undefined) {
            parsed.drafting.tierHighlightMode = "sort";
          }
          if (parsed.drafting.pickedMode === undefined) {
            parsed.drafting.pickedMode = "default";
          }
          if (parsed.drafting.championGridZoomIndex === undefined) {
            parsed.drafting.championGridZoomIndex = 4;
          }
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

  // NEW: Apply card size preset
  function applyCardSizePreset(preset) {
    const presetConfig = PRESETS[preset];
    if (!presetConfig) return;

    settings.value.pool.cardSizePreset = preset;

    if (preset !== "custom") {
      // Apply preset values
      settings.value.pool.normalCardSize = presetConfig.normalCardSize;
      settings.value.pool.unavailableCardSize =
        presetConfig.unavailableCardSize;
      settings.value.pool.highlightCardSize = presetConfig.highlightCardSize;
      settings.value.pool.globalTierCardSize = presetConfig.highlightCardSize;
    }

    saveSettings();
  }

  // NEW: Set whether to use global tier size or per-tier
  function setUseGlobalTierSize(useGlobal) {
    settings.value.pool.useGlobalTierSize = useGlobal;
    saveSettings();
  }

  // NEW: Update tier card size (global or per-tier)
  function updateTierCardSize(tierId, value) {
    if (settings.value.pool.useGlobalTierSize) {
      settings.value.pool.globalTierCardSize = value;
      settings.value.pool.highlightCardSize = value;
    } else {
      settings.value.pool.tierCardSizes[tierId] = value;
    }
    saveSettings();
  }

  // NEW: Get effective tier card size for a specific tier
  function getTierCardSize(tierId) {
    if (settings.value.pool.useGlobalTierSize) {
      return settings.value.pool.globalTierCardSize;
    }
    return (
      settings.value.pool.tierCardSizes[tierId] ||
      settings.value.pool.globalTierCardSize
    );
  }

  // NEW: Initialize tier card sizes for new tiers
  function initializeTierCardSize(tierId) {
    if (!settings.value.pool.tierCardSizes[tierId]) {
      settings.value.pool.tierCardSizes[tierId] =
        settings.value.pool.globalTierCardSize;
      saveSettings();
    }
  }

  // NEW: Remove tier card size when tier is deleted
  function removeTierCardSize(tierId) {
    if (settings.value.pool.tierCardSizes[tierId]) {
      delete settings.value.pool.tierCardSizes[tierId];
      saveSettings();
    }
  }

  function resetSettings() {
    // Reset to default values
    settings.value = {
      pool: {
        compactMode: false, // Deprecated, kept for backward compatibility
        normalCardSize: 83, // Percentage scale (50-200), default 83
        highlightCardSize: 100, // Percentage scale (50-200), default 100
        unavailableCardSize: 83, // Percentage scale (50-200), default 83 (smaller than normal)
        disableAnimations: false,
        centerCards: false,
        enableSearch: false, // Enable search bar feature, default: enabled
        showEventHistory: true, // Show EventHistory sidebar, default: enabled
        // NEW: Reset new settings to defaults
        cardSizePreset: "compact",
        useGlobalTierSize: true,
        tierCardSizes: { op: 100, highlight: 100 },
        globalTierCardSize: 100,
        pageContentScale: 100, // Reset page content scale to default
        unavailableChampionsGrouping: "top", // Reset unavailable champions grouping to default
      },
      drafting: {
        integrateUnavailableChampions: false, // default: enabled
        disableDraftDeletionWarning: false, // default: show warning
        tierHighlightMode: "sort",
        pickedMode: "default",
        championGridZoomIndex: 4,
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
    // Presets
    PRESETS,
    // Actions
    loadSettings,
    saveSettings,
    openSettings,
    closeSettings,
    updatePoolSetting,
    updateDraftingSetting,
    applyCardSizePreset,
    setUseGlobalTierSize,
    updateTierCardSize,
    getTierCardSize,
    initializeTierCardSize,
    removeTierCardSize,
    resetSettings,
  };
});

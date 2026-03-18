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
      integrateUnavailableChampions: false, // Deprecated, replaced by mode
      disableDraftDeletionWarning: false, // default: show warning
      tierHighlightMode: "sort", // 'sort' | 'always' | 'none', default: 'sort'
      pickedMode: "default", // 'default' | 'bottom' | 'hidden', default: 'default'
      championGridZoomIndex: 4, // default: index 4 (1.0 scale)
      championGridGap: 6, // default: 6px
      cardSizeSource: "pool", // 'pool' | 'custom'
      // NEW: Tier scaling support in Custom mode for drafting
      cardSizePreset: "compact", // 'standard' | 'compact' | 'custom'
      useGlobalTierSize: true, // Use single value for all tier cards
      tierCardSizes: {
        op: 100,
        highlight: 100,
      },
      globalTierCardSize: 100, // Global tier card size
      normalCardSize: 100, // custom size for drafting
      unavailableCardSize: 83, // custom size for drafting
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
          if (parsed.drafting.championGridGap === undefined) {
            parsed.drafting.championGridGap = 6;
          }
          if (parsed.drafting.cardSizeSource === undefined) {
            parsed.drafting.cardSizeSource = "pool";
          }
          if (parsed.drafting.cardSizePreset === undefined) {
            parsed.drafting.cardSizePreset = "compact";
          }
          if (parsed.drafting.useGlobalTierSize === undefined) {
            parsed.drafting.useGlobalTierSize = true;
          }
          if (parsed.drafting.tierCardSizes === undefined) {
            parsed.drafting.tierCardSizes = { op: 100, highlight: 100 };
          }
          if (parsed.drafting.globalTierCardSize === undefined) {
            parsed.drafting.globalTierCardSize = 100;
          }
          if (parsed.drafting.normalCardSize === undefined) {
            parsed.drafting.normalCardSize = 100;
          }
          if (parsed.drafting.unavailableCardSize === undefined) {
            parsed.drafting.unavailableCardSize = 83;
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
  function applyCardSizePreset(preset, module = "pool") {
    const presetConfig = PRESETS[preset];
    if (!presetConfig) return;

    settings.value[module].cardSizePreset = preset;

    if (preset !== "custom") {
      // Apply preset values
      settings.value[module].normalCardSize = presetConfig.normalCardSize;
      settings.value[module].unavailableCardSize =
        presetConfig.unavailableCardSize;
      if (settings.value[module].highlightCardSize !== undefined) {
        settings.value[module].highlightCardSize = presetConfig.highlightCardSize;
      }
      settings.value[module].globalTierCardSize = presetConfig.highlightCardSize;
    }

    saveSettings();
  }

  // NEW: Set whether to use global tier size or per-tier
  function setUseGlobalTierSize(useGlobal, module = "pool") {
    settings.value[module].useGlobalTierSize = useGlobal;
    saveSettings();
  }

  // NEW: Update tier card size (global or per-tier)
  function updateTierCardSize(tierId, value, module = "pool") {
    if (settings.value[module].useGlobalTierSize) {
      settings.value[module].globalTierCardSize = value;
      if (settings.value[module].highlightCardSize !== undefined) {
        settings.value[module].highlightCardSize = value;
      }
    } else {
      settings.value[module].tierCardSizes[tierId] = value;
    }
    saveSettings();
  }

  // NEW: Get effective tier card size for a specific tier
  function getTierCardSize(tierId, module = "pool") {
    if (settings.value[module].useGlobalTierSize) {
      return settings.value[module].globalTierCardSize;
    }
    return (
      settings.value[module].tierCardSizes[tierId] ||
      settings.value[module].globalTierCardSize
    );
  }

  // NEW: Initialize tier card sizes for new tiers
  function initializeTierCardSize(tierId, module = "pool") {
    if (!settings.value[module].tierCardSizes[tierId]) {
      settings.value[module].tierCardSizes[tierId] =
        settings.value[module].globalTierCardSize;
      saveSettings();
    }
  }

  // NEW: Remove tier card size when tier is deleted
  function removeTierCardSize(tierId, module = "pool") {
    if (settings.value[module].tierCardSizes[tierId]) {
      delete settings.value[module].tierCardSizes[tierId];
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
        integrateUnavailableChampions: false,
        disableDraftDeletionWarning: false,
        tierHighlightMode: "sort",
        pickedMode: "default",
        championGridZoomIndex: 4,
        championGridGap: 6,
        cardSizeSource: "pool",
        cardSizePreset: "compact",
        useGlobalTierSize: true,
        tierCardSizes: { op: 100, highlight: 100 },
        globalTierCardSize: 100,
        normalCardSize: 100,
        unavailableCardSize: 83,
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

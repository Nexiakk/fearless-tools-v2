import { defineStore } from "pinia";
import { ref, computed } from "vue";

/**
 * Single source of truth for default settings
 *
 * ✅ THIS IS THE ONLY PLACE WHERE DEFAULTS ARE DEFINED
 * ✅ Change value here once - it works everywhere: initial state, load merge, reset
 * ✅ Automatic backwards compatibility for ALL new settings
 */
const DEFAULT_SETTINGS = Object.freeze({
  pool: {
    compactMode: false, // Deprecated
    normalCardSize: 83,
    highlightCardSize: 100,
    unavailableCardSize: 83,
    disableAnimations: false,
    centerCards: true,
    enableSearch: false,
    showEventHistory: true,
    cardSizePreset: "compact",
    useGlobalTierSize: true,
    tierCardSizes: {
      op: 100,
      highlight: 100,
    },
    globalTierCardSize: 100,
    unavailableChampionsGrouping: "top",
    tierDisplayMode: "individual-borders",
  },
  drafting: {
    integrateUnavailableChampions: false, // Deprecated
    disableDraftDeletionWarning: false,
    tierHighlightMode: "sort",
    pickedMode: "default",
    championGridZoomIndex: 3,
    championGridGap: 13,
    cardSizeSource: "pool",
    cardSizePreset: "compact",
    useGlobalTierSize: true,
    tierCardSizes: {
      op: 100,
      highlight: 100,
    },
    globalTierCardSize: 100,
    normalCardSize: 100,
    unavailableCardSize: 83,
    tierDisplayMode: "individual-borders",
  },
});

/**
 * Card Size Preset configurations (shared across all modules)
 */
const PRESETS = Object.freeze({
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
  custom: {},
});

/**
 * Recursive deep merge utility
 * Automatically fills missing properties from defaults
 * Preserves existing values, only adds missing ones
 */
function deepMergeDefaults(target, defaults) {
  const result = { ...defaults };

  for (const key in target) {
    if (target[key] === undefined || target[key] === null) continue;

    if (
      typeof target[key] === "object" &&
      target[key] !== null &&
      !Array.isArray(target[key]) &&
      typeof defaults[key] === "object" &&
      defaults[key] !== null
    ) {
      result[key] = deepMergeDefaults(target[key], defaults[key]);
    } else {
      result[key] = target[key];
    }
  }

  return result;
}

/**
 * Migrate legacy settings to new structure
 * Handles all old properties and converts them to current schema
 */
function runMigrations(settings) {
  // Migrate legacy compactMode -> normalCardSize
  if (settings.pool.compactMode !== undefined && settings.pool.normalCardSize === undefined) {
    settings.pool.normalCardSize = settings.pool.compactMode ? 83 : 100;
  }

  // Auto-detect preset for existing users
  if (settings.pool.cardSizePreset === undefined) {
    if (settings.pool.normalCardSize === 100) {
      settings.pool.cardSizePreset = "standard";
    } else if (settings.pool.normalCardSize === 83) {
      settings.pool.cardSizePreset = "compact";
    } else {
      settings.pool.cardSizePreset = "custom";
    }
  }

  // Migrate legacy highlightCardSize -> globalTierCardSize
  if (settings.pool.globalTierCardSize === undefined && settings.pool.highlightCardSize !== undefined) {
    settings.pool.globalTierCardSize = settings.pool.highlightCardSize;
  }

  return settings;
}

export const useSettingsStore = defineStore("settings", () => {
  // State
  const settings = ref(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
  const isSettingsOpen = ref(false);
  const settingsTab = ref("pool");

  // Actions
  function loadSettings() {
    const saved = localStorage.getItem("fearlessSettings");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);

      // ✅ Automatic deep merge with defaults - NO MORE MANUAL IF CHECKS!
      // All new settings will automatically get their default values
      let merged = deepMergeDefaults(parsed, DEFAULT_SETTINGS);

      // Run migrations for legacy formats
      merged = runMigrations(merged);

      settings.value = merged;
    } catch (error) {
      console.error("Error loading settings:", error);
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

  /**
   * ✅ Universal update function
   * Works for ANY setting at any depth with dot notation
   *
   * Usage: updateSetting('pool.disableAnimations', true)
   * Usage: updateSetting('drafting.tierCardSizes.op', 110)
   */
  function updateSetting(path, value) {
    const keys = path.split(".");
    let current = settings.value;

    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    saveSettings();
  }

  // Legacy helpers for backwards compatibility
  function updatePoolSetting(key, value) {
    updateSetting(`pool.${key}`, value);
  }

  function updateDraftingSetting(key, value) {
    updateSetting(`drafting.${key}`, value);
  }

  function applyCardSizePreset(preset, module = "pool") {
    const presetConfig = PRESETS[preset];
    if (!presetConfig) return;

    settings.value[module].cardSizePreset = preset;

    if (preset !== "custom") {
      // Apply preset values
      settings.value[module].normalCardSize = presetConfig.normalCardSize;
      settings.value[module].unavailableCardSize = presetConfig.unavailableCardSize;

      if (settings.value[module].highlightCardSize !== undefined) {
        settings.value[module].highlightCardSize = presetConfig.highlightCardSize;
      }

      settings.value[module].globalTierCardSize = presetConfig.highlightCardSize;
    }

    saveSettings();
  }

  function setUseGlobalTierSize(useGlobal, module = "pool") {
    settings.value[module].useGlobalTierSize = useGlobal;
    saveSettings();
  }

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

  function getTierCardSize(tierId, module = "pool") {
    if (settings.value[module].useGlobalTierSize) {
      return settings.value[module].globalTierCardSize;
    }

    return (
      settings.value[module].tierCardSizes[tierId] ||
      settings.value[module].globalTierCardSize
    );
  }

  function initializeTierCardSize(tierId, module = "pool") {
    if (!settings.value[module].tierCardSizes[tierId]) {
      settings.value[module].tierCardSizes[tierId] =
        settings.value[module].globalTierCardSize;
      saveSettings();
    }
  }

  function removeTierCardSize(tierId, module = "pool") {
    if (settings.value[module].tierCardSizes[tierId]) {
      delete settings.value[module].tierCardSizes[tierId];
      saveSettings();
    }
  }

  function resetSettings() {
    // ✅ Reset directly from DEFAULT_SETTINGS - no more duplication!
    settings.value = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    saveSettings();
  }

  // Initialize
  loadSettings();

  return {
    // State
    settings,
    isSettingsOpen,
    settingsTab,

    // Constants
    DEFAULT_SETTINGS,
    PRESETS,

    // Actions
    loadSettings,
    saveSettings,
    openSettings,
    closeSettings,
    updateSetting,
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
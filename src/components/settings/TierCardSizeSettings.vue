<template>
  <div class="tier-card-settings">
    <!-- Header with Global Toggle -->
    <div class="tier-settings-header">
      <div class="tier-settings-title">
        <svg class="tier-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <span>Tier Cards</span>
      </div>
      <div class="global-toggle">
        <span class="toggle-label">{{ useGlobal ? 'Global' : 'Per-Tier' }}</span>
        <Switch
          :model-value="useGlobal"
          @update:model-value="toggleGlobal"
        />
      </div>
    </div>

    <!-- Global Slider (when useGlobal is true) -->
    <div v-if="useGlobal" class="tier-slider-section">
      <div class="slider-header">
        <span class="slider-label">All Tiers</span>
        <span class="slider-value">{{ globalSize }}%</span>
      </div>
      <Slider
        v-model="globalSizeModel"
        :min="50"
        :max="200"
        :step="1"
        class="w-full"
      />
    </div>

    <!-- Per-Tier Sliders (when useGlobal is false) -->
    <div v-else class="tier-sliders-list">
      <div
        v-for="tier in sortedTiers"
        :key="tier.id"
        class="tier-slider-item"
      >
        <div class="slider-header">
          <div class="tier-label-with-color">
            <span
              class="tier-color-indicator"
              :style="{ backgroundColor: tier.color }"
            />
            <span class="slider-label">{{ tier.name }}</span>
          </div>
          <span class="slider-value">{{ getTierSize(tier.id) }}%</span>
        </div>
        <Slider
          :model-value="[getTierSize(tier.id)]"
          @update:model-value="(val) => updateTierSize(tier.id, val[0])"
          :min="50"
          :max="200"
          :step="1"
          class="w-full"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { useWorkspaceTiersStore } from '@/stores/workspaceTiers';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

const settingsStore = useSettingsStore();
const workspaceTiersStore = useWorkspaceTiersStore();

// Global toggle state
const useGlobal = computed({
  get: () => settingsStore.settings.pool.useGlobalTierSize,
  set: (value) => settingsStore.setUseGlobalTierSize(value)
});

// Global size
const globalSize = computed(() => settingsStore.settings.pool.globalTierCardSize);

const globalSizeModel = computed({
  get: () => [globalSize.value],
  set: (value) => {
    settingsStore.updateTierCardSize('global', value[0]);
  }
});

// Get sorted tiers from workspace tiers store
const sortedTiers = computed(() => workspaceTiersStore.sortedTiers);

// Get tier size (per-tier or fallback to global)
function getTierSize(tierId) {
  return settingsStore.getTierCardSize(tierId);
}

// Update tier size
function updateTierSize(tierId, value) {
  settingsStore.updateTierCardSize(tierId, value);
}

// Toggle global/per-tier mode
function toggleGlobal(value) {
  settingsStore.setUseGlobalTierSize(value);

  // If switching to per-tier, ensure all tiers have sizes initialized
  if (!value) {
    sortedTiers.value.forEach(tier => {
      settingsStore.initializeTierCardSize(tier.id);
    });
  }
}
</script>

<style scoped>
.tier-card-settings {
  background: #1e1e1e;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
}

.tier-settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #3a3a3a;
}

.tier-settings-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #e0e0e0;
}

.tier-icon {
  width: 16px;
  height: 16px;
  color: #d97706;
}

.global-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-label {
  font-size: 0.75rem;
  color: #888888;
  min-width: 50px;
  text-align: right;
}

/* Slider Sections */
.tier-slider-section,
.tier-slider-item {
  margin-bottom: 12px;
}

.tier-slider-item:last-child {
  margin-bottom: 0;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.slider-label {
  font-size: 0.8rem;
  color: #aaaaaa;
}

.slider-value {
  font-size: 0.75rem;
  color: #888888;
  font-variant-numeric: tabular-nums;
}

.tier-label-with-color {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tier-color-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tier-sliders-list {
  max-height: 200px;
  overflow-y: auto;
  padding-right: 4px;
}

.tier-sliders-list::-webkit-scrollbar {
  width: 4px;
}

.tier-sliders-list::-webkit-scrollbar-track {
  background: #1e1e1e;
}

.tier-sliders-list::-webkit-scrollbar-thumb {
  background-color: #444444;
  border-radius: 2px;
}

:deep(.slider-track) {
  background: #3a3a3a;
}

:deep(.slider-range) {
  background: #d97706;
}

:deep(.slider-thumb) {
  background: #d97706;
  border-color: #d97706;
}
</style>

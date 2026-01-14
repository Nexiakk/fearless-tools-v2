<template>
  <div
    v-if="adminStore.isEditorModeActive"
    class="tier-selector-container"
  >
    <div class="tier-selector">
      <!-- Header section -->
      <div class="tier-selector-header">
        <div class="header-content">
          <h3 class="text-xs font-semibold text-white/90">CHAMPION TIERS</h3>

          <!-- Status info in header center -->
          <div class="header-status">
            <!-- No Tier Selected State -->
            <div
              v-if="!workspaceTiersStore.selectedTier"
              class="no-selection-notice"
            >
              <svg class="w-3 h-3 text-gray-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-xs text-gray-500/80 ml-1">Select a tier</span>
            </div>

            <!-- Selected Tier Info -->
            <div
              v-else
              class="selected-tier-info"
            >
              <div class="selected-tier-display" :style="getTierPreviewStyles(workspaceTiersStore.selectedTier)">
                <span class="text-xs font-medium text-white">
                  {{ workspaceTiersStore.selectedTier.name }}
                </span>
              </div>
              <span class="text-xs text-gray-500/80 ml-2">Active</span>
            </div>
          </div>

          <button
            @click="$emit('openTierManager')"
            class="tier-manager-button"
            title="Manage Tiers"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Main content area -->
      <div class="tier-selector-content">
        <!-- Tier items in horizontal layout -->
        <div class="tier-items-row">
          <button
            v-for="tier in workspaceTiersStore.sortedTiers"
            :key="tier.id"
            @click="selectTier(tier.id)"
            class="tier-item"
            :class="getTierItemClasses(tier)"
            :style="getSelectedStyles(tier)"
            :data-selected="workspaceTiersStore.selectedTierId === tier.id"
          >
            <!-- Style Preview -->
            <div class="tier-preview" :style="getTierPreviewStyles(tier)">
            </div>

            <!-- Tier Info -->
            <div class="tier-info">
              <div class="tier-name text-sm font-medium text-white/95">
                {{ tier.name }}
              </div>
              <div class="tier-meta text-xs text-gray-400/80">
                {{ Object.keys(tier.champions || {}).length }} champions
              </div>
            </div>
          </button>
        </div>


      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useWorkspaceTiersStore } from '@/stores/workspaceTiers'
import { useAdminStore } from '@/stores/admin'

const emit = defineEmits(['openTierManager'])

const workspaceTiersStore = useWorkspaceTiersStore()
const adminStore = useAdminStore()

// Methods
function selectTier(tierId) {
  // If clicking the currently selected tier, unselect it
  if (workspaceTiersStore.selectedTierId === tierId) {
    workspaceTiersStore.selectTier(null)
  } else {
    workspaceTiersStore.selectTier(tierId)
  }
}

function getTierItemClasses(tier) {
  const isSelected = workspaceTiersStore.selectedTierId === tier.id
  return {
    'p-2 rounded-md border transition-all duration-200 flex items-center gap-2 hover:bg-gray-700': true,
    'border-gray-600 bg-gray-800/50': !isSelected,
    'opacity-75': tier.isDefault && workspaceTiersStore.hasWorkspaceTiers
  }
}

function getSelectedStyles(tier) {
  const isSelected = workspaceTiersStore.selectedTierId === tier.id
  if (!isSelected) return {}

  return {
    backgroundColor: `${tier.color}33`, // 0.2 alpha
    borderColor: `${tier.color}80` // 0.5 alpha
  }
}

function getTierPreviewStyles(tier) {
  const baseStyles = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500'
  }

  if (tier.style === 'border') {
    return {
      ...baseStyles,
      border: `2px solid ${tier.color}`,
      backgroundColor: `${tier.color}1a`, // 0.1 alpha
      color: tier.color
    }
  } else {
    return {
      ...baseStyles,
      boxShadow: `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 2px ${tier.color}4d`, // 0.3 alpha
      backgroundColor: `${tier.color}33`, // 0.2 alpha
      color: tier.color
    }
  }
}


</script>

<style scoped>
.tier-selector-container {
  width: 100%;
  margin-bottom: 0.5rem;
}

.tier-selector {
  width: 100%;
  background: linear-gradient(135deg, #1a1a1a 0%, #141414 100%);
  border: 1px solid rgba(42, 42, 42, 0.8);
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
  overflow: hidden;
}

.tier-selector-header {
  padding: 4px 16px;
  border-bottom: 1px solid rgba(42, 42, 42, 0.6);
  background: linear-gradient(135deg, #1f1f1f 0%, #181818 100%);
  position: relative;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
}

.header-status {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.tier-selector-content {
  padding: 2px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Horizontal tier items row */
.tier-items-row {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 4px 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(75, 75, 75, 0.6) transparent;
}

.tier-items-row::-webkit-scrollbar {
  height: 4px;
}

.tier-items-row::-webkit-scrollbar-track {
  background: transparent;
}

.tier-items-row::-webkit-scrollbar-thumb {
  background: rgba(75, 75, 75, 0.6);
  border-radius: 2px;
}

.tier-items-row::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 0.8);
}

.tier-item {
  flex-shrink: 0;
  padding: 12px 16px;
  background: rgba(31, 31, 31, 0.6);
  border: 1px solid rgba(75, 75, 75, 0.3);
  border-radius: 8px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  min-width: 140px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  backdrop-filter: blur(4px);
  position: relative;
}

.tier-item:hover {
  background: rgba(55, 55, 55, 0.8);
  border-color: rgba(156, 163, 175, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.tier-preview {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.tier-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
}

.tier-name {
  font-weight: 600;
  font-size: 12px;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.tier-meta {
  font-size: 10px;
  opacity: 0.75;
  line-height: 1.2;
}

/* Status info inline alignment */
.no-selection-notice,
.selected-tier-info {
  display: flex;
  align-items: center;
  gap: 4px;
}



/* Button styling */
.tier-manager-button {
  width: 24px;
  height: 24px;
  background: rgba(55, 55, 55, 0.8);
  border: 1px solid rgba(75, 75, 75, 0.4);
  border-radius: 6px;
  color: rgba(209, 213, 219, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}

.tier-manager-button:hover {
  background: rgba(75, 75, 75, 0.9);
  border-color: rgba(156, 163, 175, 0.5);
  color: white;
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .tier-selector-content {
    padding: 12px 16px;
  }

  .tier-selector-header {
    padding: 12px 16px;
  }

  .tier-items-row {
    gap: 8px;
  }

  .tier-item {
    min-width: 120px;
    padding: 10px 12px;
    gap: 8px;
  }

  .tier-preview {
    width: 18px;
    height: 18px;
  }

  .tier-name {
    font-size: 11px;
  }

  .tier-meta {
    font-size: 9px;
  }
}
</style>

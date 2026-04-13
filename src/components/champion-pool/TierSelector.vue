<template>
  <div
    v-if="adminStore.isEditorModeActive"
    class="tier-selector-container"
  >
    <div class="tier-selector">
      <!-- Header section -->
      <div class="tier-selector-header">
        <div class="header-content">
          <div class="header-left">
            <div class="header-dot"></div>
            <h3 class="text-xs font-semibold text-white/90">CHAMPION TIERS</h3>
          </div>

          <div class="header-actions">
            <button
              @click="toggleCollapsed"
              class="tier-action-button"
              title="Collapse"
            >
              <svg
                class="w-3.5 h-3.5 transition-transform duration-300"
                :class="{ 'rotate-180': isCollapsed }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <button
              @click="$emit('openTierManager')"
              class="tier-action-button"
              title="Manage Tiers"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Main content area -->
      <div
        class="tier-selector-content"
        :class="{ 'collapsed': isCollapsed }"
      >
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

            <!-- Selected indicator -->
            <div
              class="tier-active-indicator absolute bottom-0 left-1/2 transform -translate-x-1/2 h-0.5 rounded-full"
              :style="{
                width: workspaceTiersStore.selectedTierId === tier.id ? '60%' : '0%',
                backgroundColor: tier.color,
                opacity: workspaceTiersStore.selectedTierId === tier.id ? 1 : 0,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }"
            ></div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWorkspaceTiersStore } from '@/stores/workspaceTiers'
import { useAdminStore } from '@/stores/admin'

const emit = defineEmits(['openTierManager'])

const workspaceTiersStore = useWorkspaceTiersStore()
const adminStore = useAdminStore()

const isCollapsed = ref(false)

// Methods
function toggleCollapsed() {
  isCollapsed.value = !isCollapsed.value
}

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
    borderColor: `${tier.color}80`, // 0.5 alpha
    transform: 'translateY(-2px)',
    boxShadow: `0 8px 24px ${tier.color}30, 0 2px 8px ${tier.color}20`
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

  switch (tier.style) {
    case 'border':
      return {
        ...baseStyles,
        border: `2px solid ${tier.color}`,
        backgroundColor: `${tier.color}1a`,
        color: tier.color
      }
      
    case 'shadow':
    case 'highlight':
      return {
        ...baseStyles,
        boxShadow: `0 0 0 2px ${tier.color}4d`,
        backgroundColor: `${tier.color}33`,
        color: tier.color
      }
      
    case 'solid':
      return {
        ...baseStyles,
        border: `2px solid ${tier.color}`,
        backgroundColor: `${tier.color}40`,
        color: tier.color
      }
      
    case 'gradient':
      return {
        ...baseStyles,
        border: `2px solid ${tier.color}`,
        background: `linear-gradient(180deg, ${tier.color}30 0%, ${tier.color}10 100%)`,
        color: tier.color
      }
      
    case 'underlined':
      return {
        ...baseStyles,
        borderBottom: `3px solid ${tier.color}`,
        color: tier.color
      }
      
    case 'left-bar':
      return {
        ...baseStyles,
        borderLeft: `4px solid ${tier.color}`,
        backgroundColor: `${tier.color}15`,
        color: tier.color
      }
      
    case 'corner-ribbon':
      return {
        ...baseStyles,
        borderTop: `2px solid ${tier.color}`,
        borderRight: `2px solid ${tier.color}`,
        borderTopRightRadius: '6px',
        background: `linear-gradient(135deg, ${tier.color}25 0%, transparent 50%)`,
        color: tier.color
      }
      
    case 'glow-pulse':
      return {
        ...baseStyles,
        border: `2px solid ${tier.color}`,
        boxShadow: `0 0 8px ${tier.color}80, 0 0 16px ${tier.color}40`,
        backgroundColor: `${tier.color}20`,
        color: tier.color
      }
      
    default:
      return {
        ...baseStyles,
        border: `2px solid ${tier.color}`,
        backgroundColor: `${tier.color}1a`,
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
  background: linear-gradient(135deg, rgba(26, 26, 26, 0.95) 0%, rgba(20, 20, 20, 0.98) 100%);
  border: 1px solid rgba(55, 55, 55, 0.6);
  border-radius: 0.75rem;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(16px);
  overflow: hidden;
  position: relative;
}

.tier-selector::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 50%);
  pointer-events: none;
  border-radius: 0.75rem;
}

.tier-selector-header {
  padding: 8px 14px;
  position: relative;
  border-bottom: 1px solid rgba(55, 55, 55, 0.3);
  background: linear-gradient(180deg, rgba(40,40,40,0.3) 0%, rgba(30,30,30,0.1) 100%);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  box-shadow: 0 0 8px #f59e0b60;
  animation: headerPulse 3s infinite ease-in-out;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-content h3 {
  font-family: 'Plus Jakarta Sans', sans-serif;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.tier-selector-content {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 500px;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.tier-selector-content.collapsed {
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  opacity: 0;
}

/* Horizontal tier items row */
.tier-items-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(85, 85, 85, 0.6) transparent;
}

.tier-items-row::-webkit-scrollbar {
  height: 5px;
}

.tier-items-row::-webkit-scrollbar-track {
  background: transparent;
}

.tier-items-row::-webkit-scrollbar-thumb {
  background: rgba(85, 85, 85, 0.6);
  border-radius: 3px;
}

.tier-items-row::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 0.8);
}

.tier-item {
  flex-shrink: 0;
  padding: 8px 10px;
  background: rgba(35, 35, 35, 0.7);
  border: 1px solid rgba(65, 65, 65, 0.4);
  border-radius: 8px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-width: 130px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  backdrop-filter: blur(8px);
  position: relative;
  overflow: hidden;
}

.tier-item::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.tier-item:hover::before {
  opacity: 1;
}

.tier-item:hover {
  background: rgba(55, 55, 55, 0.85);
  border-color: rgba(156, 163, 175, 0.5);
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.03) inset;
}

.tier-preview {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
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
  text-shadow: 0 1px 1px rgba(0,0,0,0.2);
}

.tier-meta {
  font-size: 10px;
  opacity: 0.75;
  line-height: 1.2;
}

/* Button styling */
.tier-action-button {
  width: 26px;
  height: 26px;
  background: rgba(45, 45, 45, 0.7);
  border: 1px solid rgba(65, 65, 65, 0.4);
  border-radius: 7px;
  color: rgba(209, 213, 219, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}

.tier-action-button:hover {
  background: rgba(65, 65, 65, 0.9);
  border-color: rgba(156, 163, 175, 0.5);
  color: white;
  transform: scale(1.06);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
}

@keyframes headerPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.9); }
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
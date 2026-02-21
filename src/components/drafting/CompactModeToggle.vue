<template>
  <div class="compact-mode-toggle">
    <div class="mode-toggle-buttons">
      <button
        @click="setMode('sandbox')"
        :class="[
          'mode-button',
          { 'active': currentMode === 'sandbox' }
        ]"
        title="Sandbox Mode"
      >
        <svg class="mode-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </button>

      <button
        @click="setMode('fearless-sync')"
        :class="[
          'mode-button',
          { 'active': currentMode === 'fearless-sync' }
        ]"
        title="Fearless Sync Mode"
      >
        <svg class="mode-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      </button>
    </div>
    
    <!-- Connection status indicator for sync mode -->
    <div v-if="currentMode === 'fearless-sync'" class="connection-status">
      <div class="status-indicator" :class="{ 'connected': isConnected }"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useDraftingStore } from '@/stores/drafting'

const draftingStore = useDraftingStore()

const currentMode = computed(() => draftingStore.draftingMode)

const isConnected = computed(() => {
  // Check if LCU sync service is active via global reference
  return window.lcuSyncService?.isInSyncMode() || false
})

function setMode(mode) {
  draftingStore.draftingMode = mode
}
</script>

<style scoped>
.compact-mode-toggle {
  display: flex;
  align-items: center;
  gap: 0.125rem;
}

.mode-toggle-buttons {
  display: flex;
  background: #374151;
  border-radius: 0.25rem;
  overflow: hidden;
  border: 1px solid #4b5563;
}

.mode-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.1875rem;
  background: transparent;
  color: #9ca3af;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 0.5rem;
  font-weight: 500;
  white-space: nowrap;
}

.mode-button:hover {
  background: #4b5563;
  color: #e5e7eb;
}

.mode-button.active {
  background: #3b82f6;
  color: white;
}

.mode-button.active:hover {
  background: #2563eb;
}

.mode-button:first-child {
  border-right: 1px solid #4b5563;
}

.mode-icon {
  flex-shrink: 0;
}

.connection-status {
  display: flex;
  align-items: center;
  margin-left: 0.125rem;
}

.status-indicator {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #6b7280;
  transition: background-color 0.2s ease;
}

.status-indicator.connected {
  background: #10b981;
}
</style>

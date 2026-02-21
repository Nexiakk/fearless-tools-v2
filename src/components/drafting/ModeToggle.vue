<template>
  <div class="mode-toggle">
    <div class="mode-toggle-header">
      <h4 class="mode-toggle-title">Drafting Mode</h4>
    </div>
    <div class="mode-toggle-content">
      <div class="mode-options">
        <button
          @click="setMode('sandbox')"
          :class="['mode-option', { 'active': currentMode === 'sandbox' }]"
        >
          <div class="mode-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div class="mode-info">
            <div class="mode-name">Sandbox</div>
            <div class="mode-description">Full editing freedom</div>
          </div>
        </button>

        <button
          @click="setMode('fearless-sync')"
          :class="['mode-option', { 'active': currentMode === 'fearless-sync' }]"
        >
          <div class="mode-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </div>
          <div class="mode-info">
            <div class="mode-name">Fearless Sync</div>
            <div class="mode-description">LCU integration active</div>
          </div>
        </button>
      </div>

      <div v-if="currentMode === 'fearless-sync'" class="sync-status">
        <div class="sync-indicator">
          <div class="sync-dot" :class="{ 'active': isConnected }"></div>
          <span class="sync-text">
            {{ isConnected ? 'Connected to LCU' : 'Waiting for LCU...' }}
          </span>
        </div>
      </div>
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
.mode-toggle {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 0.5rem;
  overflow: hidden;
}

.mode-toggle-header {
  padding: 1rem;
  border-bottom: 1px solid #374151;
}

.mode-toggle-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #d1d5db;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.mode-toggle-content {
  padding: 1rem;
}

.mode-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #374151;
  border: 2px solid transparent;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.mode-option:hover {
  background: #4b5563;
  border-color: #60a5fa;
}

.mode-option.active {
  background: #3b82f6;
  border-color: #2563eb;
  color: white;
}

.mode-option.active:hover {
  background: #2563eb;
}

.mode-icon {
  flex-shrink: 0;
  color: #9ca3af;
}

.mode-option.active .mode-icon {
  color: white;
}

.mode-info {
  flex: 1;
}

.mode-name {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.125rem;
}

.mode-description {
  font-size: 0.75rem;
  opacity: 0.8;
}

.sync-status {
  padding-top: 0.75rem;
  border-top: 1px solid #374151;
}

.sync-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6b7280;
  transition: background-color 0.2s ease;
}

.sync-dot.active {
  background: #10b981;
}

.sync-text {
  font-size: 0.75rem;
  color: #9ca3af;
}
</style>

<template>
  <div class="series-manager">
    <div class="series-manager-header">
      <h3 class="series-manager-title">Saved Series ({{ seriesStore.savedSeries.length }})</h3>
      <button
        v-if="seriesStore.hasSeries"
        @click="handleSaveCurrentSeries"
        class="save-series-button"
        :disabled="seriesStore.isSaving"
        title="Save Current Series"
      >
        <svg><use href="#icon-save"></use></svg>
        {{ seriesStore.isSaving ? 'Saving...' : 'Save Series' }}
      </button>
    </div>

    <div class="series-manager-content">
      <p v-if="seriesStore.isLoadingSeries" class="loading-text">
        Loading saved series...
      </p>
      <p v-else-if="seriesStore.savedSeries.length === 0" class="empty-text">
        No series saved yet.
        <br />
        <span class="empty-hint">Create a series to get started.</span>
      </p>
      <div v-else class="series-list">
        <div
          v-for="series in seriesStore.savedSeries"
          :key="series.id"
          class="series-item"
          :class="{ 'active-series': seriesStore.currentSeries?.id === series.id }"
        >
          <div class="series-item-content" @click="handleLoadSeries(series.id)">
            <div class="series-item-header">
              <span class="series-item-name">{{ series.name || 'Unnamed Series' }}</span>
              <span v-if="seriesStore.currentSeries?.id === series.id" class="active-badge">Active</span>
            </div>
            <div class="series-item-info">
              <span class="series-item-games">
                {{ series.games?.length || 0 }} {{ series.games?.length === 1 ? 'Game' : 'Games' }}
              </span>
              <span v-if="series.updatedAt" class="series-item-date">
                Updated: {{ formatDate(series.updatedAt) }}
              </span>
            </div>
            <!-- Series Preview -->
            <div v-if="series.games && series.games.length > 0" class="series-preview">
              <div
                v-for="(game, idx) in series.games.slice(0, 3)"
                :key="game.id"
                class="preview-game"
              >
                <span class="preview-game-number">G{{ game.gameNumber }}</span>
                <span class="preview-draft-count">{{ game.drafts?.length || 0 }} drafts</span>
              </div>
              <span v-if="series.games.length > 3" class="preview-more">
                +{{ series.games.length - 3 }} more
              </span>
            </div>
          </div>
          <div class="series-item-actions">
            <button
              @click.stop="handleLoadSeries(series.id)"
              class="action-button load-button"
              title="Load Series"
            >
              <svg><use href="#icon-load"></use></svg>
            </button>
            <button
              @click.stop="handleDeleteSeries(series.id, series.name)"
              class="action-button delete-button"
              title="Delete Series"
            >
              <svg><use href="#icon-trash"></use></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useSeriesStore } from '@/stores/series'
import { useConfirmationStore } from '@/stores/confirmation'

const seriesStore = useSeriesStore()
const confirmationStore = useConfirmationStore()

function formatDate(date) {
  if (!date) return 'Unknown'
  
  const d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date))
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return d.toLocaleDateString('en-US')
}

async function handleSaveCurrentSeries() {
  if (!seriesStore.hasSeries) return
  
  try {
    seriesStore.queueSave()
    // Show success feedback (the store handles the actual save)
    // You could add a toast notification here
  } catch (error) {
    console.error('Error saving series:', error)
    alert('Failed to save series. See console for details.')
  }
}

async function handleLoadSeries(seriesId) {
  try {
    await seriesStore.loadSeries(seriesId)
  } catch (error) {
    console.error('Error loading series:', error)
    alert('Failed to load series. See console for details.')
  }
}

function handleDeleteSeries(seriesId, seriesName) {
  confirmationStore.open({
    message: `Are you sure you want to permanently delete '${seriesName || 'this series'}'? This will delete all games, drafts, and notes associated with it. This cannot be undone.`,
    confirmAction: async () => {
      try {
        await seriesStore.deleteSeries(seriesId)
      } catch (error) {
        console.error('Error deleting series:', error)
        alert('Failed to delete series. See console for details.')
      }
    },
    isDanger: true
  })
}
</script>

<style scoped>
.series-manager {
  background: #1f2937;
  border-left: 1px solid #374151;
  width: 300px;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.series-manager-header {
  padding: 1rem;
  border-bottom: 1px solid #374151;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.series-manager-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #f9fafb;
}

.save-series-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background-color 0.2s;
  white-space: nowrap;
}

.save-series-button:hover:not(:disabled) {
  background: #2563eb;
}

.save-series-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.save-series-button svg {
  width: 16px;
  height: 16px;
}

.series-manager-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.loading-text,
.empty-text {
  text-align: center;
  padding: 2rem 1rem;
  color: #9ca3af;
  font-size: 0.875rem;
}

.empty-hint {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.5rem;
  display: block;
}

.series-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.series-item {
  background: #374151;
  border: 1px solid #4b5563;
  border-radius: 0.5rem;
  padding: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  transition: border-color 0.2s, background-color 0.2s;
}

.series-item:hover {
  border-color: #60a5fa;
  background: #3a3f4a;
}

.series-item.active-series {
  border-color: #3b82f6;
  background: #1e3a5f;
}

.series-item-content {
  flex: 1;
  cursor: pointer;
  min-width: 0;
}

.series-item-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.series-item-name {
  font-weight: 600;
  color: #f9fafb;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active-badge {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  background: #3b82f6;
  color: white;
  border-radius: 0.25rem;
  font-weight: 500;
  flex-shrink: 0;
}

.series-item-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.series-item-games {
  font-size: 0.75rem;
  color: #d1d5db;
}

.series-item-date {
  font-size: 0.75rem;
  color: #9ca3af;
}

.series-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #4b5563;
}

.preview-game {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #9ca3af;
  background: #1f2937;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.preview-game-number {
  font-weight: 600;
  color: #d1d5db;
}

.preview-draft-count {
  color: #6b7280;
}

.preview-more {
  font-size: 0.75rem;
  color: #6b7280;
  align-self: center;
}

.series-item-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-shrink: 0;
}

.action-button {
  background: transparent;
  border: 1px solid #4b5563;
  color: #9ca3af;
  padding: 0.375rem;
  border-radius: 0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  width: 28px;
  height: 28px;
}

.action-button:hover {
  border-color: #60a5fa;
  color: #f9fafb;
  background: #374151;
}

.load-button:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.delete-button:hover {
  border-color: #ef4444;
  color: #ef4444;
}

.action-button svg {
  width: 14px;
  height: 14px;
}

.series-manager-content::-webkit-scrollbar {
  width: 6px;
}

.series-manager-content::-webkit-scrollbar-track {
  background: #1f2937;
}

.series-manager-content::-webkit-scrollbar-thumb {
  background: #4b5563;
  border-radius: 3px;
}

.series-manager-content::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}
</style>



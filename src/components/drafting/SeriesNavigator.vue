<template>
  <div class="series-navigator">
    <!-- Series Manager Header with Save/Reset buttons -->
    <div class="series-manager-header">
      <h3 class="series-manager-title">Saved Series</h3>
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

    <!-- Games Section -->
    <div class="games-section">
      <h4 class="section-title">Games</h4>
      <div v-if="isFearlessSyncMode" class="mode-notice">
        Series loading disabled in Fearless Sync mode
      </div>
      <div class="games-list">
        <button
          v-for="gameNumber in 5"
          :key="gameNumber"
          @click="handleGameClick(gameNumber)"
          class="game-button"
          :class="{
            'active': isGameActive(gameNumber),
            'has-changes': gameHasChanges(gameNumber),
            'disabled': isFearlessSyncMode
          }"
          :disabled="isFearlessSyncMode"
          :title="isFearlessSyncMode ? 'Series loading disabled in Fearless Sync mode' : `Game ${gameNumber}`"
        >
          Game {{ gameNumber }}
          <span v-if="gameHasChanges(gameNumber)" class="changes-indicator"></span>
        </button>
      </div>
    </div>

    <!-- Draft Iterations Section -->
    <div class="drafts-section">
      <h4 class="section-title">Drafts</h4>
      <div class="drafts-list">
        <button
          v-for="(draft, index) in currentGameDrafts"
          :key="draft.id || index"
          @click="handleDraftClick(index)"
          class="draft-iteration-button"
          :class="{ 'active': isDraftActive(index) }"
          :title="`Draft ${index + 1}`"
        >
          {{ index + 1 }}
        </button>
        <button
          @click="handleAddDraft"
          class="draft-iteration-button add-draft-button"
          title="Add Draft Iteration"
        >
          +
        </button>
      </div>
    </div>

    <!-- Mode Toggle Section -->
    <div class="mode-section">
      <ModeToggle />
    </div>

    <!-- Reset Button at Bottom -->
    <div class="reset-section">
      <button
        @click="handleReset"
        class="reset-button"
        title="Reset Series"
      >
        Reset Series
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSeriesStore } from '@/stores/series'
import { useConfirmationStore } from '@/stores/confirmation'
import { useSettingsStore } from '@/stores/settings'
import ModeToggle from './ModeToggle.vue'

const seriesStore = useSeriesStore()
const confirmationStore = useConfirmationStore()
const settingsStore = useSettingsStore()

const currentGameDrafts = computed(() => {
  if (!seriesStore.currentGame) return []
  return seriesStore.currentGame.drafts || []
})

const isFearlessSyncMode = computed(() => settingsStore.settings.drafting?.mode === 'fearless-sync')

function isGameActive(gameNumber) {
  if (!seriesStore.currentGame) return gameNumber === 1
  return seriesStore.currentGame.gameNumber === gameNumber
}

function isDraftActive(index) {
  if (!seriesStore.currentGame) return index === 0
  return seriesStore.currentGame.currentDraftIndex === index
}

function gameHasChanges(gameNumber) {
  if (!seriesStore.currentSeries) return false
  const game = seriesStore.currentSeries.games?.find(g => g.gameNumber === gameNumber)
  return game?.hasChanges || false
}

function handleGameClick(gameNumber) {
  if (!seriesStore.currentSeries) return
  const game = seriesStore.currentSeries.games?.find(g => g.gameNumber === gameNumber)
  if (game && seriesStore.setCurrentGame) {
    seriesStore.setCurrentGame(gameNumber)
  }
}

function handleDraftClick(index) {
  if (!seriesStore.currentGame || !seriesStore.setCurrentDraft) return
  seriesStore.setCurrentDraft(index)
}

function handleAddDraft() {
  if (!seriesStore.currentGame || !seriesStore.addDraftIteration) return
  seriesStore.addDraftIteration()
}

async function handleSave() {
  if (!seriesStore.hasSeries || !seriesStore.saveSeries) return

  try {
    await seriesStore.saveSeries()
  } catch (error) {
    console.error('Error saving series:', error)
    alert('Failed to save series. See console for details.')
  }
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

function handleReset() {
  if (!seriesStore.resetSeries) return
  
  confirmationStore.open({
    message: 'Are you sure you want to reset the current series? This will clear all games, drafts, and notes. This cannot be undone.',
    confirmAction: () => {
      seriesStore.resetSeries()
    },
    isDanger: true
  })
}
</script>

<style scoped>
.series-navigator {
  background: #1f2937;
  border-right: 1px solid #374151;
  width: 280px;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.series-manager-header {
  padding: 1rem;
  border-bottom: 1px solid #374151;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
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

.games-section,
.drafts-section,
.mode-section {
  padding: 1rem;
  border-bottom: 1px solid #374151;
}

.mode-notice {
  font-size: 0.75rem;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  padding: 0.5rem;
  border-radius: 0.25rem;
  margin-bottom: 0.75rem;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.section-title {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #d1d5db;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.games-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.game-button {
  position: relative;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  background-color: #374151;
  color: #e5e7eb;
  border: 1px solid #4b5563;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.game-button:hover {
  background-color: #4b5563;
  border-color: #60a5fa;
}

.game-button.active {
  background-color: #3b82f6;
  color: white;
  border-color: #2563eb;
  font-weight: 600;
}

.game-button.active:hover {
  background-color: #2563eb;
}

.game-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #2d3748;
}

.game-button.disabled:hover {
  background-color: #2d3748;
  border-color: #4b5563;
}

.changes-indicator {
  width: 8px;
  height: 8px;
  background-color: #fbbf24;
  border-radius: 50%;
  flex-shrink: 0;
}

.game-button.active .changes-indicator {
  background-color: white;
}

.drafts-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.draft-iteration-button {
  width: 2rem;
  height: 2rem;
  padding: 0;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: #374151;
  color: #e5e7eb;
  border: 1px solid #4b5563;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.draft-iteration-button:hover {
  background-color: #4b5563;
  border-color: #60a5fa;
}

.draft-iteration-button.active {
  background-color: #3b82f6;
  color: white;
  border-color: #2563eb;
  font-weight: 600;
}

.draft-iteration-button.active:hover {
  background-color: #2563eb;
}

.draft-iteration-button.add-draft-button {
  font-size: 1rem;
  font-weight: 600;
  background-color: #10b981;
  border-color: #059669;
  color: white;
}

.draft-iteration-button.add-draft-button:hover {
  background-color: #059669;
  border-color: #047857;
}

.reset-section {
  padding: 1rem;
  margin-top: auto;
  border-top: 1px solid #374151;
}

.reset-button {
  width: 100%;
  padding: 0.75rem;
  background-color: #dc2626;
  color: white;
  border: 1px solid #b91c1c;
  border-radius: 0.375rem;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  text-align: center;
}

.reset-button:hover {
  background-color: #b91c1c;
  border-color: #991b1b;
}

.series-navigator::-webkit-scrollbar {
  width: 6px;
}

.series-navigator::-webkit-scrollbar-track {
  background: #1f2937;
}

.series-navigator::-webkit-scrollbar-thumb {
  background: #4b5563;
  border-radius: 3px;
}

.series-navigator::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}
</style>

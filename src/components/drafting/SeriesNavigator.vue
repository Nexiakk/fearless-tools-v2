<template>
  <div class="series-navigator">
    <div class="series-navigator-content">
      <!-- Games Row - Centered -->
      <div class="games-row">
        <button
          v-for="gameNumber in 5"
          :key="gameNumber"
          @click="handleGameClick(gameNumber)"
          class="game-button"
          :class="{ 'active': isGameActive(gameNumber), 'has-changes': gameHasChanges(gameNumber) }"
          :title="`Game ${gameNumber}`"
        >
          Game {{ gameNumber }}
          <span v-if="gameHasChanges(gameNumber)" class="changes-indicator"></span>
        </button>
      </div>
      
      <!-- Draft Iterations Row - Directly Under Games -->
      <div class="draft-iterations-row">
        <div class="draft-iterations-container">
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
    </div>
    
    <!-- Actions Row - Right Side -->
    <div class="series-actions">
      <button
        @click="handleSave"
        class="save-button"
        :disabled="seriesStore.isSaving"
        title="Save Series"
      >
        {{ seriesStore.isSaving ? 'Saving...' : 'Save' }}
      </button>
      <button
        @click="handleReset"
        class="reset-button"
        title="Reset Series"
      >
        Reset
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSeriesStore } from '@/stores/series'
import { useConfirmationStore } from '@/stores/confirmation'

const seriesStore = useSeriesStore()
const confirmationStore = useConfirmationStore()

const currentGameDrafts = computed(() => {
  if (!seriesStore.currentGame) return []
  return seriesStore.currentGame.drafts || []
})

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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: #1e1e1e;
  border-bottom: 1px solid #3a3a3a;
  gap: 1rem;
  flex-shrink: 0;
}

.series-navigator-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  gap: 0.5rem;
}

.games-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
}

.game-button {
  position: relative;
  padding: 0.4rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: #282828;
  color: #e0e0e0;
  border: 1px solid #3a3a3a;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.game-button:hover {
  background-color: #333333;
  border-color: #4a4a4a;
}

.game-button.active {
  background-color: #3b82f6;
  color: white;
  border-color: #2563eb;
  border-width: 2px;
  font-weight: 600;
}

.game-button.active:hover {
  background-color: #2563eb;
  border-color: #1d4ed8;
}

.changes-indicator {
  width: 6px;
  height: 6px;
  background-color: #fbbf24;
  border-radius: 50%;
  display: inline-block;
}

.game-button.active .changes-indicator {
  background-color: white;
}

.draft-iterations-row {
  display: flex;
  justify-content: center;
  width: 100%;
}

.draft-iterations-container {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.draft-iteration-button {
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  font-size: 0.7rem;
  font-weight: 500;
  background-color: #282828;
  color: #e0e0e0;
  border: 1px solid #3a3a3a;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.draft-iteration-button:hover {
  background-color: #333333;
  border-color: #4a4a4a;
}

.draft-iteration-button.active {
  background-color: #3b82f6;
  color: white;
  border-color: #2563eb;
  border-width: 2px;
  font-weight: 600;
}

.draft-iteration-button.active:hover {
  background-color: #2563eb;
  border-color: #1d4ed8;
}

.draft-iteration-button.add-draft-button {
  font-size: 0.9rem;
  font-weight: 600;
}

.series-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.save-button,
.reset-button {
  padding: 0.4rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  border: 1px solid;
}

.save-button {
  background-color: #3b82f6;
  color: white;
  border-color: #2563eb;
}

.save-button:hover:not(:disabled) {
  background-color: #2563eb;
  border-color: #1d4ed8;
}

.save-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.reset-button {
  background-color: #282828;
  color: #e0e0e0;
  border-color: #3a3a3a;
}

.reset-button:hover {
  background-color: #333333;
  border-color: #4a4a4a;
}
</style>


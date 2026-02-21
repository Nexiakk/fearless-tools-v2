<template>
  <div class="series-navigator">
    <div class="game-draft-group">
      <div class="current-game-section" v-if="!isFearlessSync">
        <button
          class="current-game-button"
          :class="{ expanded: showAllGames }"
          :title="`Game ${currentGameNumber}`"
        >
          Game {{ currentGameNumber }}
        </button>
        <div class="expanded-games-list">
          <button
            v-for="gameNumber in 5"
            :key="gameNumber"
            @click="handleGameClick(gameNumber)"
            class="expanded-game-button"
            :class="{
              active: isGameActive(gameNumber),
              'has-changes': gameHasChanges(gameNumber) && !isGameActive(gameNumber),
            }"
            :title="`Game ${gameNumber}`"
          >
            Game {{ gameNumber }}
          </button>
        </div>
      </div>
      <div class="draft-iterations-container">
        <button
          v-for="(draft, index) in currentGameDrafts"
          :key="draft.id || index"
          @click="handleDraftClick(index)"
          @contextmenu="handleDraftRightClick($event, index)"
          class="draft-iteration-button"
          :class="{ active: isDraftActive(index) }"
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
    <div class="mode-toggle-section">
      <div class="compact-mode-toggle relative-toggle-wrapper">
        <div class="button-wrapper">
          <button
            @click="toggleFearlessSync"
            :class="['mode-button', { active: isFearlessSync }]"
          >
            Fearless Sync: {{ isFearlessSync ? 'ON' : 'OFF' }}
          </button>
          <TooltipProvider>
            <Tooltip :delayDuration="100">
              <TooltipTrigger asChild>
                <div class="info-badge">?</div>
              </TooltipTrigger>
              <TooltipContent class="max-w-[300px] text-center" side="top">
                <p>When enabled, previously picked champions from the Fearless Pool are being transferred here in real time. The current game selector is locked so you only test different drafting iterations for the same game.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
    <div class="series-actions">
      <button
        @click="handleSave"
        class="save-button"
        :disabled="seriesStore.isSaving"
        title="Save Series"
      >
        {{ seriesStore.isSaving ? "Saving..." : "Save" }}
      </button>
      <button @click="handleReset" class="reset-button" title="Reset Series">
        Reset
      </button>
    </div>
    <DraftDeletionModal ref="draftDeletionModal" />
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useSeriesStore } from "@/stores/series";
import { useConfirmationStore } from "@/stores/confirmation";
import { useSettingsStore } from "@/stores/settings";
import DraftDeletionModal from "@/components/common/DraftDeletionModal.vue";
import ModeToggle from "./ModeToggle.vue";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const seriesStore = useSeriesStore();
const confirmationStore = useConfirmationStore();
const settingsStore = useSettingsStore();

const draftDeletionModal = ref(null);

const showAllGames = ref(false);

const currentGameDrafts = computed(() => {
  if (!seriesStore.currentGame) return [];
  return seriesStore.currentGame.drafts || [];
});

const currentGameNumber = computed(() => {
  return seriesStore.currentGame?.gameNumber || 1;
});

const currentGameHasChanges = computed(() => {
  return gameHasChanges(currentGameNumber.value);
});

const isFearlessSync = computed(
  () => settingsStore.settings.drafting?.integrateUnavailableChampions
);

function toggleFearlessSync() {
  settingsStore.updateDraftingSetting(
    'integrateUnavailableChampions',
    !isFearlessSync.value
  );
}

function toggleGameExpansion() {
  showAllGames.value = !showAllGames.value;
}

function isGameActive(gameNumber) {
  if (!seriesStore.currentGame) return gameNumber === 1;
  return seriesStore.currentGame.gameNumber === gameNumber;
}

function isDraftActive(index) {
  if (!seriesStore.currentGame) return index === 0;
  return seriesStore.currentGame.currentDraftIndex === index;
}

function gameHasChanges(gameNumber) {
  if (!seriesStore.currentSeries) return false;
  const game = seriesStore.currentSeries.games?.find(
    (g) => g.gameNumber === gameNumber
  );
  return game?.hasChanges || false;
}

function handleGameClick(gameNumber) {
  if (!seriesStore.currentSeries) return;
  const game = seriesStore.currentSeries.games?.find(
    (g) => g.gameNumber === gameNumber
  );
  if (game && seriesStore.setCurrentGame) {
    seriesStore.setCurrentGame(gameNumber);
  }
}

function handleDraftClick(index) {
  if (!seriesStore.currentGame || !seriesStore.setCurrentDraft) return;
  seriesStore.setCurrentDraft(index);
}

function handleAddDraft() {
  if (!seriesStore.currentGame || !seriesStore.addDraftIteration) return;
  seriesStore.addDraftIteration();
}

async function handleDraftRightClick(event, index) {
  event.preventDefault();
  event.stopPropagation();

  if (!draftDeletionModal.value || !seriesStore.currentGame || seriesStore.currentGame.drafts?.length <= 1) {
    return;
  }

  const result = await draftDeletionModal.value.open(index);
  if (result.confirmed) {
    seriesStore.removeDraftIteration(result.draftIndex);
  }
}

async function handleSave() {
  if (!seriesStore.hasSeries || !seriesStore.saveSeries) return;

  // Check if there are any changes to save
  if (!seriesStore.hasUnsavedChanges()) {
    return; // No changes to save
  }

  confirmationStore.open({
    message: "Save changes to this series?",
    confirmAction: async () => {
      try {
        await seriesStore.saveSeries();
      } catch (error) {
        console.error("Error saving series:", error);
        alert("Failed to save series. See console for details.");
      }
    },
    isDanger: false
  });
}

function handleReset() {
  if (!seriesStore.resetSeries) return;

  confirmationStore.open({
    message:
      "Are you sure you want to reset the current series? This will clear all games, drafts, and notes. This cannot be undone.",
    confirmAction: () => {
      seriesStore.resetSeries();
    },
    isDanger: true,
  });
}
</script>

<style scoped>
.series-navigator {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background-color: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  width: 100%;
  height: auto;
  min-height: 40px;
  position: relative;
  z-index: 10;
  gap: 1rem;
}

.game-draft-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
  justify-self: start;
}

.mode-toggle-section {
  display: flex;
  justify-content: center;
  align-items: center;
  justify-self: center;
}

.series-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  justify-self: end;
}

.current-game-section {
  position: relative;
  flex-shrink: 0;
}

.current-game-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: #282828;
  color: #e0e0e0;
  border: 1px solid #3a3a3a;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  width: auto;
  min-width: 80px;
}

.current-game-button:hover {
  background-color: #333333;
  border-color: #4a4a4a;
}

.current-game-button.expanded {
  background-color: #b45309;
  color: white;
  border-color: #92400e;
}

.expanded-games-list {
  position: absolute;
  top: 100%;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-10px);
  transition: all 0.2s ease;
  z-index: 10;
  margin-top: 0.25rem;
  background-color: #1e1e1e;
  border: 1px solid #3a3a3a;
  border-radius: 0.375rem;
  padding: 0.25rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
}

.current-game-section:hover .expanded-games-list {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.expanded-game-button {
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: #282828;
  color: #e0e0e0;
  border: 1px solid #3a3a3a;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  min-width: 80px;
}

.expanded-game-button:hover {
  background-color: #333333;
  border-color: #4a4a4a;
}

.expanded-game-button.active {
  background-color: #b45309;
  color: white;
  border-color: #92400e;
}

.expanded-game-button.has-changes {
  background-color: #4a4a4a;
  color: #cccccc;
}

.draft-iterations-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.draft-iterations-container {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.compact-mode-toggle {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: #282828;
  border: 1px solid #3a3a3a;
  border-radius: 0.375rem;
  padding: 0.125rem;
}

.mode-button {
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  background: transparent;
  color: #9ca3af;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.mode-button:hover {
  background: #374151;
  color: #e0e0e0;
}

.mode-button.active {
  background: #b45309;
  color: white;
}

.button-wrapper {
  position: relative;
  display: inline-block;
}

.info-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  background-color: #3f3f46;
  color: #a1a1aa;
  font-size: 0.6rem;
  font-weight: bold;
  cursor: help;
  transition: all 0.2s ease;
  z-index: 10;
  border: 1px solid #1a1a1a;
}

.info-badge:hover {
  background-color: #52525b;
  color: #e4e4e7;
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
  background-color: #b45309;
  color: white;
  border-color: #92400e;
  border-width: 2px;
  font-weight: 600;
}

.game-button.active:hover {
  background-color: #92400e;
  border-color: #78350f;
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
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  font-size: 0.65rem;
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
  background-color: #b45309;
  color: white;
  border-color: #92400e;
  border-width: 2px;
  font-weight: 600;
}

.draft-iteration-button.active:hover {
  background-color: #92400e;
  border-color: #78350f;
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
  background-color: #b45309;
  color: white;
  border-color: #92400e;
}

.save-button:hover:not(:disabled) {
  background-color: #92400e;
  border-color: #78350f;
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

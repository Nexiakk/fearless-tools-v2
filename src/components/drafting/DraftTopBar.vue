<template>
  <div class="draft-top-bar">
    <!-- Game Buttons -->
    <div v-show="draftingMode === 'lcu-sync'" class="game-buttons-container">
      <button
        v-for="gameNumber in 5"
        :key="gameNumber"
        @click="handleGameClick(gameNumber)"
        class="game-button"
        :class="{
          active: isGameActive(gameNumber),
          completed: isGameCompleted(gameNumber),
        }"
        :title="getGameButtonTitle(gameNumber)"
      >
        <div v-if="isGameActive(gameNumber)" class="pulse-indicator"></div>
        <svg
          v-else-if="isGameCompleted(gameNumber)"
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="check-icon"
        >
          <path d="M20 6 9 17l-5-5"></path>
        </svg>
        <span class="game-label">G{{ gameNumber }}</span>
      </button>
    </div>

    <div v-show="draftingMode === 'lcu-sync'" class="divider"></div>

    <!-- Draft Iterations -->
    <div class="draft-iterations-wrapper">
      <div class="draft-iterations">
        <template
          v-for="(draft, index) in currentGameDrafts"
          :key="draft.id || index"
        >
          <button
            v-if="!(draft.isReadOnly && draftingMode !== 'lcu-sync')"
            @click="handleDraftClick(index)"
            @contextmenu="handleDraftRightClick($event, index)"
            class="iteration-button"
            :class="{
              active: isDraftActive(index),
              'is-read-only': draft.isReadOnly,
            }"
            :title="
              draft.isReadOnly
                ? 'LCU Draft (Read Only)'
                : 'Draft ' + (index + 1)
            "
          >
            <span v-if="draft.isReadOnly" class="read-only-indicator">L</span>
            <span v-else>{{ getDraftDisplayIndex(index) }}</span>
          </button>
        </template>
        <button
          @click="handleAddDraft"
          class="iteration-button add-button"
          title="Add Draft Iteration"
        >
          +
        </button>
      </div>
      <TooltipProvider>
        <Tooltip :delayDuration="100">
          <TooltipTrigger asChild>
            <div class="info-badge">?</div>
          </TooltipTrigger>
          <TooltipContent class="max-w-[300px] text-center" side="bottom">
            <div class="text-left space-y-1">
              <p>
                <strong>Draft Iterations:</strong> Each iteration represents a separate draft sequence. Add multiple iterations to test different strategies. Right-click to delete.
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <div class="divider"></div>

    <!-- Right Group: Mode Selector + Actions -->
    <div class="right-group">
      <!-- Mode Selector -->
      <div class="mode-selector">
        <button
          @click="toggleDraftingMode"
          :class="[
            'mode-button',
            {
              active: draftingMode === 'lcu-sync',
              'lcu-pulse': isLcuPulseActive,
            },
          ]"
        >
          LCU Mode
        </button>
        <TooltipProvider>
          <Tooltip :delayDuration="100">
            <TooltipTrigger asChild>
              <div class="info-badge">?</div>
            </TooltipTrigger>
            <TooltipContent class="max-w-[400px] text-center" side="bottom">
              <div class="text-left space-y-2">
                <p>
                  <strong>LCU Mode ON:</strong> Auto-detects drafts from your League Client. LCU drafts are read-only and disable champions for the next game.
                </p>
                <p>
                  <strong>LCU Mode OFF (Fearless):</strong> Select champions manually. Game Selector is unlocked.
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <!-- Save/Reset Actions -->
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
    </div>

    <DraftDeletionModal ref="draftDeletionModal" />
    <ResetModal ref="resetModal" />
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useSeriesStore } from "@/stores/series";
import { useDraftingStore } from "@/stores/drafting";
import { useConfirmationStore } from "@/stores/confirmation";
import DraftDeletionModal from "@/components/common/DraftDeletionModal.vue";
import ResetModal from "@/components/drafting/ResetModal.vue";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const seriesStore = useSeriesStore();
const draftingStore = useDraftingStore();
const confirmationStore = useConfirmationStore();

const draftDeletionModal = ref(null);
const resetModal = ref(null);

const currentGameDrafts = computed(() => {
  if (!seriesStore.currentGame) return [];
  return seriesStore.currentGame.drafts || [];
});

const currentGameNumber = computed(() => {
  return seriesStore.currentGame?.gameNumber || 1;
});

const draftingMode = computed(() => draftingStore.draftingMode);

const isLcuPulseActive = computed(() => {
  return draftingMode.value !== "lcu-sync" && draftingStore.lcuActivityDetected;
});

const isCurrentDraftReadOnly = computed(() => {
  if (!seriesStore.currentGame?.drafts) return false;
  const current =
    seriesStore.currentGame.drafts[seriesStore.currentGame.currentDraftIndex];
  return current?.isReadOnly || false;
});

function isGameActive(gameNumber) {
  if (!seriesStore.currentGame) return gameNumber === 1;
  return seriesStore.currentGame.gameNumber === gameNumber;
}

function isGameCompleted(gameNumber) {
  if (!seriesStore.currentSeries) return false;
  const game = seriesStore.currentSeries.games?.find(
    (g) => g.gameNumber === gameNumber,
  );
  return game?.isCompleted || false;
}

function isGameLocked(gameNumber) {
  if (gameNumber <= currentGameNumber.value) return false;
  for (let i = 1; i < gameNumber; i++) {
    if (!isGameCompleted(i)) return true;
  }
  return false;
}

function getGameButtonTitle(gameNumber) {
  if (isGameLocked(gameNumber)) return "Complete previous drafts";
  if (isGameCompleted(gameNumber)) return `Game ${gameNumber} (Completed)`;
  return `Game ${gameNumber}`;
}

function isDraftActive(index) {
  if (!seriesStore.currentGame) return index === 0;
  return seriesStore.currentGame.currentDraftIndex === index;
}

function getDraftDisplayIndex(globalIndex) {
  if (!seriesStore.currentGame?.drafts) return globalIndex + 1;

  let regularDraftCount = 0;
  for (let i = 0; i <= globalIndex; i++) {
    if (!seriesStore.currentGame.drafts[i].isReadOnly) {
      regularDraftCount++;
    }
  }

  return regularDraftCount > 0 ? regularDraftCount : globalIndex + 1;
}

function setDraftingMode(mode) {
  const previousMode = draftingStore.draftingMode;
  draftingStore.setDraftingMode(mode);

  if (!seriesStore.currentGame?.drafts) return;

  // Auto-switch iteration when changing modes
  if (previousMode === "lcu-sync" && mode !== "lcu-sync") {
    // Going from LCU to other modes - find first non-LCU (non-read-only) iteration
    const firstNonLcuIndex = seriesStore.currentGame.drafts.findIndex(
      (d) => !d.isReadOnly,
    );
    if (firstNonLcuIndex >= 0) {
      seriesStore.setCurrentDraft(firstNonLcuIndex);
    }
  } else if (previousMode !== "lcu-sync" && mode === "lcu-sync") {
    // Going to LCU mode - check if there's LCU data and select it
    const lcuDraftIndex = seriesStore.currentGame.drafts.findIndex(
      (d) => d.isReadOnly,
    );
    if (lcuDraftIndex >= 0) {
      seriesStore.setCurrentDraft(lcuDraftIndex);
    }
  }
}

function toggleDraftingMode() {
  const newMode = draftingMode.value === 'lcu-sync' ? 'fearless-pool' : 'lcu-sync';
  setDraftingMode(newMode);
}

function handleGameClick(gameNumber) {
  if (!seriesStore.currentSeries) return;
  seriesStore.setCurrentGame(gameNumber);
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

  if (!draftDeletionModal.value || !seriesStore.currentGame) {
    return;
  }

  // Count non-LCU (non-read-only) drafts
  const nonLcuDrafts = seriesStore.currentGame.drafts?.filter(d => !d.isReadOnly) || [];
  if (nonLcuDrafts.length <= 1) {
    return; // Can't remove last non-LCU iteration
  }

  const draft = seriesStore.currentGame.drafts?.[index];
  if (draft && draft.isReadOnly) {
    return; // Can't delete LCU iteration
  }

  const result = await draftDeletionModal.value.open(index);
  if (result.confirmed) {
    seriesStore.removeDraftIteration(result.draftIndex);
  }
}

async function handleSave() {
  if (!seriesStore.hasSeries || !seriesStore.saveSeries) return;

  if (!seriesStore.hasUnsavedChanges()) {
    return;
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
    isDanger: false,
  });
}

async function handleReset() {
  if (!resetModal.value) return;

  const result = await resetModal.value.open();
  if (!result.confirmed) return;

  if (result.mode === 'all') {
    // Reset all games - user created only, LCU and Fearless Pool data unaffected
    seriesStore.resetAllGames();
  } else {
    // Reset current iteration only (default)
    seriesStore.resetCurrentIteration();
  }
}
</script>

<style scoped>
.draft-top-bar {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: linear-gradient(180deg, #1e1e1e 0%, #1a1a1a 100%);
  border: 1px solid #333;
  border-radius: 8px;
  width: 100%;
  gap: 0.625rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.divider {
  width: 1px;
  height: 1.5rem;
  background: linear-gradient(180deg, transparent, #3a3a3a 30%, #3a3a3a 70%, transparent);
  flex-shrink: 0;
}

/* Right Group */
.right-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
}

/* Game Buttons */
.game-buttons-container {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.game-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0 0.625rem;
  height: 1.75rem;
  min-width: 3rem;
  font-weight: 700;
  background: linear-gradient(180deg, #2a2a2a 0%, #222 100%);
  color: #888;
  border: 1px solid #383838;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.game-button:hover:not(:disabled) {
  background: linear-gradient(180deg, #353535 0%, #2a2a2a 100%);
  color: #d0d0d0;
  border-color: #4a4a4a;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.game-button.active {
  background: linear-gradient(180deg, rgba(180, 83, 9, 0.4) 0%, rgba(180, 83, 9, 0.25) 100%);
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.5);
  box-shadow: 0 0 8px rgba(251, 191, 36, 0.2);
}

.game-button.completed {
  background: linear-gradient(180deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.08) 100%);
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.3);
}

.pulse-indicator {
  width: 0.4375rem;
  height: 0.4375rem;
  border-radius: 50%;
  background-color: #fbbf24;
  animation: pulse-pulse 2s infinite;
  flex-shrink: 0;
  box-shadow: 0 0 6px rgba(251, 191, 36, 0.5);
}

@keyframes pulse-pulse {
  0%, 100% { opacity: 0.8; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.check-icon {
  width: 0.6875rem;
  height: 0.6875rem;
  flex-shrink: 0;
}

.game-label {
  font-size: 0.625rem;
  font-weight: 700;
  display: block;
  line-height: 1;
  margin: 0;
  margin-top: -1px;
}

/* Draft Iterations Wrapper */
.draft-iterations-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

/* Draft Iterations */
.draft-iterations {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
  background: linear-gradient(180deg, #222 0%, #1c1c1c 100%);
  border-radius: 0.5rem;
  border: 1px solid #2a2a2a;
  max-width: 180px;
  flex-wrap: wrap;
  max-height: 2.5rem;
  overflow: hidden;
  transition: all 0.25s ease;
  z-index: 1;
}

.draft-iterations:hover {
  max-height: 200px;
  overflow-y: hidden;
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  border-color: #404040;
}

.draft-iterations-wrapper .info-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  z-index: 5;
}

.draft-iterations:hover ~ .info-badge {
  z-index: 15;
}

.iteration-button {
  width: 1.625rem;
  height: 1.625rem;
  padding: 0;
  font-size: 0.625rem;
  font-weight: 700;
  background: linear-gradient(180deg, #333 0%, #282828 100%);
  color: #c0c0c0;
  border: 1px solid #404040;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.iteration-button:hover {
  background: linear-gradient(180deg, #404040 0%, #333 100%);
  border-color: #505050;
  transform: scale(1.1);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.iteration-button.active {
  background: linear-gradient(180deg, #c2410c 0%, #9a3412 100%);
  color: white;
  border-color: #ea580c;
  border-width: 2px;
  box-shadow: 0 0 10px rgba(234, 88, 12, 0.4);
  transform: scale(1.15);
}

.iteration-button.add-button {
  font-size: 1rem;
  font-weight: 600;
  background: linear-gradient(180deg, #2a2a2a 0%, #222 100%);
  color: #6b7280;
  border: 1px dashed #404040;
  box-shadow: none;
}

.iteration-button.add-button:hover {
  background: linear-gradient(180deg, #353535 0%, #2a2a2a 100%);
  color: #9ca3af;
  border-color: #555;
}

.iteration-button.is-read-only {
  background: linear-gradient(180deg, #1e3a5f 0%, #1a2e4a 100%);
  border-color: #2563eb;
  box-shadow: 0 0 6px rgba(37, 99, 235, 0.3);
}

.iteration-button.is-read-only:hover {
  background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
  border-color: #3b82f6;
  box-shadow: 0 0 10px rgba(37, 99, 235, 0.5);
}

.iteration-button.is-read-only.active {
  background: linear-gradient(180deg, #c2410c 0%, #9a3412 100%);
  border-color: #ea580c;
  box-shadow: 0 0 10px rgba(234, 88, 12, 0.4);
}

.read-only-indicator {
  font-family: monospace;
  font-weight: bold;
  font-size: 0.5625rem;
}

/* Mode Selector */
.mode-selector {
  display: flex;
  align-items: center;
  gap: 2px;
  background: linear-gradient(180deg, #252525 0%, #1e1e1e 100%);
  border: 1px solid #333;
  border-radius: 0.5rem;
  padding: 2px;
  position: relative;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
}

.mode-button {
  padding: 0.375rem 0.75rem;
  font-size: 0.6875rem;
  font-weight: 600;
  background: transparent;
  color: #888;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  letter-spacing: 0.03em;
}

.mode-button:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #c0c0c0;
}

.mode-button.active {
  background: linear-gradient(180deg, #c2410c 0%, #9a3412 100%);
  color: white;
  box-shadow: 0 2px 4px rgba(194, 65, 12, 0.3);
}

@keyframes pulse-glow {
  0% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.6); }
  70% { box-shadow: 0 0 0 8px rgba(14, 165, 233, 0); }
  100% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0); }
}

.mode-button.lcu-pulse {
  animation: pulse-glow 2s infinite;
  color: #38bdf8;
}

.info-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: linear-gradient(135deg, #444 0%, #333 100%);
  color: #a1a1aa;
  font-size: 0.5625rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: help;
  transition: all 0.15s ease;
  border: 2px solid #1a1a1a;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.info-badge:hover {
  background: linear-gradient(135deg, #555 0%, #444 100%);
  color: #e4e4e7;
  transform: scale(1.1);
}

/* Save/Reset Actions */
.series-actions {
  display: flex;
  align-items: center;
}

.save-button,
.reset-button {
  padding: 0.375rem 0.875rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  border: 1px solid;
  letter-spacing: 0.02em;
}

.save-button {
  background: linear-gradient(180deg, #c2410c 0%, #9a3412 100%);
  color: white;
  border-color: #ea580c;
  border-radius: 0.375rem 0 0 0.375rem;
  box-shadow: 0 2px 4px rgba(194, 65, 12, 0.3);
}

.save-button:hover:not(:disabled) {
  background: linear-gradient(180deg, #ea580c 0%, #c2410c 100%);
  border-color: #f97316;
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(234, 88, 12, 0.4);
}

.save-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.reset-button {
  background: linear-gradient(180deg, #2a2a2a 0%, #222 100%);
  color: #c0c0c0;
  border-color: #3a3a3a;
  border-left: none;
  border-radius: 0 0.375rem 0.375rem 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.reset-button:hover {
  background: linear-gradient(180deg, #353535 0%, #2a2a2a 100%);
  color: #e0e0e0;
  border-color: #4a4a4a;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
</style>

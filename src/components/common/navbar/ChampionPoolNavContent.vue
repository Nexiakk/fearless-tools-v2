<template>
  <div class="navbar-view-actions">
    <button
      @click="openConfirmation('Are you sure you want to reset highlighted picks?', () => draftStore.resetHighlighted())"
      class="navbar-action-button"
      aria-label="Reset highlighted picks"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span>Reset Highlighted</span>
    </button>
    <button
      @click="openConfirmation('Reset unavailable champions? This cannot be undone.', () => draftStore.resetUnavailable(), true)"
      class="navbar-action-button"
      aria-label="Reset unavailable champions"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      <span>Reset Unavailable</span>
    </button>
    <button
      @click="openMilestoneReview"
      class="navbar-action-button"
      aria-label="Review Assignments"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <span>Review Assignments</span>
    </button>
  </div>
</template>

<script setup>
import { useDraftStore } from '@/stores/draft'
import { useConfirmationStore } from '@/stores/confirmation'
import { useMilestoneStore } from '@/stores/milestone'

const draftStore = useDraftStore()
const confirmationStore = useConfirmationStore()
const milestoneStore = useMilestoneStore()

const openConfirmation = (message, confirmAction, isDanger = false) => {
  confirmationStore.open({ message, confirmAction, isDanger })
}

const openMilestoneReview = () => {
  milestoneStore.open()
}
</script>

<style scoped>
.navbar-view-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.navbar-action-button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background-color: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.navbar-action-button svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.navbar-action-button:hover {
  background-color: #3a3a3a;
  border-color: #4a4a4a;
  color: #ffffff;
}

.navbar-action-button:first-child {
  background-color: #1e40af;
  border-color: #2563eb;
}

.navbar-action-button:first-child:hover {
  background-color: #2563eb;
}

.navbar-action-button:nth-child(2) {
  background-color: #854d0e;
  border-color: #a16207;
}

.navbar-action-button:nth-child(2):hover {
  background-color: #a16207;
}

.navbar-action-button:last-child {
  background-color: #92400e;
  border-color: #b45309;
}

.navbar-action-button:last-child:hover {
  background-color: #b45309;
}
</style>



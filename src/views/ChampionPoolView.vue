<template>
  <div v-if="workspaceStore.hasWorkspace" class="container-fluid mx-auto p-4">
    <!-- Loading state -->
    <div v-if="championsStore.isLoading" class="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-40">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
        <p class="text-gray-300">Loading champions...</p>
      </div>
    </div>

    <div v-else class="controls-container">
      <div class="controls-row-bottom">
        <div class="sort-reset-container">
          <div>
            <button
              @click="openConfirmation('Are you sure you want to reset highlighted picks?', () => draftStore.resetHighlighted())"
              class="reset-button reset-marked bg-blue-700 hover:bg-blue-600 text-white ml-2"
              aria-label="Reset highlighted picks"
            >
              Reset Highlighted
            </button>
            <button
              @click="openConfirmation('Reset unavailable champions? This cannot be undone.', () => draftStore.resetUnavailable(), true)"
              class="reset-button reset-series bg-yellow-700 hover:bg-yellow-600 text-white ml-2"
              aria-label="Reset unavailable champions"
            >
              Reset Unavailable
            </button>
            <button
              @click="openMilestoneReview"
              class="reset-button bg-amber-700 hover:bg-amber-600 text-white ml-2"
              aria-label="Review Assignments"
            >
              Review Assignments
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!championsStore.isLoading" class="pool-main-area">
      <div class="compact-view-container" :class="viewClasses">
        <RolePillar
          v-for="role in roles"
          :key="role"
          :role="role"
          :champions="championsByRole[role]"
        />
      </div>
    </div>
  </div>
  
  <div v-else class="flex items-center justify-center h-screen">
    <p class="text-gray-400">Please join a workspace to continue</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useDraftStore } from '@/stores/draft'
import { useChampionsStore } from '@/stores/champions'
import { useSettingsStore } from '@/stores/settings'
import { useConfirmationStore } from '@/stores/confirmation'
import { useMilestoneStore } from '@/stores/milestone'
import RolePillar from '@/components/champion-pool/RolePillar.vue'

const workspaceStore = useWorkspaceStore()
const draftStore = useDraftStore()
const championsStore = useChampionsStore()
const settingsStore = useSettingsStore()
const confirmationStore = useConfirmationStore()

const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']

const championsByRole = computed(() => {
  return draftStore.championsByRoleForCompactView
})

const viewClasses = computed(() => ({
  'compact-mode': settingsStore.settings.pool.compactMode,
  'no-animations': settingsStore.settings.pool.disableAnimations,
  'center-cards': settingsStore.settings.pool.centerCards
}))

const milestoneStore = useMilestoneStore()

const openConfirmation = (message, confirmAction, isDanger = false) => {
  confirmationStore.open({ message, confirmAction, isDanger })
}

const openMilestoneReview = () => {
  milestoneStore.open()
}
</script>

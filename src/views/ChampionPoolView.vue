<template>
  <div>
    <!-- Show skeleton when workspace is loading OR when workspace exists OR when saved workspace exists -->
    <div v-if="showSkeletonContainer" class="container-fluid mx-auto p-4">
      <!-- Editor Mode Bottom Border -->
      <div v-if="adminStore.isEditorModeActive && workspaceStore.hasWorkspace" class="editor-mode-banner-bottom-line"></div>
      
      <!-- Skeleton Loader - Show when workspace/champions/draft data is loading -->
      <Transition name="fade" mode="out-in">
        <ChampionPoolSkeleton v-if="isLoading" key="skeleton" />
        
        <!-- Actual Content - Show only when workspace exists and all data is loaded -->
        <div v-else-if="workspaceStore.hasWorkspace" key="content" class="pool-main-area">
          <div 
            class="compact-view-container" 
            :class="viewClasses"
            :style="cardSizeStyles"
          >
            <RolePillar
              v-for="role in roles"
              :key="role"
              :role="role"
              :champions="championsByRole[role]"
            />
          </div>
        </div>
      </Transition>
      
      <!-- Champion Info Modal (for Editor Mode) -->
      <ChampionInfoModal
        v-if="workspaceStore.hasWorkspace"
        :is-open="isChampionInfoModalOpen"
        :champion="adminStore.selectedChampionForEditor"
        @close="closeChampionInfoModal"
      />
    </div>
    
    <!-- Show "join workspace" only when not loading and no workspace -->
    <div v-else class="flex items-center justify-center h-screen">
      <p class="text-gray-400">Please join a workspace to continue</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useDraftStore } from '@/stores/draft'
import { useChampionsStore } from '@/stores/champions'
import { useSettingsStore } from '@/stores/settings'
import { useAdminStore } from '@/stores/admin'
import { workspaceService } from '@/services/workspace'
import RolePillar from '@/components/champion-pool/RolePillar.vue'
import ChampionInfoModal from '@/components/champion-pool/ChampionInfoModal.vue'
import ChampionPoolSkeleton from '@/components/champion-pool/ChampionPoolSkeleton.vue'

const workspaceStore = useWorkspaceStore()
const draftStore = useDraftStore()
const championsStore = useChampionsStore()
const settingsStore = useSettingsStore()
const adminStore = useAdminStore()

const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']

// Check if there's a saved workspace synchronously (to avoid flash of "join workspace" message)
let initialSavedWorkspace = false
if (typeof window !== 'undefined') {
  initialSavedWorkspace = !!workspaceService.getCurrentWorkspaceId()
}
const hasSavedWorkspace = ref(initialSavedWorkspace)

const championsByRole = computed(() => {
  return draftStore.championsByRoleForCompactView
})

const viewClasses = computed(() => ({
  'compact-mode': settingsStore.settings.pool.compactMode,
  'no-animations': settingsStore.settings.pool.disableAnimations,
  'center-cards': settingsStore.settings.pool.centerCards
}))

const cardSizeStyles = computed(() => {
  const normalSize = settingsStore.settings.pool.normalCardSize || 100
  const highlightSize = settingsStore.settings.pool.highlightCardSize || 100
  const unavailableSize = settingsStore.settings.pool.unavailableCardSize || 83
  
  return {
    '--normal-card-scale': normalSize / 100,
    '--highlight-card-scale': highlightSize / 100,
    '--unavailable-card-scale': unavailableSize / 100,
    '--normal-font-scale': normalSize / 100,
    '--highlight-font-scale': highlightSize / 100,
    '--unavailable-font-scale': unavailableSize / 100
  }
})

// Champion Info Modal state
const isChampionInfoModalOpen = computed(() => {
  return adminStore.selectedChampionForEditor !== null
})

const closeChampionInfoModal = () => {
  adminStore.clearSelectedChampionForEditor()
}

// Combined loading state - show skeleton until workspace, champions, and draft data are all loaded
const isLoading = computed(() => {
  return workspaceStore.isLoading || championsStore.isLoading || draftStore.isLoading || (hasSavedWorkspace.value && !workspaceStore.hasWorkspace)
})

// Show skeleton container if loading, has workspace, has saved workspace, or still initializing
const showSkeletonContainer = computed(() => {
  return workspaceStore.isInitializing || isLoading.value || workspaceStore.hasWorkspace || hasSavedWorkspace.value || workspaceStore.isWorkspaceModalOpen
})

// Watch for when workspace is loaded to update hasSavedWorkspace
watch(() => workspaceStore.hasWorkspace, (hasWorkspace) => {
  if (hasWorkspace) {
    hasSavedWorkspace.value = false
  }
})
</script>

<style scoped>
/* Fast fade transition for skeleton to content - instant response to data loading */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

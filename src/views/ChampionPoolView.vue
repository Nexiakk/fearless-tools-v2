<template>
  <div>
    <div v-if="workspaceStore.hasWorkspace" class="container-fluid mx-auto p-4">
      <!-- Loading state -->
      <div v-if="championsStore.isLoading" class="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-40">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p class="text-gray-300">Loading champions...</p>
        </div>
      </div>

      <!-- Editor Mode Bottom Border -->
      <div v-if="adminStore.isEditorModeActive" class="editor-mode-banner-bottom-line"></div>
      
      <div v-if="!championsStore.isLoading" class="pool-main-area">
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
      
      <!-- Champion Info Modal (for Editor Mode) -->
      <ChampionInfoModal
        :is-open="isChampionInfoModalOpen"
        :champion="adminStore.selectedChampionForEditor"
        @close="closeChampionInfoModal"
      />
    </div>
    
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
import RolePillar from '@/components/champion-pool/RolePillar.vue'
import ChampionInfoModal from '@/components/champion-pool/ChampionInfoModal.vue'

const workspaceStore = useWorkspaceStore()
const draftStore = useDraftStore()
const championsStore = useChampionsStore()
const settingsStore = useSettingsStore()
const adminStore = useAdminStore()

const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']

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
</script>

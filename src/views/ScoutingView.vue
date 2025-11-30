<template>
  <div>
    <!-- Loading state (teleported to body) -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="scoutingStore.isLoading" class="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-50">
          <div class="text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
            <p class="text-gray-300">Loading scouting data...</p>
          </div>
        </div>
      </Transition>
    </Teleport>

    <div v-if="workspaceStore.hasWorkspace" class="container-fluid mx-auto p-4">
      <!-- Error message -->
      <div v-if="scoutingStore.error" class="mb-4 p-4 bg-red-900/50 border border-red-700 rounded text-red-200">
        {{ scoutingStore.error }}
        <button @click="scoutingStore.clearError()" class="ml-4 text-red-300 hover:text-red-100">
          ×
        </button>
      </div>

      <!-- Main content -->
      <div v-if="!scoutingStore.isLoading" class="relative min-h-screen">
        <!-- Top Right: Player List Container -->
        <div class="absolute top-0 right-0 w-64 z-10" id="players-container">
          <PlayerListContainer @open-management="showManagementModal = true" />
        </div>

        <!-- Player Cards Grid (starts where PlayerListContainer ends vertically) -->
        <div class="pt-[180px] pr-[280px]">
          <PlayerCardsGrid />
        </div>
      </div>
    </div>

    <!-- Player Detail Modal (teleported to body) -->
    <Teleport to="body">
      <PlayerDetailModal
        v-if="scoutingStore.selectedPlayer"
        :player-id="scoutingStore.selectedPlayer"
        @close="scoutingStore.setSelectedPlayer(null)"
      />
    </Teleport>

    <!-- Player Management Modal -->
    <PlayerManagementModal
      :is-open="showManagementModal"
      @close="showManagementModal = false"
      @player-added="handlePlayerAdded"
      @player-updated="handlePlayerUpdated"
      @player-deleted="handlePlayerDeleted"
      @team-name-updated="handleTeamNameUpdated"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useScoutingStore } from '@/stores/scouting'
import { useAuthStore } from '@/stores/auth'
import { scoutingService } from '@/services/scouting/scoutingService'
import PlayerDetailModal from '@/components/scouting/PlayerDetailModal.vue'
import PlayerListContainer from '@/components/scouting/PlayerListContainer.vue'
import PlayerCardsGrid from '@/components/scouting/PlayerCardsGrid.vue'
import PlayerManagementModal from '@/components/scouting/PlayerManagementModal.vue'
import { useRoute } from 'vue-router'

const workspaceStore = useWorkspaceStore()
const scoutingStore = useScoutingStore()
const authStore = useAuthStore()
const route = useRoute()

const showManagementModal = ref(false)

onMounted(async () => {
  if (workspaceStore.hasWorkspace) {
    await scoutingStore.loadPlayers()
    await scoutingStore.loadTeamNames()
  }
})

watch(() => route.name, (newName, oldName) => {
  // If navigating away from scouting view, reset loading state
  if (oldName === 'scouting' && newName !== 'scouting') {
    scoutingStore.resetLoadingState()
  }
})

onBeforeUnmount(() => {
  // Reset loading states to prevent overlay from persisting
  scoutingStore.resetLoadingState()
})

const scoutAllPlayers = async () => {
  try {
    await scoutingService.scoutAllPlayers({ delay: 2000 })
    // Reload all scouting data
    for (const player of scoutingStore.players) {
      try {
        await scoutingStore.loadScoutingData(player.id)
      } catch (error) {
        console.error(`Error loading data for ${player.name}:`, error)
      }
    }
  } catch (error) {
    console.error('Error scouting all players:', error)
  }
}

const handlePlayerAdded = () => {
  // Player was added, modal will handle closing
}

const handlePlayerUpdated = () => {
  // Player was updated
}

const handlePlayerDeleted = () => {
  // Player was deleted
}

const handleTeamNameUpdated = () => {
  // Team name was updated
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>


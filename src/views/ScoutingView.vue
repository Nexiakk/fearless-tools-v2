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

    <div v-if="workspaceStore.hasWorkspace" class="scouting-view-container">
      <!-- Expanded Navigation (only visible on Scouting page) -->
      <ScoutingNavContent 
        :current-view="currentView"
        @view-change="handleViewChange"
      />

      <!-- Error message -->
      <div v-if="scoutingStore.error" class="scouting-error-message">
        {{ scoutingStore.error }}
        <button @click="scoutingStore.clearError()" class="ml-4 text-red-300 hover:text-red-100">
          ×
        </button>
      </div>

      <!-- Main content -->
      <div v-if="!scoutingStore.isLoading" class="scouting-content-area">
        <Transition name="view-fade" mode="out-in">
          <!-- Summary View -->
          <div v-if="currentView === 'summary'" key="summary" class="h-full w-full">
            <!-- Player Cards Grid (expanded vertically) -->
            <div class="absolute top-4 left-4 right-4 bottom-4">
              <PlayerCardsGrid />
            </div>
          </div>

          <!-- Manage Players View -->
          <div v-else-if="currentView === 'manage-players'" key="manage-players" class="h-full w-full">
            <ManagePlayersView />
          </div>
        </Transition>
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
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useScoutingStore } from '@/stores/scouting'
import { useAuthStore } from '@/stores/auth'
import { scoutingService } from '@/services/scouting/scoutingService'
import PlayerDetailModal from '@/components/scouting/PlayerDetailModal.vue'
import PlayerCardsGrid from '@/components/scouting/PlayerCardsGrid.vue'
import ManagePlayersView from '@/components/scouting/ManagePlayersView.vue'
import ScoutingNavContent from '@/components/common/navbar/ScoutingNavContent.vue'
import { useRoute } from 'vue-router'

const workspaceStore = useWorkspaceStore()
const scoutingStore = useScoutingStore()
const authStore = useAuthStore()
const route = useRoute()

const currentView = ref('summary') // 'summary' | 'manage-players'

const handleViewChange = (view) => {
  currentView.value = view
}

onMounted(async () => {
  if (workspaceStore.hasWorkspace) {
    try {
      await scoutingStore.loadTeams()
      await scoutingStore.loadPlayers()
      // Legacy: load team names for backward compatibility
      await scoutingStore.loadTeamNames()
    } catch (error) {
      console.error('Error loading scouting data:', error)
      // Ensure loading state is cleared even if there's an error
      scoutingStore.resetLoadingState()
    }
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

</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* View transition - optimized with GPU acceleration */
.view-fade-enter-active {
  transition: opacity 0.25s ease-out;
}

.view-fade-leave-active {
  transition: opacity 0.2s ease-in;
}

.view-fade-enter-from,
.view-fade-leave-to {
  opacity: 0;
}

/* Scouting view container - accounts for fixed navbar (40px) + expanded nav (40px) */
.scouting-view-container {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding-top: 80px; /* Navbar (40px) + Expanded nav (40px) */
}

/* Error message positioning */
.scouting-error-message {
  position: fixed;
  top: 80px; /* Below navbar + expanded nav */
  left: 0;
  right: 0;
  flex-shrink: 0;
  padding: 1rem;
  background-color: rgba(127, 29, 29, 0.5);
  border-bottom: 1px solid #b91c1c;
  color: #fecaca;
  z-index: 98;
}

/* Content area - takes remaining space */
.scouting-content-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 0;
}
</style>


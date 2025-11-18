<template>
  <div v-if="workspaceStore.hasWorkspace" class="container-fluid mx-auto p-4">
    <!-- Loading state -->
    <div v-if="scoutingStore.isLoading" class="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-40">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
        <p class="text-gray-300">Loading scouting data...</p>
      </div>
    </div>

    <!-- Error message -->
    <div v-if="scoutingStore.error" class="mb-4 p-4 bg-red-900/50 border border-red-700 rounded text-red-200">
      {{ scoutingStore.error }}
      <button @click="scoutingStore.clearError()" class="ml-4 text-red-300 hover:text-red-100">
        ×
      </button>
    </div>

    <!-- Main content -->
    <div v-if="!scoutingStore.isLoading" class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-white">Scouting</h1>
        <div class="flex gap-2">
          <button
            v-if="authStore.isAdmin && scoutingStore.players.length > 0"
            @click="scoutAllPlayers"
            :disabled="scoutingStore.isScouting"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
            title="Scout all players"
          >
            {{ scoutingStore.isScouting ? 'Scouting...' : 'Scout All' }}
          </button>
          <button
            v-if="authStore.isAdmin"
            @click="showAddPlayerModal = true"
            class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
          >
            + Add Player
          </button>
        </div>
      </div>

      <!-- Player Lists -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Own Team -->
        <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 class="text-xl font-semibold text-white mb-4">Own Team</h2>
          <div v-if="scoutingStore.ownTeamPlayers.length === 0" class="text-gray-400 text-center py-8">
            No players added yet
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="player in scoutingStore.ownTeamPlayers"
              :key="player.id"
              class="p-3 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="flex-1 cursor-pointer" @click="selectPlayer(player.id)">
                  <p class="text-white font-medium">{{ player.name }}</p>
                  <p v-if="player.role" class="text-sm text-gray-400">{{ player.role }}</p>
                  <p v-if="getScoutingStatus(player.id)" class="text-xs text-gray-500 mt-1">
                    {{ getScoutingStatus(player.id) }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    v-if="authStore.isAdmin"
                    @click.stop="scoutPlayer(player.id)"
                    :disabled="scoutingStore.isScouting"
                    class="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
                    title="Scout this player"
                  >
                    Scout
                  </button>
                  <button
                    v-if="authStore.isAdmin"
                    @click.stop="deletePlayer(player.id)"
                    class="text-red-400 hover:text-red-300"
                    title="Delete player"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Enemy Team -->
        <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 class="text-xl font-semibold text-white mb-4">Enemy Team</h2>
          <div v-if="scoutingStore.enemyTeamPlayers.length === 0" class="text-gray-400 text-center py-8">
            No players added yet
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="player in scoutingStore.enemyTeamPlayers"
              :key="player.id"
              class="p-3 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="flex-1 cursor-pointer" @click="selectPlayer(player.id)">
                  <p class="text-white font-medium">{{ player.name }}</p>
                  <p v-if="player.role" class="text-sm text-gray-400">{{ player.role }}</p>
                  <p v-if="getScoutingStatus(player.id)" class="text-xs text-gray-500 mt-1">
                    {{ getScoutingStatus(player.id) }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    v-if="authStore.isAdmin"
                    @click.stop="scoutPlayer(player.id)"
                    :disabled="scoutingStore.isScouting"
                    class="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
                    title="Scout this player"
                  >
                    Scout
                  </button>
                  <button
                    v-if="authStore.isAdmin"
                    @click.stop="deletePlayer(player.id)"
                    class="text-red-400 hover:text-red-300"
                    title="Delete player"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Analytics Section (placeholder for now) -->
      <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h2 class="text-xl font-semibold text-white mb-4">Analytics</h2>
        <p class="text-gray-400">Analytics dashboard coming soon...</p>
      </div>
    </div>
  </div>

  <!-- Player Detail Modal -->
  <PlayerDetailModal
    v-if="scoutingStore.selectedPlayer"
    :player-id="scoutingStore.selectedPlayer"
    @close="scoutingStore.setSelectedPlayer(null)"
  />

  <!-- Add Player Modal -->
  <div
    v-if="showAddPlayerModal"
    class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
    @click.self="showAddPlayerModal = false"
  >
    <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
      <h3 class="text-xl font-semibold text-white mb-4">Add Player</h3>
      <form @submit.prevent="handleAddPlayer" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Player Name</label>
          <input
            v-model="newPlayer.name"
            type="text"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
            placeholder="Summoner Name"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">op.gg URL</label>
          <input
            v-model="newPlayer.opggUrl"
            type="url"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
            placeholder="https://www.op.gg/summoners/euw/..."
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Team</label>
          <select
            v-model="newPlayer.team"
            required
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
          >
            <option value="own">Own Team</option>
            <option value="enemy">Enemy Team</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Role (Optional)</label>
          <select
            v-model="newPlayer.role"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
          >
            <option value="">None</option>
            <option value="Top">Top</option>
            <option value="Jungle">Jungle</option>
            <option value="Mid">Mid</option>
            <option value="Bot">Bot</option>
            <option value="Support">Support</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Leaguepedia URL (Optional)</label>
          <input
            v-model="newPlayer.leaguepediaUrl"
            type="url"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
            placeholder="https://lol.fandom.com/wiki/..."
          />
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button
            type="button"
            @click="showAddPlayerModal = false"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="isAddingPlayer"
            class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors disabled:opacity-50"
          >
            {{ isAddingPlayer ? 'Adding...' : 'Add Player' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useScoutingStore } from '@/stores/scouting'
import { useAuthStore } from '@/stores/auth'
import { useConfirmationStore } from '@/stores/confirmation'
import { scoutingService } from '@/services/scouting/scoutingService'
import PlayerDetailModal from '@/components/scouting/PlayerDetailModal.vue'

const workspaceStore = useWorkspaceStore()
const scoutingStore = useScoutingStore()
const authStore = useAuthStore()
const confirmationStore = useConfirmationStore()

const showAddPlayerModal = ref(false)
const isAddingPlayer = ref(false)
const newPlayer = ref({
  name: '',
  opggUrl: '',
  team: 'own',
  role: '',
  leaguepediaUrl: ''
})

onMounted(async () => {
  if (workspaceStore.hasWorkspace) {
    await scoutingStore.loadPlayers()
  }
})

const handleAddPlayer = async () => {
  isAddingPlayer.value = true
  try {
    await scoutingStore.addPlayer(newPlayer.value)
    showAddPlayerModal.value = false
    newPlayer.value = {
      name: '',
      opggUrl: '',
      team: 'own',
      role: '',
      leaguepediaUrl: ''
    }
  } catch (error) {
    console.error('Error adding player:', error)
  } finally {
    isAddingPlayer.value = false
  }
}

const selectPlayer = async (playerId) => {
  scoutingStore.setSelectedPlayer(playerId)
  // Load scouting data if not already loaded
  if (!scoutingStore.scoutingData[playerId]) {
    try {
      await scoutingStore.loadScoutingData(playerId)
    } catch (error) {
      console.error('Error loading scouting data:', error)
    }
  }
}

const scoutPlayer = async (playerId) => {
  try {
    await scoutingService.scoutPlayer(playerId)
    // Reload scouting data
    await scoutingStore.loadScoutingData(playerId)
  } catch (error) {
    console.error('Error scouting player:', error)
  }
}

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

const getScoutingStatus = (playerId) => {
  const data = scoutingStore.scoutingData[playerId]
  if (!data) return 'Not scouted'
  
  if (data.lastUpdated) {
    const lastUpdated = data.lastUpdated.toDate ? data.lastUpdated.toDate() : new Date(data.lastUpdated)
    const hoursSinceUpdate = (new Date() - lastUpdated) / (1000 * 60 * 60)
    
    if (hoursSinceUpdate < 24) {
      return `Updated ${Math.round(hoursSinceUpdate)}h ago`
    } else {
      const daysSinceUpdate = Math.floor(hoursSinceUpdate / 24)
      return `Updated ${daysSinceUpdate}d ago`
    }
  }
  
  return 'Scouted'
}

const deletePlayer = async (playerId) => {
  const player = scoutingStore.players.find(p => p.id === playerId)
  confirmationStore.open({
    message: `Are you sure you want to delete ${player?.name || 'this player'}?`,
    confirmAction: async () => {
      try {
        await scoutingStore.deletePlayer(playerId)
      } catch (error) {
        console.error('Error deleting player:', error)
      }
    },
    isDanger: true
  })
}
</script>


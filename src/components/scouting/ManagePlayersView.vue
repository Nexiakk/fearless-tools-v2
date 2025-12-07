<template>
  <div class="manage-players-view h-full overflow-y-auto">
    <div class="max-w-7xl mx-auto p-6">
      <div class="flex items-center justify-end mb-6">
        <button
          v-if="authStore.isAdmin && scoutingStore.selectedTeamId && scoutingStore.selectedTeamPlayers.length > 0"
          @click="scoutAllPlayers"
          :disabled="scoutingStore.isScouting"
          class="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ 'scout-all-icon-spinning': scoutingStore.isScouting }">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
            <path d="M21 3v5h-5"></path>
          </svg>
          <span>Scout All Players</span>
        </button>
      </div>
      
      <!-- Loading State -->
      <div v-if="scoutingStore.isLoadingTeams" class="flex flex-col items-center justify-center py-16">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p class="text-gray-300">Loading teams...</p>
        </div>
      </div>

      <!-- No Teams State -->
      <div v-else-if="!scoutingStore.teams || scoutingStore.teams.length === 0" class="flex flex-col items-center justify-center py-16">
        <div class="text-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500 mx-auto mb-4">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <h3 class="text-xl font-semibold text-white mb-2">No Teams Created</h3>
          <p class="text-gray-400 mb-6">Create your first team to start managing players</p>
          <button
            v-if="authStore.isAdmin"
            @click="showCreateTeamForm = true"
            class="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium"
          >
            Create First Team
          </button>
        </div>
      </div>

      <!-- Team Management and Players -->
      <div v-else class="space-y-6">
        <!-- Team Selector -->
        <div class="flex items-center gap-4">
          <label class="text-sm font-medium text-gray-300">Select Team:</label>
          <select
            v-model="selectedTeamId"
            @change="handleTeamChange"
            class="px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500 min-w-[200px]"
          >
            <option :value="null" disabled>Select a team</option>
            <option
              v-for="team in scoutingStore.teams"
              :key="team.id"
              :value="team.id"
            >
              {{ team.name }}
            </option>
          </select>
          <button
            v-if="authStore.isAdmin"
            @click="showCreateTeamForm = true"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors text-sm font-medium"
          >
            + New Team
          </button>
          <button
            v-if="authStore.isAdmin && selectedTeamId"
            @click="showEditTeamForm = true"
            class="px-4 py-2 bg-blue-600/80 hover:bg-blue-600 text-white rounded transition-colors text-sm font-medium"
          >
            Edit Team
          </button>
          <button
            v-if="authStore.isAdmin && selectedTeamId && scoutingStore.selectedTeamPlayers.length === 0"
            @click="deleteCurrentTeam"
            class="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded transition-colors text-sm font-medium"
          >
            Delete Team
          </button>
        </div>

        <!-- Players for Selected Team -->
        <div v-if="selectedTeamId" class="space-y-4">
          <!-- Team Name Display -->
          <div>
            <h3 class="text-lg font-semibold text-white mb-4">
              {{ scoutingStore.selectedTeam?.name || 'Team' }} - Players
            </h3>
          </div>

          <!-- Role Slots -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="role in roles"
              :key="role"
              class="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4 cursor-pointer hover:bg-gray-800/80 hover:border-gray-600 transition-all"
              @click="openPlayerForm(role)"
            >
              <div class="flex items-start gap-3">
                <img 
                  :src="championsStore.getRoleIconUrl(role)" 
                  :alt="role" 
                  class="w-8 h-8 flex-shrink-0"
                  draggable="false"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-2">
                    <p class="text-sm font-semibold text-gray-300 uppercase tracking-wide">{{ role }}</p>
                  </div>
                  <div v-if="getPlayerForRole(role)" class="space-y-2">
                    <p class="text-white font-semibold text-base">{{ getPlayerForRole(role).name }}</p>
                    <div class="flex items-center gap-2 flex-wrap">
                      <button
                        v-if="authStore.isAdmin"
                        @click.stop="editPlayer(getPlayerForRole(role).id)"
                        class="text-xs px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white rounded-md transition-colors font-medium"
                      >
                        Edit
                      </button>
                      <button
                        v-if="authStore.isAdmin"
                        @click.stop="scoutPlayer(getPlayerForRole(role).id)"
                        :disabled="scoutingStore.isScouting"
                        class="text-xs px-3 py-1.5 bg-green-600/80 hover:bg-green-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        Scout
                      </button>
                      <button
                        v-if="authStore.isAdmin"
                        @click.stop="deletePlayer(getPlayerForRole(role).id)"
                        class="text-xs px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-md transition-colors font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p v-else class="text-gray-500 text-sm italic">Click to add player</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- No Team Selected -->
        <div v-else class="text-center py-12">
          <p class="text-gray-400">Please select a team to manage players</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Team Form Modal -->
  <Transition name="fade">
    <Teleport to="body">
      <div
        v-if="showCreateTeamForm || showEditTeamForm"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        @click.self="closeTeamForm"
      >
        <div class="bg-gray-800 rounded-lg w-full max-w-md border border-gray-700 p-6">
          <h3 class="text-xl font-semibold text-white mb-4">
            {{ showEditTeamForm ? 'Edit Team' : 'Create Team' }}
          </h3>
          <form @submit.prevent="handleSubmitTeam" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Team Name *</label>
              <input
                v-model="teamForm.name"
                type="text"
                required
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                placeholder="Team Name"
              />
            </div>
            <div v-if="teamFormError" class="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
              {{ teamFormError }}
            </div>
            <div class="flex justify-end gap-3 mt-6">
              <button
                type="button"
                @click="closeTeamForm"
                class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="isSubmittingTeam"
                class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors disabled:opacity-50"
              >
                {{ isSubmittingTeam ? 'Saving...' : (showEditTeamForm ? 'Save' : 'Create') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </Transition>

  <!-- Player Form Modal -->
  <Transition name="fade">
    <Teleport to="body">
      <div
        v-if="showPlayerForm"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        @click.self="closePlayerForm"
      >
        <div class="bg-gray-800 rounded-lg w-full max-w-md border border-gray-700 p-6">
          <h3 class="text-xl font-semibold text-white mb-4">
            {{ editingPlayerId ? 'Edit Player' : 'Add Player' }}
          </h3>
          <form @submit.prevent="handleSubmitPlayer" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Player Name *</label>
              <input
                v-model="playerForm.name"
                type="text"
                required
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                placeholder="Summoner Name"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">op.gg URL *</label>
              <input
                v-model="playerForm.opggUrl"
                type="url"
                required
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                placeholder="https://www.op.gg/summoners/euw/..."
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Leaguepedia URL</label>
              <input
                v-model="playerForm.leaguepediaUrl"
                type="url"
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                placeholder="https://lol.fandom.com/wiki/..."
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Team</label>
              <input
                :value="scoutingStore.selectedTeam?.name || 'No team selected'"
                type="text"
                disabled
                class="w-full px-3 py-2 bg-gray-600 border border-gray-600 rounded text-gray-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Role</label>
              <input
                :value="playerForm.role"
                type="text"
                disabled
                class="w-full px-3 py-2 bg-gray-600 border border-gray-600 rounded text-gray-400 cursor-not-allowed"
              />
            </div>
            <div v-if="formError" class="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
              {{ formError }}
            </div>
            <div class="flex justify-end gap-3 mt-6">
              <button
                type="button"
                @click="closePlayerForm"
                class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="isSubmitting"
                class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors disabled:opacity-50"
              >
                {{ isSubmitting ? 'Saving...' : (editingPlayerId ? 'Save' : 'Add') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </Transition>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { useScoutingStore } from '@/stores/scouting'
import { useAuthStore } from '@/stores/auth'
import { useConfirmationStore } from '@/stores/confirmation'
import { useChampionsStore } from '@/stores/champions'
import { scoutingService } from '@/services/scouting/scoutingService'

const scoutingStore = useScoutingStore()
const authStore = useAuthStore()
const confirmationStore = useConfirmationStore()
const championsStore = useChampionsStore()

const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']
const showPlayerForm = ref(false)
const showCreateTeamForm = ref(false)
const showEditTeamForm = ref(false)
const editingPlayerId = ref(null)
const isSubmitting = ref(false)
const isSubmittingTeam = ref(false)
const formError = ref('')
const teamFormError = ref('')

const selectedTeamId = computed({
  get: () => scoutingStore.selectedTeamId,
  set: (value) => scoutingStore.setSelectedTeamId(value)
})

const teamForm = ref({
  name: ''
})

const playerForm = ref({
  name: '',
  opggUrl: '',
  leaguepediaUrl: '',
  role: 'Top'
})

// Sync selected team when store changes
watch(() => scoutingStore.selectedTeamId, (newId) => {
  if (newId && !selectedTeamId.value) {
    selectedTeamId.value = newId
  }
})

onMounted(async () => {
  // Teams and players are already loaded by ScoutingView
  // Just ensure a team is selected if available
  if (!scoutingStore.selectedTeamId && scoutingStore.teams.length > 0) {
    scoutingStore.setSelectedTeamId(scoutingStore.teams[0].id)
  }
})

const handleTeamChange = () => {
  scoutingStore.setSelectedTeamId(selectedTeamId.value)
}

const getPlayerForRole = (role) => {
  return scoutingStore.getPlayerByTeamAndRole(role)
}

const openPlayerForm = (role) => {
  if (!authStore.isAdmin) return
  if (!scoutingStore.selectedTeamId) {
    formError.value = 'Please select a team first'
    return
  }
  
  const existingPlayer = getPlayerForRole(role)
  
  if (existingPlayer) {
    editingPlayerId.value = existingPlayer.id
    playerForm.value = {
      name: existingPlayer.name,
      opggUrl: existingPlayer.opggUrl || '',
      leaguepediaUrl: existingPlayer.leaguepediaUrl || '',
      role: role
    }
  } else {
    editingPlayerId.value = null
    playerForm.value = {
      name: '',
      opggUrl: '',
      leaguepediaUrl: '',
      role: role
    }
  }
  
  formError.value = ''
  showPlayerForm.value = true
}

const closePlayerForm = () => {
  showPlayerForm.value = false
  editingPlayerId.value = null
  formError.value = ''
  playerForm.value = {
    name: '',
    opggUrl: '',
    leaguepediaUrl: '',
    role: 'Top'
  }
}

const handleSubmitPlayer = async () => {
  if (!authStore.isAdmin) return
  if (!scoutingStore.selectedTeamId) {
    formError.value = 'Please select a team first'
    return
  }
  
  isSubmitting.value = true
  formError.value = ''
  
  try {
    if (editingPlayerId.value) {
      // Update existing player
      await scoutingStore.updatePlayer(editingPlayerId.value, {
        name: playerForm.value.name,
        opggUrl: playerForm.value.opggUrl,
        leaguepediaUrl: playerForm.value.leaguepediaUrl || null
      })
    } else {
      // Add new player
      await scoutingStore.addPlayer({
        name: playerForm.value.name,
        opggUrl: playerForm.value.opggUrl,
        leaguepediaUrl: playerForm.value.leaguepediaUrl || null,
        teamId: scoutingStore.selectedTeamId,
        role: playerForm.value.role
      })
    }
    
    closePlayerForm()
  } catch (error) {
    console.error('Error saving player:', error)
    formError.value = error.message || 'Failed to save player'
  } finally {
    isSubmitting.value = false
  }
}

const editPlayer = (playerId) => {
  const player = scoutingStore.players.find(p => p.id === playerId)
  if (player) {
    openPlayerForm(player.role)
  }
}

const scoutPlayer = async (playerId) => {
  if (!authStore.isAdmin) return
  
  try {
    await scoutingService.scoutPlayer(playerId)
    await scoutingStore.loadScoutingData(playerId)
  } catch (error) {
    console.error('Error scouting player:', error)
  }
}

const deletePlayer = (playerId) => {
  if (!authStore.isAdmin) return
  
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

const closeTeamForm = () => {
  showCreateTeamForm.value = false
  showEditTeamForm.value = false
  teamFormError.value = ''
  teamForm.value = {
    name: ''
  }
}

const handleSubmitTeam = async () => {
  if (!authStore.isAdmin) return
  
  isSubmittingTeam.value = true
  teamFormError.value = ''
  
  try {
    if (showEditTeamForm.value && scoutingStore.selectedTeamId) {
      // Update existing team
      await scoutingStore.updateTeam(scoutingStore.selectedTeamId, {
        name: teamForm.value.name.trim()
      })
    } else {
      // Create new team
      await scoutingStore.addTeam({
        name: teamForm.value.name.trim()
      })
    }
    
    closeTeamForm()
  } catch (error) {
    console.error('Error saving team:', error)
    teamFormError.value = error.message || 'Failed to save team'
  } finally {
    isSubmittingTeam.value = false
  }
}

const deleteCurrentTeam = () => {
  if (!authStore.isAdmin || !scoutingStore.selectedTeamId) return
  
  const team = scoutingStore.selectedTeam
  confirmationStore.open({
    message: `Are you sure you want to delete team "${team?.name || 'this team'}"?`,
    confirmAction: async () => {
      try {
        await scoutingStore.deleteTeam(scoutingStore.selectedTeamId)
      } catch (error) {
        console.error('Error deleting team:', error)
        scoutingStore.setError(error.message || 'Failed to delete team')
      }
    },
    isDanger: true
  })
}

// Open edit team form
watch(() => showEditTeamForm.value, (isOpen) => {
  if (isOpen && scoutingStore.selectedTeam) {
    teamForm.value = {
      name: scoutingStore.selectedTeam.name
    }
  }
})

const scoutAllPlayers = async () => {
  if (!authStore.isAdmin) return
  if (!scoutingStore.selectedTeamId || scoutingStore.selectedTeamPlayers.length === 0) return
  
  confirmationStore.open({
    message: `Scout all ${scoutingStore.selectedTeamPlayers.length} players in ${scoutingStore.selectedTeam?.name}? This may take a while.`,
    confirmAction: async () => {
      try {
        const players = scoutingStore.selectedTeamPlayers
        const delay = 2000 // 2 second delay between players
        
        for (let i = 0; i < players.length; i++) {
          const player = players[i]
          
          try {
            await scoutingService.scoutPlayer(player.id)
            await scoutingStore.loadScoutingData(player.id)
            
            // Add delay between requests (except for last player)
            if (i < players.length - 1) {
              await new Promise(resolve => setTimeout(resolve, delay))
            }
          } catch (error) {
            console.error(`Error scouting player ${player.name}:`, error)
            // Continue with next player
          }
        }
      } catch (error) {
        console.error('Error scouting all players:', error)
        scoutingStore.setError(`Failed to scout all players: ${error.message}`)
      }
    },
    isDanger: false
  })
}
</script>

<style scoped>
.manage-players-view {
  background-color: #121212;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.scout-all-icon-spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

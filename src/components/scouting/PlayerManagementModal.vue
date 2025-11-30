<template>
  <Transition name="fade">
    <Teleport to="body">
      <div
        v-if="isOpen"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        @click.self="$emit('close')"
      >
        <div class="bg-gray-800 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-gray-700">
            <h2 class="text-2xl font-semibold text-white">Manage Players</h2>
            <button
              @click="$emit('close')"
              class="text-gray-400 hover:text-white transition-colors"
            >
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <div class="grid grid-cols-2 gap-6">
              <!-- Own Team -->
              <div class="space-y-4">
                <!-- Team Name -->
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Team Name</label>
                  <input
                    v-model="ownTeamNameInput"
                    @blur="saveTeamName('own', ownTeamNameInput)"
                    @keyup.enter="saveTeamName('own', ownTeamNameInput)"
                    class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                    placeholder="Your Team"
                  />
                </div>

                <!-- Role Slots -->
                <div class="space-y-2">
                  <div
                    v-for="role in roles"
                    :key="`own-${role}`"
                    class="bg-gray-700 rounded p-3 cursor-pointer hover:bg-gray-600 transition-colors"
                    @click="openPlayerForm('own', role)"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex-1">
                        <p class="text-sm font-medium text-gray-300 mb-1">{{ role }}</p>
                        <div v-if="getPlayerForRole('own', role)" class="space-y-1">
                          <p class="text-white font-medium">{{ getPlayerForRole('own', role).name }}</p>
                          <div class="flex items-center gap-2">
                            <button
                              v-if="authStore.isAdmin"
                              @click.stop="editPlayer(getPlayerForRole('own', role).id)"
                              class="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              v-if="authStore.isAdmin"
                              @click.stop="scoutPlayer(getPlayerForRole('own', role).id)"
                              :disabled="scoutingStore.isScouting"
                              class="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
                            >
                              Scout
                            </button>
                            <button
                              v-if="authStore.isAdmin"
                              @click.stop="deletePlayer(getPlayerForRole('own', role).id)"
                              class="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <p v-else class="text-gray-500 text-sm">Click to add player</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Enemy Team -->
              <div class="space-y-4">
                <!-- Team Name -->
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Team Name</label>
                  <input
                    v-model="enemyTeamNameInput"
                    @blur="saveTeamName('enemy', enemyTeamNameInput)"
                    @keyup.enter="saveTeamName('enemy', enemyTeamNameInput)"
                    class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                    placeholder="Enemy Team"
                  />
                </div>

                <!-- Role Slots -->
                <div class="space-y-2">
                  <div
                    v-for="role in roles"
                    :key="`enemy-${role}`"
                    class="bg-gray-700 rounded p-3 cursor-pointer hover:bg-gray-600 transition-colors"
                    @click="openPlayerForm('enemy', role)"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex-1">
                        <p class="text-sm font-medium text-gray-300 mb-1">{{ role }}</p>
                        <div v-if="getPlayerForRole('enemy', role)" class="space-y-1">
                          <p class="text-white font-medium">{{ getPlayerForRole('enemy', role).name }}</p>
                          <div class="flex items-center gap-2">
                            <button
                              v-if="authStore.isAdmin"
                              @click.stop="editPlayer(getPlayerForRole('enemy', role).id)"
                              class="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              v-if="authStore.isAdmin"
                              @click.stop="scoutPlayer(getPlayerForRole('enemy', role).id)"
                              :disabled="scoutingStore.isScouting"
                              class="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
                            >
                              Scout
                            </button>
                            <button
                              v-if="authStore.isAdmin"
                              @click.stop="deletePlayer(getPlayerForRole('enemy', role).id)"
                              class="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <p v-else class="text-gray-500 text-sm">Click to add player</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
                  :value="playerForm.team === 'own' ? scoutingStore.ownTeamName : scoutingStore.enemyTeamName"
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
import { ref, watch, computed, Teleport, Transition } from 'vue'
import { useScoutingStore } from '@/stores/scouting'
import { useAuthStore } from '@/stores/auth'
import { useConfirmationStore } from '@/stores/confirmation'
import { scoutingService } from '@/services/scouting/scoutingService'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['close', 'player-updated', 'player-added', 'player-deleted', 'team-name-updated'])

const scoutingStore = useScoutingStore()
const authStore = useAuthStore()
const confirmationStore = useConfirmationStore()

const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']
const showPlayerForm = ref(false)
const editingPlayerId = ref(null)
const isSubmitting = ref(false)
const formError = ref('')

const ownTeamNameInput = ref('')
const enemyTeamNameInput = ref('')

const playerForm = ref({
  name: '',
  opggUrl: '',
  leaguepediaUrl: '',
  team: 'own',
  role: 'Top'
})

// Watch for modal open to sync team names
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    ownTeamNameInput.value = scoutingStore.ownTeamName
    enemyTeamNameInput.value = scoutingStore.enemyTeamName
  }
})

const getPlayerForRole = (team, role) => {
  return scoutingStore.getPlayerByTeamAndRole(team, role)
}

const openPlayerForm = (team, role) => {
  if (!authStore.isAdmin) return
  
  const existingPlayer = getPlayerForRole(team, role)
  
  if (existingPlayer) {
    editingPlayerId.value = existingPlayer.id
    playerForm.value = {
      name: existingPlayer.name,
      opggUrl: existingPlayer.opggUrl || '',
      leaguepediaUrl: existingPlayer.leaguepediaUrl || '',
      team: team,
      role: role
    }
  } else {
    editingPlayerId.value = null
    playerForm.value = {
      name: '',
      opggUrl: '',
      leaguepediaUrl: '',
      team: team,
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
    team: 'own',
    role: 'Top'
  }
}

const handleSubmitPlayer = async () => {
  if (!authStore.isAdmin) return
  
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
      emit('player-updated', editingPlayerId.value)
    } else {
      // Add new player
      await scoutingStore.addPlayer({
        name: playerForm.value.name,
        opggUrl: playerForm.value.opggUrl,
        leaguepediaUrl: playerForm.value.leaguepediaUrl || null,
        team: playerForm.value.team,
        role: playerForm.value.role
      })
      emit('player-added')
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
    openPlayerForm(player.team, player.role)
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
        emit('player-deleted', playerId)
      } catch (error) {
        console.error('Error deleting player:', error)
      }
    },
    isDanger: true
  })
}

const saveTeamName = async (team, name) => {
  if (!authStore.isAdmin) return
  if (!name || name.trim() === '') return
  
  const currentName = team === 'own' ? scoutingStore.ownTeamName : scoutingStore.enemyTeamName
  if (name.trim() === currentName) return
  
  try {
    await scoutingStore.updateTeamName(team, name.trim())
    emit('team-name-updated', team, name.trim())
  } catch (error) {
    console.error('Error updating team name:', error)
    // Revert input on error
    if (team === 'own') {
      ownTeamNameInput.value = scoutingStore.ownTeamName
    } else {
      enemyTeamNameInput.value = scoutingStore.enemyTeamName
    }
  }
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

<template>
  <div class="player-card-container relative bg-gray-800 rounded-lg border border-gray-700 p-3 flex flex-col h-full overflow-hidden">
    <!-- Role Icon (70/30 positioning like Champion Pool) -->
    <img 
      :src="roleIconUrl" 
      :alt="role" 
      class="player-card-role-icon" 
    />
    
    <!-- Player Name Header (centered) -->
    <div class="mb-2 text-center">
      <h3 
        v-if="currentPlayer"
        class="text-base font-semibold text-white cursor-pointer hover:text-amber-500 transition-colors"
        @click="openPlayerDetail"
      >
        {{ currentPlayer.name }}
      </h3>
      <h3 v-else class="text-base font-semibold text-gray-500">No Player</h3>
    </div>

    <!-- Empty State -->
    <div v-if="!currentPlayer" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <p class="text-gray-400 text-sm">No player assigned</p>
      </div>
    </div>

    <!-- Player Data -->
    <div v-else class="flex-1 flex flex-col min-h-0">
      <!-- Loading State -->
      <div v-if="isLoadingData" class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto mb-2"></div>
          <p class="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>

      <!-- Statistics -->
      <div v-else-if="scoutingData" class="flex-1 flex flex-col min-h-0 bg-gray-700 rounded overflow-hidden">
        <!-- Shared Table Header -->
        <div class="flex-shrink-0 border-b border-gray-600">
          <table class="w-full text-xs">
            <thead class="bg-gray-800">
              <tr>
                <th class="text-left py-1 px-2 font-semibold text-white">CHAMPION</th>
                <th class="text-center py-1 px-2 font-semibold text-white">G</th>
                <th class="text-center py-1 px-2 font-semibold text-white">W</th>
                <th class="text-center py-1 px-2 font-semibold text-white">L</th>
                <th class="text-center py-1 px-2 font-semibold text-white">WR%</th>
                <th class="text-center py-1 px-2 font-semibold text-white">KDA</th>
              </tr>
            </thead>
          </table>
        </div>

        <!-- Data Sections Container -->
        <div class="flex-1 flex flex-col min-h-0" style="height: 0;">
          <!-- SoloQ Section -->
          <div class="flex flex-col overflow-hidden" style="flex: 1 1 0; min-height: 0;">
            <div class="flex-shrink-0 px-2 py-1 bg-gray-600 text-xs font-semibold text-gray-300 border-b border-gray-600">
              SoloQ (op.gg)
            </div>
            <div class="flex-1 overflow-y-auto min-h-0" style="height: 0;">
              <table class="w-full text-xs">
                <tbody>
                  <tr 
                    v-for="champ in soloqChampions" 
                    :key="`soloq-${champ.championName}`"
                    class="border-b border-gray-600 hover:bg-gray-600 transition-colors"
                  >
                    <td class="py-1 px-2">
                      <div class="flex items-center gap-1.5">
                        <img 
                          :src="getChampionIconUrl(champ.championName)" 
                          :alt="champ.championName"
                          class="w-4 h-4 rounded"
                          @error="handleImageError"
                        />
                        <span class="text-white">{{ champ.championName }}</span>
                      </div>
                    </td>
                    <td class="text-center py-1 px-2 text-white">{{ champ.games || 0 }}</td>
                    <td class="text-center py-1 px-2 text-white">{{ champ.wins || 0 }}</td>
                    <td class="text-center py-1 px-2 text-white">{{ champ.losses || (champ.games || 0) - (champ.wins || 0) }}</td>
                    <td class="text-center py-1 px-2 text-white">{{ formatWinrate(champ.winrate) }}</td>
                    <td class="text-center py-1 px-2 text-white">{{ formatKDA(champ.kda) }}</td>
                  </tr>
                  <tr v-if="soloqChampions.length === 0">
                    <td colspan="6" class="text-center py-1.5 text-gray-500 text-xs">No SoloQ data</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Competitive Section -->
          <div class="flex flex-col overflow-hidden" style="flex: 1 1 0; min-height: 0;">
            <div class="flex-shrink-0 px-2 py-1 bg-gray-600 text-xs font-semibold text-gray-300 border-t border-gray-600 border-b border-gray-600">
              Competitive (Leaguepedia)
            </div>
            <div class="flex-1 overflow-y-auto min-h-0" style="height: 0;">
              <table class="w-full text-xs">
                <tbody>
                  <tr 
                    v-for="champ in competitiveChampions" 
                    :key="`comp-${champ.championName}`"
                    class="border-b border-gray-600 hover:bg-gray-600 transition-colors"
                  >
                    <td class="py-1 px-2">
                      <div class="flex items-center gap-1.5">
                        <img 
                          :src="getChampionIconUrl(champ.championName)" 
                          :alt="champ.championName"
                          class="w-4 h-4 rounded"
                          @error="handleImageError"
                        />
                        <span class="text-white">{{ champ.championName }}</span>
                      </div>
                    </td>
                    <td class="text-center py-1 px-2 text-white">{{ champ.games || 0 }}</td>
                    <td class="text-center py-1 px-2 text-white">{{ champ.wins || 0 }}</td>
                    <td class="text-center py-1 px-2 text-white">{{ champ.losses || (champ.games || 0) - (champ.wins || 0) }}</td>
                    <td class="text-center py-1 px-2 text-white">{{ formatWinrate(champ.winrate) }}</td>
                    <td class="text-center py-1 px-2 text-white">{{ formatKDA(champ.kda) }}</td>
                  </tr>
                  <tr v-if="competitiveChampions.length === 0">
                    <td colspan="6" class="text-center py-1.5 text-gray-500 text-xs">No competitive data</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- No Data State -->
      <div v-else class="flex-1 flex items-center justify-center">
        <p class="text-gray-400 text-sm text-center">No scouting data available</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useScoutingStore } from '@/stores/scouting'
import { useChampionsStore } from '@/stores/champions'

const props = defineProps({
  role: {
    type: String,
    required: true,
    validator: (value) => ['Top', 'Jungle', 'Mid', 'Bot', 'Support'].includes(value)
  },
  selectedTeam: {
    type: String,
    required: true,
    validator: (value) => ['own', 'enemy'].includes(value)
  }
})

const emit = defineEmits(['open-detail'])

const scoutingStore = useScoutingStore()
const championsStore = useChampionsStore()
const isLoadingData = ref(false)

const currentPlayer = computed(() => {
  return scoutingStore.getPlayerByTeamAndRole(props.selectedTeam, props.role)
})

const roleIconUrl = computed(() => {
  return championsStore.getRoleIconUrl(props.role)
})

const scoutingData = computed(() => {
  if (!currentPlayer.value) return null
  return scoutingStore.scoutingData[currentPlayer.value.id]
})

const soloqChampions = computed(() => {
  if (!scoutingData.value?.soloq?.currentSeason?.champions) return []
  return [...scoutingData.value.soloq.currentSeason.champions]
    .sort((a, b) => (b.games || 0) - (a.games || 0))
})

const competitiveChampions = computed(() => {
  if (!scoutingData.value?.proplay?.championPool) return []
  return [...scoutingData.value.proplay.championPool]
    .sort((a, b) => (b.games || 0) - (a.games || 0))
})

const getChampionIconUrl = (championName) => {
  return championsStore.getChampionIconUrl(championName, 'list')
}

const formatWinrate = (winrate) => {
  if (winrate === null || winrate === undefined) return '0,00%'
  return `${winrate.toFixed(2).replace('.', ',')}%`
}

const formatKDA = (kda) => {
  if (!kda) return '0.00'
  
  if (typeof kda === 'object') {
    // If ratio is available, use it
    if (kda.ratio !== undefined) {
      return kda.ratio.toFixed(2)
    }
    
    // Otherwise, calculate ratio from kills, deaths, assists
    if (kda.kills !== undefined && kda.deaths !== undefined && kda.assists !== undefined) {
      const kills = parseFloat(kda.kills) || 0
      const deaths = parseFloat(kda.deaths) || 0
      const assists = parseFloat(kda.assists) || 0
      
      if (deaths > 0) {
        const ratio = (kills + assists) / deaths
        return ratio.toFixed(2)
      } else if (kills + assists > 0) {
        // Perfect KDA (no deaths)
        return (kills + assists).toFixed(2)
      }
    }
  }
  
  if (typeof kda === 'number') {
    return kda.toFixed(2)
  }
  
  return '0.00'
}

const handleImageError = (event) => {
  // Fallback to placeholder if image fails to load
  event.target.src = 'https://placehold.co/20x20/374151/9ca3af?text=?'
}

const openPlayerDetail = () => {
  if (currentPlayer.value) {
    emit('open-detail', currentPlayer.value.id)
  }
}

// Load scouting data when player changes
watch(() => currentPlayer.value?.id, async (playerId) => {
  if (playerId && !scoutingStore.scoutingData[playerId]) {
    isLoadingData.value = true
    try {
      await scoutingStore.loadScoutingData(playerId)
    } catch (error) {
      console.error('Error loading scouting data:', error)
    } finally {
      isLoadingData.value = false
    }
  }
}, { immediate: true })

onMounted(async () => {
  if (currentPlayer.value?.id && !scoutingStore.scoutingData[currentPlayer.value.id]) {
    isLoadingData.value = true
    try {
      await scoutingStore.loadScoutingData(currentPlayer.value.id)
    } catch (error) {
      console.error('Error loading scouting data:', error)
    } finally {
      isLoadingData.value = false
    }
  }
})
</script>

<style scoped>
.player-card-container {
  position: relative;
  overflow: visible;
}

.player-card-role-icon {
  position: absolute;
  top: -17px; /* 70% outside, 30% inside (24px icon: ~17px outside, ~7px inside) */
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 24px;
  z-index: 10;
  background-color: #1e1e1e;
  border: 1px solid #3a3a3a;
  border-radius: 50%;
  padding: 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

/* Custom scrollbar for tables */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #1e1e1e;
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #4a4a4a;
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #5a5a5a;
}

/* Table styling */
table {
  border-collapse: collapse;
}

th, td {
  border: 1px solid #3a3a3a;
}

tbody tr:last-child td {
  border-bottom: none;
}
</style>

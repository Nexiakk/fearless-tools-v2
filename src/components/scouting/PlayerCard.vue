<template>
  <div class="bg-gray-800 rounded-lg border border-gray-700 p-4 flex flex-col min-h-[400px]">
    <!-- Header -->
    <div class="mb-4">
      <h3 class="text-lg font-semibold text-white mb-2">{{ role }}</h3>
      <p class="text-sm text-gray-400">{{ teamName }}</p>
    </div>

    <!-- Empty State -->
    <div v-if="!currentPlayer" class="flex-1 flex items-center justify-center min-h-[300px]">
      <div class="text-center">
        <p class="text-gray-400 mb-2">No player assigned</p>
        <p class="text-xs text-gray-500">{{ teamName }}</p>
      </div>
    </div>

    <!-- Player Data -->
    <div v-else class="flex-1 flex flex-col">
      <!-- Player Info -->
      <div 
        class="mb-4 cursor-pointer hover:bg-gray-700 rounded p-2 transition-colors"
        @click="openPlayerDetail"
      >
        <p class="text-white font-medium">{{ currentPlayer.name }}</p>
        <p v-if="scoutingData" class="text-xs text-gray-400 mt-1">
          {{ getLastUpdatedText() }}
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="isLoadingData" class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto mb-2"></div>
          <p class="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>

      <!-- Statistics -->
      <div v-else-if="scoutingData" class="flex-1 space-y-4 overflow-y-auto">
        <!-- SoloQ Stats -->
        <div v-if="scoutingData.soloq?.currentSeason" class="bg-gray-700 rounded p-3">
          <h4 class="text-sm font-semibold text-white mb-2">SoloQ</h4>
          <div class="space-y-1 text-xs">
            <div class="flex justify-between">
              <span class="text-gray-400">Rank:</span>
              <span class="text-white">{{ scoutingData.soloq.currentSeason.rank || 'Unknown' }}</span>
            </div>
            <div v-if="scoutingData.soloq.currentSeason.lp" class="flex justify-between">
              <span class="text-gray-400">LP:</span>
              <span class="text-white">{{ scoutingData.soloq.currentSeason.lp }}</span>
            </div>
            <div v-if="topChampions.soloq.length > 0" class="mt-2 pt-2 border-t border-gray-600">
              <p class="text-gray-400 mb-1">Top Champions:</p>
              <div class="space-y-1">
                <div 
                  v-for="champ in topChampions.soloq.slice(0, 5)" 
                  :key="champ.championName"
                  class="flex justify-between text-xs"
                >
                  <span class="text-white">{{ champ.championName }}</span>
                  <span class="text-gray-400">
                    {{ champ.games }}g {{ champ.winrate?.toFixed(0) || 0 }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pro Play Stats -->
        <div v-if="scoutingData.proplay" class="bg-gray-700 rounded p-3">
          <h4 class="text-sm font-semibold text-white mb-2">Pro Play</h4>
          <div class="space-y-1 text-xs">
            <div v-if="scoutingData.proplay.playerInfo?.Team" class="flex justify-between">
              <span class="text-gray-400">Team:</span>
              <span class="text-white">{{ scoutingData.proplay.playerInfo.Team }}</span>
            </div>
            <div v-if="topChampions.proplay.length > 0" class="mt-2 pt-2 border-t border-gray-600">
              <p class="text-gray-400 mb-1">Top Champions:</p>
              <div class="space-y-1">
                <div 
                  v-for="champ in topChampions.proplay.slice(0, 5)" 
                  :key="champ.championName"
                  class="flex justify-between text-xs"
                >
                  <span class="text-white">{{ champ.championName }}</span>
                  <span class="text-gray-400">
                    {{ champ.games }}g {{ champ.winrate?.toFixed(0) || 0 }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Summary -->
        <div class="bg-gray-700 rounded p-3">
          <h4 class="text-sm font-semibold text-white mb-2">Summary</h4>
          <div class="space-y-1 text-xs">
            <div class="flex justify-between">
              <span class="text-gray-400">Total Champions:</span>
              <span class="text-white">{{ totalChampions }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- No Data State -->
      <div v-else class="flex-1 flex items-center justify-center min-h-[200px]">
        <p class="text-gray-400 text-sm text-center">No scouting data available</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useScoutingStore } from '@/stores/scouting'

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
const isLoadingData = ref(false)

const currentPlayer = computed(() => {
  return scoutingStore.getPlayerByTeamAndRole(props.selectedTeam, props.role)
})

const teamName = computed(() => {
  return props.selectedTeam === 'own' 
    ? scoutingStore.ownTeamName 
    : scoutingStore.enemyTeamName
})

const scoutingData = computed(() => {
  if (!currentPlayer.value) return null
  return scoutingStore.scoutingData[currentPlayer.value.id]
})

const topChampions = computed(() => {
  const result = {
    soloq: [],
    proplay: []
  }
  
  if (scoutingData.value?.soloq?.currentSeason?.champions) {
    result.soloq = [...scoutingData.value.soloq.currentSeason.champions]
      .sort((a, b) => (b.games || 0) - (a.games || 0))
  }
  
  if (scoutingData.value?.proplay?.championPool) {
    result.proplay = [...scoutingData.value.proplay.championPool]
      .sort((a, b) => (b.games || 0) - (a.games || 0))
  }
  
  return result
})

const totalChampions = computed(() => {
  const champions = new Set()
  if (scoutingData.value?.soloq?.currentSeason?.champions) {
    scoutingData.value.soloq.currentSeason.champions.forEach(champ => {
      champions.add(champ.championName)
    })
  }
  if (scoutingData.value?.proplay?.championPool) {
    scoutingData.value.proplay.championPool.forEach(champ => {
      champions.add(champ.championName)
    })
  }
  return champions.size
})

const getLastUpdatedText = () => {
  if (!scoutingData.value?.lastUpdated) return 'Not scouted'
  
  const lastUpdated = scoutingData.value.lastUpdated.toDate 
    ? scoutingData.value.lastUpdated.toDate() 
    : new Date(scoutingData.value.lastUpdated)
  const hoursSinceUpdate = (new Date() - lastUpdated) / (1000 * 60 * 60)
  
  if (hoursSinceUpdate < 24) {
    return `Updated ${Math.round(hoursSinceUpdate)}h ago`
  } else {
    const daysSinceUpdate = Math.floor(hoursSinceUpdate / 24)
    return `Updated ${daysSinceUpdate}d ago`
  }
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

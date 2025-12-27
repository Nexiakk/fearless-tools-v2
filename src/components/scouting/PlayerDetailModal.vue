<template>
  <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" @click.self="$emit('close')">
    <div class="bg-[#1a1a1a] rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-lg">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-700">
        <div>
          <h2 class="text-2xl font-semibold text-white">{{ player?.name || 'Player Details' }}</h2>
          <p v-if="player?.role" class="text-sm text-gray-400 mt-1">
            {{ player.role }}
            <span v-if="playerTeam"> • {{ playerTeam.name }}</span>
            <span v-else-if="player?.teamId"> • Team ID: {{ player.teamId }}</span>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="authStore.isAdmin"
            @click="refreshScouting"
            :disabled="isRefreshing"
            class="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
          >
            {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}
          </button>
          <button
            @click="$emit('close')"
            class="text-gray-400 hover:text-white transition-colors"
          >
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="!scoutingData" class="text-center py-12">
          <p class="text-gray-400 mb-4">No scouting data available</p>
          <button
            v-if="authStore.isAdmin"
            @click="refreshScouting"
            class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
          >
            Scout Player
          </button>
        </div>

        <div v-else class="space-y-6">
          <!-- SoloQ Data -->
          <div v-if="scoutingData.soloq" class="bg-[#1a1a1a] border border-gray-700 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-white mb-4">SoloQ Stats</h3>
            <div v-if="scoutingData.soloq.currentSeason" class="space-y-4">
              <div class="flex items-center gap-4 text-sm">
                <span class="text-gray-400">Rank:</span>
                <span class="text-white">{{ scoutingData.soloq.currentSeason.rank || 'Unknown' }}</span>
                <span v-if="scoutingData.soloq.currentSeason.lp" class="text-gray-400">
                  ({{ scoutingData.soloq.currentSeason.lp }} LP)
                </span>
              </div>
              <div v-if="scoutingData.soloq.currentSeason.champions && scoutingData.soloq.currentSeason.champions.length > 0">
                <h4 class="text-md font-medium text-white mb-2">
                  Champion Pool ({{ scoutingData.soloq.currentSeason.champions.length }} champions)
                </h4>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  <div
                    v-for="champ in scoutingData.soloq.currentSeason.champions.slice(0, 12)"
                    :key="champ.championName"
                    class="p-2 bg-[#1a1a1a] border border-gray-700 rounded text-sm"
                  >
                    <p class="text-white font-medium">{{ champ.championName }}</p>
                    <p class="text-gray-400 text-xs">
                      {{ champ.games }} games • {{ champ.winrate?.toFixed(1) || 0 }}% WR
                    </p>
                  </div>
                </div>
              </div>
              <div v-else-if="scoutingData.soloq.currentSeason" class="text-yellow-400 text-sm">
                ⚠️ No champion data found. Check browser console for debugging information.
              </div>
            </div>
            <p v-else class="text-gray-400 text-sm">No SoloQ data available</p>
          </div>

          <!-- Pro Play Data -->
          <div v-if="scoutingData.proplay" class="bg-[#1a1a1a] border border-gray-700 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-white mb-4">Pro Play Stats</h3>
            <div v-if="scoutingData.proplay.playerInfo" class="mb-4">
              <div class="flex items-center gap-4 text-sm">
                <span v-if="scoutingData.proplay.playerInfo.Team" class="text-gray-400">
                  Team: <span class="text-white">{{ scoutingData.proplay.playerInfo.Team }}</span>
                </span>
                <span v-if="scoutingData.proplay.playerInfo.Region" class="text-gray-400">
                  Region: <span class="text-white">{{ scoutingData.proplay.playerInfo.Region }}</span>
                </span>
              </div>
            </div>
            <div v-if="scoutingData.proplay.championPool && scoutingData.proplay.championPool.length > 0">
              <h4 class="text-md font-medium text-white mb-2">Champion Pool</h4>
              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                <div
                  v-for="champ in scoutingData.proplay.championPool.slice(0, 12)"
                  :key="champ.championName"
                  class="p-2 bg-[#1a1a1a] border border-amber-500/20 rounded text-sm"
                >
                  <p class="text-white font-medium">{{ champ.championName }}</p>
                  <p class="text-gray-400 text-xs">
                    {{ champ.games }} games • {{ champ.winrate?.toFixed(1) || 0 }}% WR
                  </p>
                </div>
              </div>
            </div>
            <div v-if="scoutingData.proplay.recentMatches && scoutingData.proplay.recentMatches.length > 0" class="mt-4">
              <h4 class="text-md font-medium text-white mb-2">Recent Matches</h4>
              <div class="space-y-2">
                <div
                  v-for="(match, index) in scoutingData.proplay.recentMatches.slice(0, 5)"
                  :key="index"
                  class="p-2 bg-[#1a1a1a] border border-amber-500/20 rounded text-sm flex items-center justify-between"
                >
                  <div class="flex items-center gap-2">
                    <span :class="match.win ? 'text-green-400' : 'text-red-400'">
                      {{ match.win ? 'W' : 'L' }}
                    </span>
                    <span class="text-white">{{ match.champion }}</span>
                    <span v-if="match.opponent" class="text-gray-400">vs {{ match.opponent }}</span>
                  </div>
                  <span v-if="match.tournament" class="text-gray-500 text-xs">{{ match.tournament }}</span>
                </div>
              </div>
            </div>
            <p v-if="!scoutingData.proplay.championPool || scoutingData.proplay.championPool.length === 0" class="text-gray-400 text-sm">No pro play data available</p>
          </div>

          <!-- Analytics -->
          <div v-if="scoutingData.analytics" class="bg-[#1a1a1a] border border-gray-700 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-white mb-4">Analytics</h3>
            <div v-if="scoutingData.analytics.soloqVsProplay" class="mb-4">
              <h4 class="text-md font-medium text-white mb-2">SoloQ vs Pro Play</h4>
              <div class="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p class="text-gray-400">SoloQ Only</p>
                  <p class="text-white font-medium">{{ scoutingData.analytics.soloqVsProplay.onlySoloq?.length || 0 }}</p>
                </div>
                <div>
                  <p class="text-gray-400">Pro Play Only</p>
                  <p class="text-white font-medium">{{ scoutingData.analytics.soloqVsProplay.onlyProplay?.length || 0 }}</p>
                </div>
                <div>
                  <p class="text-gray-400">Both</p>
                  <p class="text-white font-medium">{{ scoutingData.analytics.soloqVsProplay.both?.length || 0 }}</p>
                </div>
              </div>
            </div>
            <div v-if="scoutingData.analytics.mostPlayed && scoutingData.analytics.mostPlayed.length > 0" class="mb-4">
              <h4 class="text-md font-medium text-white mb-2">Most Played</h4>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="champ in scoutingData.analytics.mostPlayed.slice(0, 10)"
                  :key="champ.championName"
                  class="px-2 py-1 bg-[#1a1a1a] border border-amber-500/20 rounded text-sm text-white"
                >
                  {{ champ.championName }} ({{ champ.totalGames }})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useScoutingStore } from '@/stores/scouting'
import { useAuthStore } from '@/stores/auth'
import { scoutingService } from '@/services/scouting/scoutingService'

const props = defineProps({
  playerId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close'])

const scoutingStore = useScoutingStore()
const authStore = useAuthStore()

const isRefreshing = ref(false)

const player = computed(() => {
  return scoutingStore.players.find(p => p.id === props.playerId)
})

const playerTeam = computed(() => {
  if (!player.value?.teamId) return null
  return scoutingStore.teams.find(t => t.id === player.value.teamId) || null
})

const scoutingData = computed(() => {
  return scoutingStore.scoutingData[props.playerId]
})

watch(() => props.playerId, async (newId) => {
  if (newId && !scoutingStore.scoutingData[newId]) {
    try {
      await scoutingStore.loadScoutingData(newId)
    } catch (error) {
      console.error('Error loading scouting data:', error)
    }
  }
}, { immediate: true })

const refreshScouting = async () => {
  isRefreshing.value = true
  try {
    await scoutingService.scoutPlayer(props.playerId)
    await scoutingStore.loadScoutingData(props.playerId)
  } catch (error) {
    console.error('Error refreshing scouting:', error)
  } finally {
    isRefreshing.value = false
  }
}
</script>



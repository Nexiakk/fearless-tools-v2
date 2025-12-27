<template>
  <div class="player-card-container relative bg-[#1a1a1a] rounded-lg border border-[#3a3a3a] p-3 flex flex-col h-full min-h-0 overflow-hidden">
    <!-- Role Icon (70/30 positioning like Champion Pool) -->
    <img 
      :src="roleIconUrl" 
      :alt="role" 
      class="player-card-role-icon" 
    />
    
    <!-- Player Name Header with Links -->
    <div class="mb-2">
      <div v-if="currentPlayer" class="flex items-center">
        <!-- Left Section: OP.GG (fixed width, centered content) -->
        <div class="w-20 flex items-center justify-center">
          <a
            v-if="currentPlayer.opggUrl"
            :href="currentPlayer.opggUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 hover:opacity-80 transition-opacity"
            @click.stop
          >
            <img
              src="https://play-lh.googleusercontent.com/FeRWKSHpYNEW21xZCQ-Y4AkKAaKVqLIy__PxmiE_kGN1uRh7eiB87ZFlp3j1DRp9r8k"
              alt="OP.GG"
              class="w-4 h-4 rounded"
              @error="handleImageError"
            />
            <span class="text-[10px] text-gray-300">OP.GG</span>
          </a>
        </div>
        
        <!-- Center Section: Player Name (flexible, centered) -->
        <div class="flex-1 flex items-center justify-center">
          <h3 
            class="text-base font-semibold text-white cursor-pointer hover:text-orange-500 transition-colors text-center"
            @click="openPlayerDetail"
          >
            {{ currentPlayer.name }}
          </h3>
        </div>
        
        <!-- Right Section: Leaguepedia and Gol.gg (fixed width, evenly spaced) -->
        <div class="w-20 flex items-center justify-evenly gap-3">
          <!-- Leaguepedia Link -->
          <a
            v-if="currentPlayer.leaguepediaUrl"
            :href="currentPlayer.leaguepediaUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 hover:opacity-80 transition-opacity"
            @click.stop
          >
            <img
              src="https://images.wikia.com/lolesports_gamepedia_en/images/b/bc/Wiki.png"
              alt="Leaguepedia"
              class="w-4 h-4 rounded"
              @error="handleImageError"
            />
            <span class="text-[10px] text-gray-300">LP</span>
          </a>
          
          <!-- Gol.gg Link -->
          <a
            v-if="currentPlayer.golUrl"
            :href="currentPlayer.golUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 hover:opacity-80 transition-opacity"
            @click.stop
          >
            <img
              src="https://gol.gg/_img/twitter_card.png"
              alt="Gol.gg"
              class="w-4 h-4 rounded"
              @error="handleImageError"
            />
            <span class="text-[10px] text-gray-300">GoL</span>
          </a>
        </div>
      </div>
      <h3 v-else class="text-base font-semibold text-gray-500 text-center">No Player</h3>
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
      <div v-else-if="scoutingData" class="flex-1 flex flex-col min-h-0 overflow-hidden">
        <!-- Data Sections Container -->
        <div class="flex-1 flex flex-col min-h-0 gap-1" style="height: 0;">
          <!-- SoloQ Section -->
          <div class="flex flex-col overflow-hidden rounded-lg border border-[#3a3a3a] bg-[#282828] backdrop-blur-sm shadow-lg" :style="soloqSectionStyle">
            <!-- Section Header -->
            <div 
              class="flex-shrink-0 px-2 py-1.5 bg-gradient-to-r from-orange-600/20 via-orange-500/10 to-transparent border-b border-orange-500/30 cursor-pointer hover:from-orange-600/30 hover:via-orange-500/20 transition-all"
              @click="soloqExpanded = !soloqExpanded"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-orange-400 uppercase tracking-wide">SoloQ</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="14" 
                  height="14" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-width="2.5" 
                  stroke-linecap="round" 
                  stroke-linejoin="round"
                  :class="{ 'rotate-180': soloqExpanded }"
                  class="transition-transform duration-300 text-orange-400/70"
                >
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
            </div>
            
            <!-- Champions List -->
            <div 
              v-if="soloqExpanded"
              class="flex-1 overflow-y-auto min-h-0"
              style="height: 0;"
            >
              <div class="p-1 space-y-0.5">
                <template v-if="soloqChampions.length === 0">
                  <div class="text-center py-4 text-gray-400 text-[10px] italic">No SoloQ data</div>
                </template>
                <template v-else>
                  <template v-for="(champ, index) in displayedSoloqChampions" :key="`soloq-${champ.championName}`">
                    <!-- Champion Row Container -->
                    <div class="flex flex-col">
                      <!-- Champion Row -->
                      <div
                        class="flex items-center gap-1.5 px-1.5 py-1 group hover:bg-[#3a3a3a]/40 cursor-pointer"
                        :class="expandedChampions.has(champ.championName) ? 'bg-[#252525] border-l-2 border-r-2 border-t-2 border-b-0 border-orange-500/40 rounded-t rounded-b-none' : 'rounded border border-[#3a3a3a]/30'"
                        @click.stop="toggleChampionExpansion(champ.championName)"
                      >
                        <!-- Champion Icon & Name -->
                        <div class="flex items-center gap-1.5 flex-shrink-0 overflow-hidden" style="width: 85px;">
                          <img
                            :src="getChampionIconUrl(champ.championName)"
                            :alt="champ.championName"
                            class="w-6 h-6 rounded ring-1 ring-[#3a3a3a]/50 group-hover:ring-orange-500/30 transition-all flex-shrink-0"
                            @error="handleImageError"
                          />
                          <span class="text-white font-medium text-[11px] truncate block min-w-0" :title="champ.championName">{{ champ.championName }}</span>
                        </div>

                        <!-- Games Badge -->
                        <div class="px-1.5 py-0.5 bg-gray-700/60 rounded border border-gray-600/50 flex-shrink-0 h-5 flex items-center justify-center" style="width: 38px;">
                          <span class="text-gray-200 font-bold text-[10px] leading-none">{{ champ.games || 0 }}</span>
                        </div>

                        <!-- Win/Loss Progress Bar with text inside -->
                        <div class="flex-1 flex-shrink-0" style="min-width: 80px; max-width: 100px;">
                          <div class="relative h-5 bg-gray-700/60 rounded overflow-hidden border border-gray-600/50">
                            <div class="h-full flex relative">
                              <div
                                class="bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300 relative"
                                :style="{ width: `${((champ.wins || 0) / (champ.games || 1)) * 100}%` }"
                              >
                                <div v-if="champ.wins > 0" class="absolute inset-0 flex items-center justify-center">
                                  <span class="text-[9px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">{{ champ.wins || 0 }}</span>
                                </div>
                              </div>
                              <div
                                class="bg-gradient-to-r from-red-500 to-red-400 transition-all duration-300 relative"
                                :style="{ width: `${((champ.losses || (champ.games || 0) - (champ.wins || 0)) / (champ.games || 1)) * 100}%` }"
                              >
                                <div v-if="(champ.losses || (champ.games || 0) - (champ.wins || 0)) > 0" class="absolute inset-0 flex items-center justify-center">
                                  <span class="text-[9px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">{{ champ.losses || (champ.games || 0) - (champ.wins || 0) }}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <!-- Winrate Badge -->
                        <div class="px-1.5 py-0.5 rounded border font-bold text-[10px] text-center flex-shrink-0 h-5 flex items-center justify-center" style="width: 42px;" :class="getWinrateBadgeClass(champ.winrate)">
                          {{ formatWinrate(champ.winrate) }}
                        </div>

                        <!-- KDA Badge -->
                        <div class="px-1.5 py-0.5 bg-orange-500/20 rounded border border-orange-500/30 flex-shrink-0 h-5 flex items-center justify-center" style="width: 38px;">
                          <span class="text-orange-400 font-bold text-[10px]">{{ formatKDA(champ.kda) }}</span>
                        </div>
                      </div>

                      <!-- Expanded Statistics Row -->
                      <div
                        v-if="expandedChampions.has(champ.championName)"
                        class="px-1.5 py-1 bg-[#252525] border-l-2 border-r-2 border-t-0 border-b-2 border-orange-500/40 rounded-b rounded-t-none flex items-center gap-1.5 w-full"
                      >
                        <!-- KP% -->
                        <div class="flex flex-col items-center relative flex-1 min-w-0">
                        <div class="absolute -top-[10px] left-1/2 transform -translate-x-1/2 h-4 px-1.5 flex items-center justify-center">
                          <span class="text-gray-300 text-[8px] font-medium whitespace-nowrap">KP%</span>
                        </div>
                        <div class="px-1 py-0.5 bg-gray-700/60 rounded border border-gray-600/50 flex flex-col items-center justify-center w-full min-h-[32px]">
                          <p v-if="champ.kda?.killParticipation !== undefined" class="font-bold text-[0.65rem] leading-tight text-center text-white">{{ Math.floor(champ.kda.killParticipation) }}%</p>
                          <p v-else class="font-bold text-[0.65rem] leading-tight text-center text-gray-500">N/A</p>
                        </div>
                        </div>

                        <!-- DMG -->
                        <div class="flex flex-col items-center relative flex-1 min-w-0">
                        <div class="absolute -top-[10px] left-1/2 transform -translate-x-1/2 h-4 px-1.5 flex items-center justify-center">
                          <span class="text-gray-300 text-[8px] font-medium whitespace-nowrap">DMG</span>
                        </div>
                        <div class="px-1 py-0.5 bg-gray-700/60 rounded border border-gray-600/50 flex flex-col items-center justify-center w-full min-h-[32px]">
                          <template v-if="champ.damage && (champ.damage.perMinute !== undefined || champ.damage.percentage !== undefined)">
                            <p v-if="champ.damage.perMinute !== undefined" class="font-bold text-[0.65rem] leading-tight text-center text-white">{{ Math.floor(champ.damage.perMinute) }}/min</p>
                            <p v-if="champ.damage.percentage !== undefined" class="font-bold text-[0.65rem] leading-tight text-center text-white">
                              <span class="text-gray-400 text-[9px]">{{ Math.floor(champ.damage.percentage) }}%</span>
                            </p>
                          </template>
                          <p v-else class="font-bold text-[0.65rem] leading-tight text-center text-gray-500">N/A</p>
                        </div>
                        </div>

                        <!-- Vision -->
                        <div class="flex flex-col items-center relative flex-1 min-w-0">
                        <div class="absolute -top-[10px] left-1/2 transform -translate-x-1/2 h-4 px-1.5 flex items-center justify-center">
                          <span class="text-gray-300 text-[8px] font-medium whitespace-nowrap">Vision</span>
                        </div>
                        <div class="px-1 py-0.5 bg-gray-700/60 rounded border border-gray-600/50 flex flex-col items-center justify-center w-full min-h-[32px]">
                          <template v-if="champ.wards && (champ.wards.visionScore !== undefined || champ.wards.controlWards !== undefined || champ.wards.placed !== undefined || champ.wards.killed !== undefined)">
                            <p v-if="champ.wards.visionScore !== undefined" class="font-bold text-[0.65rem] leading-tight text-center text-white">{{ Math.floor(champ.wards.visionScore) }}</p>
                            <p v-if="champ.wards.controlWards !== undefined && champ.wards.placed !== undefined && champ.wards.killed !== undefined" class="font-bold text-[0.65rem] leading-tight text-center text-white">
                              <span class="text-gray-400 text-[9px]">{{ champ.wards.controlWards.toFixed(0) }} ({{ champ.wards.placed.toFixed(0) }}/{{ champ.wards.killed.toFixed(0) }})</span>
                            </p>
                            <p v-else-if="champ.wards.placed !== undefined && champ.wards.killed !== undefined" class="font-bold text-[0.65rem] leading-tight text-center text-white">
                              <span class="text-gray-400 text-[9px]">({{ champ.wards.placed.toFixed(0) }}/{{ champ.wards.killed.toFixed(0) }})</span>
                            </p>
                            <p v-else-if="champ.wards.controlWards !== undefined" class="font-bold text-[0.65rem] leading-tight text-center text-white">
                              <span class="text-gray-400 text-[9px]">{{ champ.wards.controlWards.toFixed(0) }}</span>
                            </p>
                          </template>
                          <p v-else class="font-bold text-[0.65rem] leading-tight text-center text-gray-500">N/A</p>
                        </div>
                        </div>

                        <!-- CS -->
                        <div class="flex flex-col items-center relative flex-1 min-w-0">
                        <div class="absolute -top-[10px] left-1/2 transform -translate-x-1/2 h-4 px-1.5 flex items-center justify-center">
                          <span class="text-gray-300 text-[8px] font-medium whitespace-nowrap">CS</span>
                        </div>
                        <div class="px-1 py-0.5 bg-gray-700/60 rounded border border-gray-600/50 flex flex-col items-center justify-center w-full min-h-[32px]">
                          <template v-if="champ.cs && (champ.cs.total !== undefined || champ.cs.perMinute !== undefined)">
                            <p v-if="champ.cs.total !== undefined" class="font-bold text-[0.65rem] leading-tight text-center text-white">{{ champ.cs.total.toLocaleString() }}</p>
                            <p v-if="champ.cs.perMinute !== undefined" class="font-bold text-[0.65rem] leading-tight text-center text-white">
                              <span class="text-gray-400 text-[9px]">{{ champ.cs.perMinute.toFixed(1) }}/min</span>
                            </p>
                          </template>
                          <p v-else class="font-bold text-[0.65rem] leading-tight text-center text-gray-500">N/A</p>
                        </div>
                        </div>

                        <!-- Gold -->
                        <div class="flex flex-col items-center relative flex-1 min-w-0">
                        <div class="absolute -top-[10px] left-1/2 transform -translate-x-1/2 h-4 px-1.5 flex items-center justify-center">
                          <span class="text-gray-300 text-[8px] font-medium whitespace-nowrap">Gold</span>
                        </div>
                        <div class="px-1 py-0.5 bg-gray-700/60 rounded border border-gray-600/50 flex flex-col items-center justify-center w-full min-h-[32px]">
                          <template v-if="champ.gold && (champ.gold.total !== undefined || champ.gold.perMinute !== undefined)">
                            <p v-if="champ.gold.total !== undefined" class="font-bold text-[0.65rem] leading-tight text-center text-white">{{ champ.gold.total.toLocaleString() }}</p>
                            <p v-if="champ.gold.perMinute !== undefined" class="font-bold text-[0.65rem] leading-tight text-center text-white">
                              <span class="text-gray-400 text-[9px]">{{ champ.gold.perMinute.toFixed(1) }}/min</span>
                            </p>
                          </template>
                          <p v-else class="font-bold text-[0.65rem] leading-tight text-center text-gray-500">N/A</p>
                        </div>
                      </div>
                      </div>
                    </div>
                  </template>
                </template>
              </div>
            </div>
          </div>

          <!-- Competitive Section -->
          <div class="flex flex-col overflow-hidden rounded-lg border border-[#3a3a3a] bg-[#282828] backdrop-blur-sm shadow-lg" :style="compSectionStyle">
            <!-- Section Header -->
            <div 
              class="flex-shrink-0 px-2 py-1.5 bg-gradient-to-r from-blue-600/20 via-blue-500/10 to-transparent border-b border-blue-500/30 cursor-pointer hover:from-blue-600/30 hover:via-blue-500/20 transition-all"
              @click="compExpanded = !compExpanded"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-blue-400 uppercase tracking-wide">Competitive</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="14" 
                  height="14" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-width="2.5" 
                  stroke-linecap="round" 
                  stroke-linejoin="round"
                  :class="{ 'rotate-180': compExpanded }"
                  class="transition-transform duration-300 text-blue-400/70"
                >
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
            </div>
            
            <!-- Champions List - Clickable entire area -->
            <div 
              v-if="compExpanded"
              class="flex-1 overflow-y-auto min-h-0 cursor-pointer hover:bg-[#3a3a3a]/30 transition-all duration-200"
              style="height: 0;"
              @click="compExpanded = !compExpanded"
            >
              <div class="p-1 space-y-0.5">
                <template v-if="competitiveChampions.length === 0">
                  <div class="text-center py-4 text-gray-400 text-[10px] italic">No competitive data</div>
                </template>
                <template v-else>
                  <div 
                    v-for="(champ, index) in displayedCompetitiveChampions" 
                    :key="`comp-${champ.championName}`"
                    class="flex items-center gap-1.5 px-1.5 py-1 rounded transition-all duration-150 group hover:bg-[#3a3a3a]/40"
                    :class="compExpanded && 'border border-[#3a3a3a]/30'"
                  >
                    <!-- Champion Icon & Name -->
                    <div class="flex items-center gap-1.5 flex-shrink-0 overflow-hidden" style="width: 85px;">
                      <img 
                        :src="getChampionIconUrl(champ.championName)" 
                        :alt="champ.championName"
                        class="w-6 h-6 rounded ring-1 ring-[#3a3a3a]/50 group-hover:ring-blue-500/30 transition-all flex-shrink-0"
                        @error="handleImageError"
                      />
                      <span class="text-white font-medium text-[11px] truncate block min-w-0" :title="champ.championName">{{ champ.championName }}</span>
                    </div>
                    
                    <!-- Games Badge -->
                    <div class="px-1.5 py-0.5 bg-gray-700/60 rounded border border-gray-600/50 flex-shrink-0 h-5 flex items-center justify-center" style="width: 38px;">
                      <span class="text-gray-200 font-bold text-[10px] leading-none">{{ champ.games || 0 }}</span>
                    </div>
                    
                    <!-- Win/Loss Progress Bar with text inside -->
                    <div class="flex-1 flex-shrink-0" style="min-width: 80px; max-width: 100px;">
                      <div class="relative h-5 bg-gray-700/60 rounded overflow-hidden border border-gray-600/50">
                        <div class="h-full flex relative">
                          <div 
                            class="bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300 relative"
                            :style="{ width: `${((champ.wins || 0) / (champ.games || 1)) * 100}%` }"
                          >
                            <div v-if="champ.wins > 0" class="absolute inset-0 flex items-center justify-center">
                              <span class="text-[9px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">{{ champ.wins || 0 }}</span>
                            </div>
                          </div>
                          <div 
                            class="bg-gradient-to-r from-red-500 to-red-400 transition-all duration-300 relative"
                            :style="{ width: `${((champ.losses || (champ.games || 0) - (champ.wins || 0)) / (champ.games || 1)) * 100}%` }"
                          >
                            <div v-if="(champ.losses || (champ.games || 0) - (champ.wins || 0)) > 0" class="absolute inset-0 flex items-center justify-center">
                              <span class="text-[9px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">{{ champ.losses || (champ.games || 0) - (champ.wins || 0) }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Winrate Badge -->
                    <div class="px-1.5 py-0.5 rounded border font-bold text-[10px] text-center flex-shrink-0 h-5 flex items-center justify-center" style="width: 42px;" :class="getWinrateBadgeClass(champ.winrate)">
                      {{ formatWinrate(champ.winrate) }}
                    </div>
                    
                    <!-- KDA Badge -->
                    <div class="px-1.5 py-0.5 bg-blue-500/20 rounded border border-blue-500/30 flex-shrink-0 h-5 flex items-center justify-center" style="width: 38px;">
                      <span class="text-blue-400 font-bold text-[10px]">{{ formatKDA(champ.kda) }}</span>
                    </div>
                  </div>
                </template>
              </div>
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
  }
})

const emit = defineEmits(['open-detail'])

const scoutingStore = useScoutingStore()
const championsStore = useChampionsStore()
const isLoadingData = ref(false)
const soloqExpanded = ref(true)
const compExpanded = ref(true)
const expandedChampions = ref(new Set())

const soloqSectionStyle = computed(() => {
  if (soloqExpanded.value && compExpanded.value) {
    return { flex: '1 1 0%', minHeight: '0' }
  }
  if (soloqExpanded.value && !compExpanded.value) {
    return { flex: '1 1 auto', minHeight: '0' }
  }
  return { flex: '0 0 auto', minHeight: '0' }
})

const compSectionStyle = computed(() => {
  if (compExpanded.value && soloqExpanded.value) {
    return { flex: '1 1 0%', minHeight: '0' }
  }
  if (compExpanded.value && !soloqExpanded.value) {
    return { flex: '1 1 auto', minHeight: '0' }
  }
  return { flex: '0 0 auto', minHeight: '0' }
})

const currentPlayer = computed(() => {
  return scoutingStore.getPlayerByTeamAndRole(props.role)
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

const displayedSoloqChampions = computed(() => {
  if (soloqExpanded.value) {
    return soloqChampions.value
  }
  return soloqChampions.value.slice(0, 10)
})

const displayedCompetitiveChampions = computed(() => {
  if (compExpanded.value) {
    return competitiveChampions.value
  }
  return competitiveChampions.value.slice(0, 10)
})

const getChampionIconUrl = (championName) => {
  return championsStore.getChampionIconUrl(championName, 'list')
}

const formatWinrate = (winrate) => {
  if (winrate === null || winrate === undefined) return '0%'
  return `${Math.floor(winrate)}%`
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

const getWinrateColor = (winrate) => {
  if (winrate === null || winrate === undefined) return 'text-gray-400'
  if (winrate >= 60) return 'text-green-400'
  if (winrate >= 50) return 'text-yellow-400'
  if (winrate >= 40) return 'text-orange-400'
  return 'text-red-400'
}

const getWinrateBadgeClass = (winrate) => {
  if (winrate === null || winrate === undefined) return 'bg-[#3a3a3a]/60 border-[#3a3a3a]/50 text-gray-400'
  if (winrate >= 60) return 'bg-green-500/20 border-green-500/40 text-green-400'
  if (winrate >= 50) return 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
  if (winrate >= 40) return 'bg-orange-500/20 border-orange-500/40 text-orange-400'
  return 'bg-red-500/20 border-red-500/40 text-red-400'
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

const toggleChampionExpansion = (championName) => {
  const newSet = new Set(expandedChampions.value)
  if (newSet.has(championName)) {
    newSet.delete(championName)
  } else {
    newSet.add(championName)
  }
  expandedChampions.value = newSet
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
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: rgba(31, 41, 55, 0.3);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(75, 85, 99, 0.6);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 0.8);
}

/* Table styling */
table {
  border-collapse: separate;
  border-spacing: 0;
}

th, td {
  border: none;
}
</style>

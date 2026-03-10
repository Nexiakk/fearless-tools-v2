<template>
  <Teleport to="body">
    <!-- Click outside overlay - transparent but captures clicks -->
    <div
      v-if="modalStore.isOpen && !isShiftPressed && !isCtrlPressed"
      class="fixed inset-0 z-40"
      @click="closeModal"
    ></div>

    <Transition name="drawer">
      <div
        v-if="modalStore.isOpen"
        class="fixed bottom-0 left-[15%] right-[15%] w-[70%] rounded-t-xl z-50 shadow-2xl border-t border-x border-gray-800 flex flex-col font-sans transition-all duration-200"
        :class="(isShiftPressed || isCtrlPressed) ? 'bg-[#161616]/20 opacity-30 pointer-events-none' : 'bg-[#161616] opacity-100 pointer-events-auto'"
        style="height: 340px;"
        @click.stop
      >
        <!-- Loading State -->
        <div v-if="modalStore.isLoading" class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto mb-3"></div>
            <p class="text-xs text-gray-400">Loading...</p>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="modalStore.error" class="flex-1 flex items-center justify-center p-6">
          <div class="text-center text-red-400">
            <svg class="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p class="text-xs">{{ modalStore.error }}</p>
          </div>
        </div>

        <!-- Comparing State -->
        <div v-else-if="comparingMatchup" class="flex-1 flex flex-col min-h-0 bg-[#161616] relative overflow-hidden">
          <div v-if="isComparingLoading" class="absolute inset-0 z-50 flex items-center justify-center bg-[#161616]/80 backdrop-blur-sm">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
          </div>

          <!-- Header -->
          <div class="flex items-center p-5 border-b border-gray-800/60 shrink-0 bg-gray-900/30">
            <button @click="clearComparison" class="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-500 hover:text-white mr-auto cursor-pointer pointer-events-auto">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            
            <div class="flex-1 flex flex-row items-center justify-center gap-10">
              <!-- Champ A -->
              <div class="flex items-center gap-4">
                <div class="relative">
                  <img :src="modalStore.championIconUrl" class="w-14 h-14 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.2)] border border-cyan-500/30" />
                </div>
                <div class="flex flex-col items-start">
                  <span class="text-xl font-black text-white leading-none tracking-tight">{{ modalStore.champion.name }}</span>
                  <span class="text-[11px] text-gray-500 mt-1 capitalize">{{ modalStore.champion.title || 'Champion' }}</span>
                </div>
              </div>
              
              <!-- VS Icon -->
              <div class="text-gray-600 flex items-center justify-center">
                <svg class="w-5 h-5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21l18-18m0 18L3 3" /></svg>
              </div>
              
              <!-- Champ B -->
              <div class="flex items-center gap-4">
                <div class="flex flex-col items-end">
                  <span class="text-xl font-black text-white leading-none tracking-tight">{{ getChampionDisplayName(comparingMatchup.champion) }}</span>
                  <span class="text-[11px] text-gray-500 mt-1 capitalize truncate max-w-[150px] text-right">{{ comparingChampionRiotData?.title || 'Enemy' }}</span>
                </div>
                <div class="relative">
                  <img :src="getCounterIconUrl(comparingMatchup)" class="w-14 h-14 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.2)] border border-red-500/30" />
                </div>
              </div>
            </div>
            
            <div class="w-9 ml-auto"></div>
          </div>

          <!-- Abilities Layout -->
          <div class="flex-1 flex p-6 min-h-0 bg-[#121212]">
            <!-- Champ A Abilities -->
            <div class="flex-1 flex justify-end gap-5 pr-8 border-r border-gray-800/80 items-center">
              <div v-for="ability in abilityIcons" :key="'A-'+ability.key" class="flex flex-col items-center gap-2">
                <div class="relative">
                  <img :src="ability.iconUrl" class="w-9 h-9 border border-gray-700 shadow-lg object-cover" :class="ability.key === 'P' ? 'rounded-full' : 'rounded'" @error="handleAbilityImageError" />
                  <div class="absolute -bottom-1 -right-1.5 min-w-[14px] h-[14px] px-0.5 bg-[#0a0a0a] border border-gray-700/80 rounded-sm flex items-center justify-center text-[8px] font-bold text-gray-300 z-10">
                    {{ability.key}}
                  </div>
                </div>
                <div class="text-[9px] text-gray-400 font-medium tracking-tight mt-0.5 w-[42px] text-center leading-tight">
                  <span class="line-clamp-2">{{ ability.cooldown || '-' }}</span>
                </div>
              </div>
            </div>

            <!-- Champ B Abilities -->
            <div class="flex-1 flex justify-start gap-5 pl-8 items-center">
              <div v-for="ability in comparingAbilityIcons" :key="'B-'+ability.key" class="flex flex-col items-center gap-2">
                <div class="relative">
                  <img :src="ability.iconUrl" class="w-9 h-9 border border-gray-700 shadow-lg object-cover" :class="ability.key === 'P' ? 'rounded-full' : 'rounded'" @error="handleAbilityImageError" />
                  <div class="absolute -bottom-1 -right-1.5 min-w-[14px] h-[14px] px-0.5 bg-[#0a0a0a] border border-gray-700/80 rounded-sm flex items-center justify-center text-[8px] font-bold text-gray-300 z-10">
                    {{ability.key}}
                  </div>
                </div>
                <div class="text-[9px] text-gray-400 font-medium tracking-tight mt-0.5 w-[42px] text-center leading-tight">
                  <span class="line-clamp-2">{{ ability.cooldown || '-' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Content -->
        <div v-else-if="modalStore.champion" class="flex-1 flex flex-col min-h-0 bg-[#161616] relative overflow-hidden">
          
          <!-- Background Effect -->
          <div class="absolute top-0 right-0 w-[400px] h-full bg-gradient-to-l from-amber-900/10 via-transparent to-transparent pointer-events-none"></div>

          <!-- Top Row: Identity & Primary Stats -->
          <div class="flex-shrink-0 px-5 pt-4 pb-1 flex items-start gap-4 z-10">
            <!-- Champion Identity -->
            <div class="flex items-start gap-3 flex-shrink-0">
              <div class="relative group shrink-0 mt-1">
                <img
                  :src="modalStore.championIconUrl"
                  :alt="modalStore.champion.name"
                  class="w-16 h-16 rounded-lg shadow-lg border-2 border-gray-700 group-hover:border-amber-500/50 transition-colors"
                />
              </div>
              
              <div class="flex flex-col pt-0.5">
                <div class="flex items-center gap-3 mb-1">
                  <h3 class="text-2xl font-bold text-white tracking-tight leading-none">{{ modalStore.champion.name }}</h3>
                </div>
                <div class="flex items-center gap-2 text-xs text-gray-400 font-medium">
                  <span class="capitalize text-amber-500/90">{{ modalStore.selectedRole }}</span>
                  <span class="w-1 h-1 rounded-full bg-gray-600"></span>
                  <span :class="getTierColorClass(formattedStats?.tier)">Tier {{ formattedStats?.tier || '-' }}</span>
                  <span class="w-1 h-1 rounded-full bg-gray-600"></span>
                  <span class="text-gray-500">Rank {{ formattedStats?.rank || '-' }}</span>
                </div>
                
                <!-- Abilities Bar Area -->
                <div class="mt-3 w-fit flex flex-col items-start pr-4 relative">
                  <!-- Form Tabs (folder style) -->
                  <div v-if="modalStore.hasMultipleForms" class="flex items-end px-2 z-10 w-full mb-0" style="padding-left: 2px;">
                     <button
                      v-for="(formName, index) in modalStore.formNames"
                      :key="index"
                      @click="modalStore.setSelectedFormIndex(index)"
                      class="text-[10px] font-bold transition-all relative px-3 py-1"
                    >
                      <span :class="modalStore.selectedFormIndex === index ? 'text-amber-500' : 'text-gray-400 group-hover:text-gray-300'">{{ formName }}</span>
                      <div v-if="modalStore.selectedFormIndex === index" class="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-500 rounded-t-full"></div>
                    </button>
                  </div>
                  
                  <!-- Abilities Bar -->
                  <TooltipProvider :delay-duration="100">
                    <div class="flex border border-gray-700/80 rounded-xl overflow-hidden shrink-0 bg-transparent shadow-md max-w-full relative z-0"
                         :class="{'rounded-tl-none': modalStore.hasMultipleForms, 'bg-[#1a1a1a]': true}">
                      <Tooltip v-for="(ability, idx) in abilityIcons" :key="ability.key">
                        <TooltipTrigger as-child>
                          <div 
                            class="flex flex-col items-center py-2 px-2.5 min-w-[50px] group/ability cursor-help relative hover:bg-gray-800 transition-colors"
                            :class="{ 'border-r border-gray-700/60': idx !== abilityIcons.length - 1 }"
                          >
                            <div class="w-7 h-7 rounded overflow-hidden transition-all group-hover/ability:scale-105 shadow-sm shrink-0 border border-gray-900 border-opacity-50 relative">
                              <img v-if="ability.iconUrl" :src="ability.iconUrl" :alt="ability.name" class="w-full h-full object-cover opacity-90 group-hover/ability:opacity-100" @error="handleAbilityImageError" />
                              <span v-else class="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-400 bg-gray-800">{{ ability.key }}</span>
                            </div>
                            <div class="mt-1 flex items-center justify-center w-full shrink-0">
                              <div v-if="ability.cooldown" class="text-[9px] text-gray-400 font-medium whitespace-nowrap leading-none text-center">
                                {{ ability.cooldown }}
                              </div>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" :side-offset="5" class="bg-gray-900 border-gray-700 text-xs p-2 max-w-xs z-[60]">
                          <p class="font-bold text-amber-400 mb-1">{{ ability.name }} <span class="text-gray-500 font-normal">({{ ability.key }})</span></p>
                          <p class="text-gray-300 leading-snug">{{ ability.description }}</p>
                          <div v-if="ability.cooldown" class="mt-1 pt-1 border-t border-gray-700 text-gray-500 flex justify-between gap-4">
                              <span>CD: {{ ability.cooldown }}</span>
                              <span v-if="ability.cost">{{ ability.cost.value }} {{ ability.cost.resource }}</span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </div>
              </div>
            </div>

            <!-- Stats Grid & Role Select -->
            <div class="ml-auto flex flex-col items-end gap-3 pr-2 self-start pt-1">
               <!-- Role Selector (Repositioned here) -->
               <div class="flex bg-gray-800/50 rounded-lg p-0.5 border border-gray-700/50">
                  <button
                    v-for="role in allRoles"
                    :key="role"
                    @click="setSelectedRole(role)"
                    :disabled="!availableRoles.includes(role)"
                    class="w-7 h-7 rounded flex items-center justify-center transition-all relative group"
                    :class="getRoleTabClass(role)"
                  >
                    <img
                      :src="championsStore.getRoleIconUrl(role)"
                      :alt="role"
                      class="w-4 h-4 transition-opacity"
                      :class="!availableRoles.includes(role) ? 'opacity-20 grayscale' : 'opacity-80 group-hover:opacity-100'"
                    />
                  </button>
               </div>

              <div v-if="formattedStats" class="flex items-center gap-6">
              <div class="flex flex-col items-end">
                <span class="text-lg font-bold text-green-400 leading-none">{{ formattedStats.winRate }}</span>
                <span class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-0.5">Win</span>
              </div>
              <div class="w-px h-8 bg-gray-800"></div>
              <div class="flex flex-col items-end">
                <span class="text-lg font-bold text-blue-400 leading-none">{{ formattedStats.pickRate }}</span>
                <span class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-0.5">Pick</span>
              </div>
               <div class="w-px h-8 bg-gray-800"></div>
              <div class="flex flex-col items-end">
                <span class="text-lg font-bold text-red-400 leading-none">{{ formattedStats.banRate }}</span>
                <span class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-0.5">Ban</span>
              </div>
               <div class="w-px h-8 bg-gray-800"></div>
              <div class="flex flex-col items-end">
                <span class="text-lg font-bold text-gray-300 leading-none">{{ formattedStats.games }}</span>
                <span class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-0.5">Games</span>
              </div>
            </div>
            </div>
          </div>

            <!-- Divider -->
          <div class="h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent my-2 opacity-50"></div>

          <!-- Bottom Section: Counters & Role Select -->
          <div class="flex-1 flex flex-col min-h-0 px-5 pb-3">
             <!-- Sub-Header Row -->
            <div class="flex items-center justify-between mb-2 flex-shrink-0">
               <h4 class="text-xs font-bold text-gray-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <svg class="w-3 h-3 text-red-500/80" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.707 7.293a1 1 0 0 0-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 1 0 1.414 1.414L10 11.414l1.293 1.293a1 1 0 0 0 1.414-1.414L11.414 10l1.293-1.293a1 1 0 0 0-1.414-1.414L10 8.586 8.707 7.293Z" clip-rule="evenodd" />
                  </svg>
                  Matchups
                  <span class="text-gray-600 font-normal ml-1">({{ currentRoleCounters.length }})</span>
               </h4>
            </div>

            <!-- Matchups Horizontal List -->
            <div 
              v-if="currentRoleCounters.length > 0" 
              class="flex-1 overflow-x-auto overflow-y-hidden min-h-0 py-1 scrollbar-thin"
              ref="matchupsListRef"
              @wheel.prevent="handleWheel"
            >
              <div class="flex gap-2 h-full items-center pl-1 w-max px-2 pb-1">
                
                <div class="flex-shrink-0 px-3 flex flex-col items-center justify-center opacity-70">
                   <span class="text-[11px] font-bold text-red-400 uppercase tracking-widest whitespace-nowrap">Bad Against</span>
                </div>

                <template v-for="(counter, idx) in currentRoleCounters" :key="counter.champion">
                  <!-- Separator when switching from <50% to >=50% -->
                  <div
                    v-if="idx > 0 && currentRoleCounters[idx-1].win_rate < 50 && counter.win_rate >= 50"
                    class="h-[70%] w-px bg-gray-700/50 mx-2"
                  ></div>
                  
                  <div
                    class="flex-shrink-0 w-[4.5rem] h-full bg-[#1e1e1e] rounded border border-gray-800 hover:border-gray-600 transition-all group flex flex-col relative overflow-hidden cursor-pointer hover:border-amber-500 pointer-events-auto"
                    @click="handleCounterClick(counter)"
                  >
                    <!-- Background Image (blurred) -->
                     <div class="absolute inset-0 overflow-hidden opacity-20 group-hover:opacity-30 transition-opacity">
                        <img :src="getCounterIconUrl(counter)" class="w-full h-full object-cover blur-[2px] scale-150" />
                     </div>

                    <div class="relative z-10 flex flex-col items-center justify-center h-full p-1.5 gap-1">
                        <img
                          :src="getCounterIconUrl(counter)"
                          :alt="counter.champion"
                          class="w-8 h-8 rounded shadow-sm border border-gray-700/50 group-hover:border-gray-500 transition-colors"
                          @error="handleImageError"
                        />
                        <div class="text-[10px] font-medium text-gray-300 truncate w-full text-center leading-tight">{{ getChampionDisplayName(counter.champion) }}</div>
                        <div class="text-[11px] font-bold leading-none" :class="counter.win_rate >= 50 ? 'text-green-400/90' : 'text-red-400/90'">
                          {{ formatWinRate(counter.win_rate) }}
                        </div>
                    </div>
                  </div>
                </template>

                <div class="flex-shrink-0 px-3 flex flex-col items-center justify-center opacity-70 ml-2">
                   <span class="text-[11px] font-bold text-green-400 uppercase tracking-widest whitespace-nowrap">Good Against</span>
                </div>
              </div>
            </div>

            <!-- Empty State -->
            <div v-else class="flex-1 flex items-center justify-center text-gray-600 text-xs italic border border-dashed border-gray-800 rounded-lg bg-gray-900/20">
               No matchup data for this role
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { fetchChampionDetailsFromTurso } from '@/services/firebase/championData'
import { useChampionStatsModalStore } from '@/stores/championStatsModal'
import { useChampionsStore } from '@/stores/champions'
import { riotApiService } from '@/services/riotApi'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const modalStore = useChampionStatsModalStore()
const championsStore = useChampionsStore()

const isShiftPressed = ref(false)
const isCtrlPressed = ref(false)

function onKeyDown(e) {
  if (e.key === 'Shift') isShiftPressed.value = true
  if (e.key === 'Control') isCtrlPressed.value = true
}

function onKeyUp(e) {
  if (e.key === 'Shift') isShiftPressed.value = false
  if (e.key === 'Control') isCtrlPressed.value = false
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})

const comparingMatchup = ref(null)
const comparingChampionData = ref(null)
const comparingChampionRiotData = ref(null)
const isComparingLoading = ref(false)

async function handleCounterClick(counter) {
  isComparingLoading.value = true
  comparingMatchup.value = counter
  try {
    const idLower = counter.champion?.toLowerCase()
    const champB = championsStore.allChampions.find(c => 
      c.id?.toLowerCase() === idLower || 
      c.imageName?.toLowerCase() === idLower ||
      c.name?.replace(/['\s]/g, '').toLowerCase() === idLower
    )
    if (champB) {
      comparingChampionData.value = await fetchChampionDetailsFromTurso(champB.imageName)
      comparingChampionRiotData.value = await riotApiService.getChampionDetails(champB.imageName, modalStore.currentPatch)
    }
  } catch (e) {
    console.error(e)
  } finally {
    isComparingLoading.value = false
  }
}

watch(() => modalStore.comparingMatchupExternal, (newVal) => {
  if (newVal && modalStore.isOpen) {
    handleCounterClick(newVal)
  }
})

function clearComparison() {
  comparingMatchup.value = null
  comparingChampionData.value = null
  comparingChampionRiotData.value = null
  modalStore.setComparingMatchup(null)
}

const comparingAbilityIcons = computed(() => {
  if (!comparingChampionData.value || !comparingChampionRiotData.value) return []
  const firebaseAbilities = comparingChampionData.value.abilities || []
  const riotAbilities = comparingChampionRiotData.value
  
  const icons = []
  const passive = firebaseAbilities.find(a => a.type === 'Passive')
  if (passive || riotAbilities?.passive) {
    icons.push({
      key: 'P',
      name: passive?.name || riotAbilities?.passive?.name,
      description: riotAbilities?.passive?.description,
      cooldown: passive?.cooldown || '',
      iconUrl: riotAbilities?.passive?.image ? riotApiService.getPassiveIconUrl(riotAbilities.passive.image, modalStore.currentPatch) : null
    })
  }
  
  const types = ['Q', 'W', 'E', 'R']
  types.forEach((type, idx) => {
    const fbAbil = firebaseAbilities.find(a => a.type === type)
    const riotSpell = riotAbilities?.spells?.[idx]
    if (fbAbil || riotSpell) {
      icons.push({
        key: type,
        name: fbAbil?.name || riotSpell?.name,
        description: riotSpell?.description,
        cooldown: fbAbil?.cooldown || riotSpell?.cooldownBurn || '',
        iconUrl: riotSpell?.image ? riotApiService.getAbilityIconUrl(riotSpell.image, modalStore.currentPatch) : null
      })
    }
  })
  
  return icons
})

const abilityIcons = computed(() => modalStore.abilityIcons || [])
const formattedStats = computed(() => modalStore.formattedStats)
const currentRoleCounters = computed(() => modalStore.currentRoleCounters || [])
const availableRoles = computed(() => modalStore.availableRoles || [])
const selectedRole = computed(() => modalStore.selectedRole)

const allRoles = ['top', 'jungle', 'middle', 'bottom', 'support']

const matchupsListRef = ref(null)

function handleWheel(e) {
  if (matchupsListRef.value) {
    matchupsListRef.value.scrollLeft += e.deltaY;
  }
}

function closeModal() {
  clearComparison()
  modalStore.closeModal()
}

function setSelectedRole(role) {
  modalStore.setSelectedRole(role)
}

function getRoleTabClass(role) {
  const isAvailable = availableRoles.value.includes(role)
  const isSelected = selectedRole.value === role

  if (!isAvailable) {
    return 'cursor-not-allowed bg-transparent'
  }

  if (isSelected) {
    return 'bg-amber-600/20 ring-1 ring-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
  }

  return 'hover:bg-gray-700/50'
}

function getTierColorClass(tier) {
  const colors = {
    'S': 'text-amber-400 font-bold',
    'S-': 'text-amber-400 font-bold',
    'A+': 'text-emerald-400 font-semibold',
    'A': 'text-emerald-400 font-semibold',
    'A-': 'text-emerald-400 font-semibold',
    'B+': 'text-blue-400',
    'B': 'text-blue-400',
    'B-': 'text-blue-400',
    'C+': 'text-gray-400',
    'C': 'text-gray-400',
    'C-': 'text-gray-400',
    'D': 'text-red-400',
  }
  return colors[tier] || 'text-gray-500'
}

function formatWinRate(winRate) {
  if (winRate === null || winRate === undefined) return '-'
  return `${winRate.toFixed(1)}%`
}

function getChampionDisplayName(championId) {
  if (!championId) return '';
  const idLower = championId.toLowerCase();
  const champ = championsStore.allChampions.find(c => 
    c.id?.toLowerCase() === idLower || 
    c.imageName?.toLowerCase() === idLower ||
    c.name?.replace(/['\s]/g, '').toLowerCase() === idLower
  );
  return champ?.name || championId;
}

function getCounterIconUrl(counter) {
  const idLower = counter.champion?.toLowerCase();
  const champ = championsStore.allChampions.find(c => 
    c.id?.toLowerCase() === idLower || 
    c.imageName?.toLowerCase() === idLower ||
    c.name?.replace(/['\s]/g, '').toLowerCase() === idLower
  );
  const imageName = champ?.imageName || counter.champion?.replace(/['\s]/g, '').replace(/[^a-zA-Z0-9]/g, '');
  return riotApiService.getChampionIconUrl(imageName, modalStore.currentPatch)
}

function handleImageError(event) {
  event.target.src = '/assets/icons/no_champion.png'
}

function handleAbilityImageError(event) {
  event.target.style.display = 'none'
  // Ideally, show text fallback if image fails, but logic is handled in template v-if/else
}
</script>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateY(100%);
}

.drawer-enter-to,
.drawer-leave-from {
  transform: translateY(0);
}

/* Custom Scrollbar */
.scrollbar-thin::-webkit-scrollbar {
  height: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 2px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #444;
}
</style>

<template>
  <Teleport to="body">
    <!-- Click outside overlay - transparent but captures clicks -->
    <div
      v-if="modalStore.isOpen"
      class="fixed inset-0 z-40"
      @click="closeModal"
    ></div>

    <Transition name="drawer">
      <div
        v-if="modalStore.isOpen"
        class="fixed bottom-0 left-0 right-0 z-50 bg-[#161616] shadow-2xl border-t border-gray-800 flex flex-col font-sans"
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

        <!-- Content -->
        <div v-else-if="modalStore.champion" class="flex-1 flex flex-col min-h-0 bg-[#161616] relative overflow-hidden">
          
          <!-- Background Effect -->
          <div class="absolute top-0 right-0 w-[400px] h-full bg-gradient-to-l from-amber-900/10 via-transparent to-transparent pointer-events-none"></div>

          <!-- Top Row: Identity & Primary Stats -->
          <div class="flex-shrink-0 px-5 pt-4 pb-1 flex items-start gap-4 z-10">
            <!-- Champion Identity -->
            <div class="flex items-start gap-3 flex-shrink-0">
              <div class="relative group">
                <img
                  :src="modalStore.championIconUrl"
                  :alt="modalStore.champion.name"
                  class="w-16 h-16 rounded-lg shadow-lg border-2 border-gray-700 group-hover:border-amber-500/50 transition-colors"
                />
                <!-- Form Tabs Overlay -->
                <div v-if="modalStore.hasMultipleForms" class="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5 bg-black/80 rounded px-1 py-0.5 shadow-sm">
                   <button
                    v-for="(formName, index) in modalStore.formNames"
                    :key="index"
                    @click="modalStore.setSelectedFormIndex(index)"
                    class="w-2 h-2 rounded-full transition-all border border-gray-600"
                    :class="modalStore.selectedFormIndex === index ? 'bg-amber-500 scale-125 border-amber-300' : 'bg-gray-600 hover:bg-gray-400'"
                    :title="formName"
                  ></button>
                </div>
              </div>
              
              <div class="flex flex-col pt-0.5">
                <h3 class="text-2xl font-bold text-white tracking-tight leading-none mb-1">{{ modalStore.champion.name }}</h3>
                <div class="flex items-center gap-2 text-xs text-gray-400 font-medium">
                  <span class="capitalize text-amber-500/90">{{ modalStore.selectedRole }}</span>
                  <span class="w-1 h-1 rounded-full bg-gray-600"></span>
                  <span :class="getTierColorClass(formattedStats?.tier)">Tier {{ formattedStats?.tier || '-' }}</span>
                  <span class="w-1 h-1 rounded-full bg-gray-600"></span>
                  <span class="text-gray-500">Rank {{ formattedStats?.rank || '-' }}</span>
                </div>
                
                <!-- Abilities Row (moved here for compactness) -->
                 <TooltipProvider :delay-duration="100">
                  <div class="flex items-center gap-1.5 mt-2.5">
                    <Tooltip v-for="ability in abilityIcons" :key="ability.key">
                      <TooltipTrigger as-child>
                        <div
                          class="w-6 h-6 rounded border border-gray-700 overflow-hidden cursor-help transition-all hover:border-amber-500/70 hover:scale-110 relative group/ability"
                          :class="ability.key === 'P' ? 'bg-purple-900/10' : 'bg-gray-800'"
                        >
                          <img
                            v-if="ability.iconUrl"
                            :src="ability.iconUrl"
                            :alt="ability.name"
                            class="w-full h-full object-cover opacity-80 group-hover/ability:opacity-100"
                            @error="handleAbilityImageError"
                          />
                          <span v-else class="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-500">{{ ability.key }}</span>
                        </div>
                      </TooltipTrigger>
                       <TooltipContent side="top" :side-offset="5" class="bg-gray-900 border-gray-700 text-xs p-2 max-w-xs z-[60]">
                        <p class="font-bold text-amber-400 mb-1">{{ ability.name }} <span class="text-gray-500 font-normal">({{ ability.key }})</span></p>
                        <p class="text-gray-300 leading-snug">{{ ability.description }}</p>
                        <div v-if="ability.cooldown" class="mt-1 pt-1 border-t border-gray-700 text-gray-500 flex justify-between">
                            <span>CD: {{ ability.cooldown }}</span>
                            <span v-if="ability.cost">{{ ability.cost.value }} {{ ability.cost.resource }}</span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </div>
            </div>

            <!-- Stats Grid (Compact) -->
            <div v-if="formattedStats" class="ml-auto flex items-center gap-6 pr-2 self-center">
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
                  Counters
                  <span class="text-gray-600 font-normal ml-1">({{ currentRoleCounters.length }})</span>
               </h4>

               <!-- Role Selector (Compact) -->
               <div class="flex bg-gray-800/50 rounded-lg p-0.5 border border-gray-700/50">
                  <button
                    v-for="role in allRoles"
                    :key="role"
                    @click="setSelectedRole(role)"
                    :disabled="!availableRoles.includes(role)"
                    class="w-6 h-6 rounded flex items-center justify-center transition-all relative group"
                    :class="getRoleTabClass(role)"
                  >
                    <img
                      :src="championsStore.getRoleIconUrl(role)"
                      :alt="role"
                      class="w-3.5 h-3.5 transition-opacity"
                      :class="!availableRoles.includes(role) ? 'opacity-20 grayscale' : 'opacity-80 group-hover:opacity-100'"
                    />
                  </button>
               </div>
            </div>

            <!-- Matchups Horizontal List -->
            <div v-if="currentRoleCounters.length > 0" class="flex-1 overflow-x-auto overflow-y-hidden min-h-0 py-1 scrollbar-thin">
              <div class="flex gap-2 h-full items-center pl-1">
                <div
                  v-for="counter in currentRoleCounters"
                  :key="counter.champion"
                  class="flex-shrink-0 w-[4.5rem] h-full bg-[#1e1e1e] rounded border border-gray-800 hover:border-gray-600 transition-all group flex flex-col relative overflow-hidden"
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
                      <div class="text-[10px] font-medium text-gray-300 truncate w-full text-center leading-tight">{{ counter.champion }}</div>
                      <div class="text-[11px] font-bold text-red-400/90 leading-none">{{ formatWinRate(counter.win_rate) }}</div>
                  </div>
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
import { computed } from 'vue'
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

const abilityIcons = computed(() => modalStore.abilityIcons || [])
const formattedStats = computed(() => modalStore.formattedStats)
const currentRoleCounters = computed(() => modalStore.currentRoleCounters || [])
const availableRoles = computed(() => modalStore.availableRoles || [])
const selectedRole = computed(() => modalStore.selectedRole)

const allRoles = ['top', 'jungle', 'middle', 'bottom', 'support']

function closeModal() {
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

function getCounterIconUrl(counter) {
  const imageName = counter.champion?.replace(/['\s]/g, '').replace(/[^a-zA-Z0-9]/g, '')
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

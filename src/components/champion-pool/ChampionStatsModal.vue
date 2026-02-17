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
        class="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1a1a] shadow-2xl border-t border-gray-700 flex flex-col"
        style="height: 420px;"
        @click.stop
      >
        <!-- Loading State -->
        <div v-if="modalStore.isLoading" class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
            <p class="text-gray-400">Loading champion data...</p>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="modalStore.error" class="flex-1 flex items-center justify-center p-6">
          <div class="text-center">
            <svg class="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 class="text-lg font-medium text-white mb-2">Error loading data</h3>
            <p class="text-sm text-gray-400">{{ modalStore.error }}</p>
          </div>
        </div>

        <!-- Content -->
        <div v-else-if="modalStore.champion" class="flex-1 flex flex-col overflow-hidden">
          <!-- ZONE 1: Upper Section - Centered, Narrower -->
          <div class="flex-shrink-0 bg-[#1a1a1a]">
            <div class="max-w-2xl mx-auto px-6 py-3">
              <!-- Champion Header Row -->
              <div class="flex items-center gap-4">
                <img
                  :src="modalStore.championIconUrl"
                  :alt="modalStore.champion.name"
                  class="w-14 h-14 rounded-lg border-2 border-gray-600"
                />
                <div class="flex-1">
                  <h3 class="text-xl font-bold text-white">{{ modalStore.champion.name }}</h3>
                  <p v-if="modalStore.selectedRole" class="text-sm text-gray-400 capitalize">
                    {{ modalStore.selectedRole }} Lane
                  </p>
                </div>
              </div>

              <!-- Form Tabs (only for multi-form champions) -->
              <div v-if="modalStore.hasMultipleForms" class="mt-3">
                <div class="flex items-center gap-1 bg-gray-800/50 rounded-lg p-1 w-fit">
                  <button
                    v-for="(formName, index) in modalStore.formNames"
                    :key="index"
                    @click="modalStore.setSelectedFormIndex(index)"
                    class="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                    :class="modalStore.selectedFormIndex === index
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'"
                  >
                    {{ formName }}
                  </button>
                </div>
              </div>

              <!-- Abilities Row with Tooltips -->
              <TooltipProvider :delay-duration="200">
                <div class="flex items-start gap-2 mt-3">
                  <div
                    v-for="ability in abilityIcons"
                    :key="ability.key"
                    class="relative flex flex-col items-center"
                  >
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <div
                          class="w-11 h-11 rounded-lg border-2 overflow-hidden cursor-help transition-all hover:border-amber-500 hover:scale-105 relative"
                          :class="ability.key === 'P' ? 'border-purple-600 bg-purple-900/30' : 'border-amber-600 bg-amber-900/30'"
                        >
                          <img
                            v-if="ability.iconUrl"
                            :src="ability.iconUrl"
                            :alt="ability.name"
                            class="w-full h-full object-cover"
                            @error="handleAbilityImageError"
                          />
                          <div v-else class="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                            {{ ability.key }}
                          </div>
                          <!-- Key Label -->
                          <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-gray-900 rounded text-xs flex items-center justify-center text-white font-bold border border-gray-600 text-[10px]">
                            {{ ability.key }}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        :side-offset="8"
                        class="max-w-sm bg-gray-900 border-gray-600 text-white p-3 z-[100]"
                      >
                        <div class="space-y-2">
                          <p class="font-semibold text-amber-400">{{ ability.name }}</p>
                          <p class="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{{ ability.description }}</p>
                          <div v-if="ability.cooldown || ability.cost" class="flex gap-3 text-xs text-gray-400 pt-2 border-t border-gray-700">
                            <span v-if="ability.cooldown">Cooldown: {{ ability.cooldown }}</span>
                            <span v-if="ability.cost">Cost: {{ ability.cost.value }} {{ ability.cost.resource }}</span>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                    <!-- Cooldown Display (under icon) -->
                    <div
                      v-if="ability.cooldown"
                      class="mt-1 text-[10px] text-gray-400 text-center leading-tight max-w-[50px]"
                    >
                      {{ ability.cooldown }}
                    </div>
                  </div>
                </div>
              </TooltipProvider>
            </div>
          </div>

          <!-- Stats Bar - Centered, Narrower -->
          <div v-if="formattedStats" class="flex-shrink-0 border-y border-gray-700 bg-[#1f1f1f]">
            <div class="max-w-2xl mx-auto px-6 py-2">
              <div class="flex items-center justify-center gap-6">
                <!-- Tier -->
                <div class="text-center">
                  <div
                    class="text-xl font-bold"
                    :class="getTierColorClass(formattedStats.tier)"
                  >
                    {{ formattedStats.tier }}
                  </div>
                  <div class="text-[10px] text-gray-500 uppercase tracking-wider">Tier</div>
                </div>

                <!-- Rank -->
                <div class="text-center">
                  <div class="text-lg font-bold text-white">{{ formattedStats.rank }}</div>
                  <div class="text-[10px] text-gray-500 uppercase tracking-wider">Rank</div>
                </div>

                <!-- Win Rate -->
                <div class="text-center">
                  <div class="text-lg font-bold text-green-400">{{ formattedStats.winRate }}</div>
                  <div class="text-[10px] text-gray-500 uppercase tracking-wider">Win</div>
                </div>

                <!-- Pick Rate -->
                <div class="text-center">
                  <div class="text-lg font-bold text-blue-400">{{ formattedStats.pickRate }}</div>
                  <div class="text-[10px] text-gray-500 uppercase tracking-wider">Pick</div>
                </div>

                <!-- Ban Rate -->
                <div class="text-center">
                  <div class="text-lg font-bold text-red-400">{{ formattedStats.banRate }}</div>
                  <div class="text-[10px] text-gray-500 uppercase tracking-wider">Ban</div>
                </div>

                <!-- Games -->
                <div class="text-center">
                  <div class="text-lg font-bold text-white">{{ formattedStats.games }}</div>
                  <div class="text-[10px] text-gray-500 uppercase tracking-wider">Games</div>
                </div>
              </div>
            </div>
          </div>

          <!-- ZONE 2: Lower Section - Full Width -->
          <div class="flex-1 flex flex-col min-h-0 bg-[#1a1a1a]">
            <!-- Role Selector Tabs -->
            <div class="flex-shrink-0 px-6 py-2 border-b border-gray-700">
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400 mr-2">Role:</span>
                <button
                  v-for="role in allRoles"
                  :key="role"
                  @click="setSelectedRole(role)"
                  :disabled="!availableRoles.includes(role)"
                  class="w-8 h-8 rounded flex items-center justify-center transition-all"
                  :class="getRoleTabClass(role)"
                  :title="role"
                >
                  <img
                    :src="championsStore.getRoleIconUrl(role)"
                    :alt="role"
                    class="w-5 h-5"
                    :class="!availableRoles.includes(role) ? 'opacity-30' : ''"
                  />
                </button>
              </div>
            </div>

            <!-- Matchups Section -->
            <div class="flex-1 px-6 py-3 overflow-hidden min-h-0">
              <div class="h-full flex flex-col min-h-0">
                <h4 class="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-2 flex-shrink-0">
                  <svg class="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  BAD AGAINST ({{ currentRoleCounters.length }} matchups)
                </h4>

                <!-- Matchups Grid - Horizontal Scroll -->
                <div v-if="currentRoleCounters.length > 0" class="flex-1 overflow-x-auto overflow-y-hidden min-h-0">
                  <div class="flex gap-2 pb-2 h-full items-center" style="min-width: min-content;">
                    <div
                      v-for="counter in currentRoleCounters"
                      :key="counter.champion"
                      class="flex-shrink-0 w-20 p-2 bg-[#252525] rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
                    >
                      <div class="flex flex-col items-center text-center">
                        <img
                          :src="getCounterIconUrl(counter)"
                          :alt="counter.champion"
                          class="w-10 h-10 rounded-lg mb-1"
                          @error="handleImageError"
                        />
                        <div class="text-[10px] font-medium text-white truncate w-full">{{ counter.champion }}</div>
                        <div class="text-xs font-bold text-red-400">{{ formatWinRate(counter.win_rate) }}</div>
                        <div v-if="counter.games" class="text-[10px] text-gray-500">{{ counter.games }}g</div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- No Matchups State -->
                <div v-else class="flex-1 flex items-center justify-center min-h-0">
                  <div class="text-center text-gray-500">
                    <svg class="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-xs">No matchup data available</p>
                  </div>
                </div>
              </div>
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

// Use computed to safely access store data
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
    return 'bg-gray-800 cursor-not-allowed opacity-50'
  }

  if (isSelected) {
    return 'bg-amber-600 hover:bg-amber-500'
  }

  return 'bg-gray-700 hover:bg-gray-600'
}

function getTierColorClass(tier) {
  const colors = {
    'S': 'text-yellow-400',
    'S-': 'text-yellow-400',
    'A+': 'text-green-400',
    'A': 'text-green-400',
    'A-': 'text-green-400',
    'B+': 'text-blue-400',
    'B': 'text-blue-400',
    'B-': 'text-blue-400',
    'C+': 'text-gray-400',
    'C': 'text-gray-400',
    'C-': 'text-gray-400',
    'D': 'text-red-400',
  }
  return colors[tier] || 'text-gray-400'
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
  // Fallback for ability icons - show the key letter instead
  event.target.style.display = 'none'
}
</script>

<style scoped>
/* Drawer slide-up animation */
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

/* Custom scrollbar for matchups */
.overflow-x-auto::-webkit-scrollbar {
  height: 6px;
}

.overflow-x-auto::-webkit-scrollbar-track {
  background: #1a1a1a;
  border-radius: 3px;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 3px;
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>

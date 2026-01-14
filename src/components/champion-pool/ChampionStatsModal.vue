<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="closeModal"
      >
        <div class="fixed inset-0 bg-black/60" @click="closeModal"></div>
        <div
          class="relative w-full max-w-4xl max-h-[90vh] rounded-lg bg-[#1a1a1a] shadow-lg overflow-hidden flex flex-col"
          @click.stop
        >
          <!-- Loading State -->
          <div v-if="isLoading" class="flex items-center justify-center p-12">
            <div class="text-center">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
              <p class="text-gray-400">Loading champion data...</p>
            </div>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-xl font-semibold text-white">Error</h3>
              <button
                @click="closeModal"
                class="text-gray-400 hover:text-white transition-colors"
              >
                <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
            <div class="p-4 bg-red-900/50 border border-red-700 rounded text-red-200">
              {{ error }}
            </div>
          </div>

          <!-- Content -->
          <div v-else-if="champion" class="flex-1 overflow-y-auto">
            <!-- Header -->
            <div class="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
              <div class="flex items-center gap-4">
                <img
                  :src="championIconUrl"
                  :alt="champion.name"
                  class="w-16 h-16 rounded-lg border-2 border-gray-600"
                />
                <div>
                  <h3 class="text-2xl font-bold text-white">{{ champion.name }}</h3>
                  <p class="text-sm text-gray-400">{{ rolesDisplay }}</p>
                </div>
              </div>
              <button
                @click="closeModal"
                class="text-gray-400 hover:text-white transition-colors p-2 rounded hover:bg-gray-700"
              >
                <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>

            <!-- Content Body -->
            <div class="p-6 space-y-8">
              <!-- Abilities Section -->
              <div>
                <h4 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <svg class="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Abilities
                </h4>

                <!-- Passive Ability -->
                <div v-if="passiveAbility" class="mb-6">
                  <div class="flex items-start gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div class="flex-shrink-0">
                      <div class="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                        P
                      </div>
                    </div>
                    <div class="flex-1">
                      <h5 class="text-lg font-semibold text-white mb-1">{{ passiveAbility.name }}</h5>
                      <div class="text-sm text-gray-400">
                        <span class="font-medium">Type:</span> Passive
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Active Abilities -->
                <div v-if="activeAbilities.length > 0" class="grid gap-4">
                  <div
                    v-for="ability in activeAbilities"
                    :key="ability.type"
                    class="flex items-start gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700"
                  >
                    <div class="flex-shrink-0">
                      <div class="w-12 h-12 bg-amber-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                        {{ ability.type }}
                      </div>
                    </div>
                    <div class="flex-1">
                      <h5 class="text-lg font-semibold text-white mb-1">{{ ability.name }}</h5>
                      <div class="space-y-1 text-sm">
                        <div v-if="ability.cooldown" class="text-gray-300">
                          <span class="font-medium text-gray-400">Cooldown:</span> {{ ability.cooldown }}
                        </div>
                        <div v-if="ability.cost" class="text-gray-300">
                          <span class="font-medium text-gray-400">Cost:</span> {{ ability.cost.value }} {{ ability.cost.resource }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else class="text-center py-8 text-gray-400">
                  <svg class="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p>No ability data available</p>
                </div>
              </div>

              <!-- Counters Section -->
              <div v-if="counters.length > 0">
                <h4 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Top Counters
                </h4>

                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div
                    v-for="counter in counters"
                    :key="counter.name"
                    class="flex items-center gap-2 p-2 bg-gray-800/50 rounded border border-gray-700"
                  >
                    <img
                      :src="getCounterIconUrl(counter)"
                      :alt="counter.name"
                      class="w-8 h-8 rounded"
                      @error="handleImageError"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="text-xs font-medium text-white truncate">{{ counter.name }}</div>
                      <div v-if="counter.winRate" class="text-xs text-gray-400">{{ counter.winRate }}%</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- No Data Message -->
              <div v-if="!abilities.length && !counters.length" class="text-center py-12">
                <svg class="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 class="text-lg font-medium text-gray-400 mb-2">No detailed data available</h3>
                <p class="text-sm text-gray-500">Detailed champion statistics are being collected and will be available soon.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useChampionStatsModalStore } from '@/stores/championStatsModal'
import { riotApiService } from '@/services/riotApi'

const modalStore = useChampionStatsModalStore()

// Reactive state from store with safe guards
const isOpen = computed(() => modalStore?.isOpen || false)
const champion = computed(() => modalStore?.champion || null)
const isLoading = computed(() => modalStore?.isLoading || false)
const error = computed(() => modalStore?.error || null)
const championIconUrl = computed(() => modalStore?.championIconUrl || '')
const abilities = computed(() => modalStore?.abilities || [])
const passiveAbility = computed(() => modalStore?.passiveAbility || null)
const activeAbilities = computed(() => modalStore?.activeAbilities || [])
const counters = computed(() => modalStore?.counters || [])

const rolesDisplay = computed(() => {
  if (!champion.value?.roles) return 'No roles'
  return champion.value.roles.join(', ')
})

function closeModal() {
  modalStore.closeModal()
}

function getCounterIconUrl(counter) {
  // Try to get imageName from counter data, fallback to name processing
  const imageName = counter.imageName || counter.name?.replace(/['\s]/g, '').replace(/[^a-zA-Z0-9]/g, '')
  return riotApiService.getChampionIconUrl(imageName, '15.24.1')
}

function handleImageError(event) {
  // Fallback to placeholder on image load error
  event.target.src = '/assets/icons/no_champion.png'
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

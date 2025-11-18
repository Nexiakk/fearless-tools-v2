<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="milestoneStore.isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="milestoneStore.close()"
        @keydown.escape="milestoneStore.close()"
      >
        <div class="fixed inset-0 bg-black/60" @click="milestoneStore.close()"></div>
        <div
          class="relative w-full max-w-7xl max-h-[90vh] rounded-lg bg-gray-800 border border-gray-700 shadow-lg flex flex-col"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-gray-700">
            <h3 class="text-xl font-semibold text-white">Review Assignments</h3>
            <button
              @click="milestoneStore.close()"
              class="text-gray-400 hover:text-white transition-colors"
            >
              <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
          
          <!-- Content: 5 Role Containers -->
          <div class="flex-1 overflow-auto p-4">
            <div class="flex gap-4 h-full">
              <div
                v-for="role in roles"
                :key="role"
                class="flex-1 flex flex-col border border-gray-700 rounded-lg bg-gray-900"
              >
                <!-- Role Header -->
                <div class="p-3 border-b border-gray-700 flex items-center gap-2">
                  <img :src="championsStore.getRoleIconUrl(role)" :alt="role" class="h-6 w-6" />
                  <h4 class="font-semibold text-white">{{ role }}</h4>
                </div>
                
                <!-- Slots Grid (2 columns, 5 rows each) -->
                <div class="flex-1 p-3 overflow-y-auto min-h-0">
                  <div class="flex gap-2 h-full">
                    <div
                      v-for="col in 2"
                      :key="`${role}-col-${col}`"
                      class="flex-1 flex flex-col gap-2 justify-start"
                    >
                      <div
                        v-for="row in 5"
                        :key="`${role}-col-${col}-row-${row}`"
                        @click="handleSlotClick(role, (col - 1) * 5 + (row - 1))"
                        class="milestone-review-slot rounded cursor-pointer transition-all relative overflow-hidden bg-gray-800 border border-gray-600 hover:border-amber-500"
                        :class="{
                          'ring-2 ring-amber-500 border-amber-500': milestoneStore.selectedChampionFromPanel?.role === role && milestoneStore.selectedChampionFromPanel?.index === ((col - 1) * 5 + (row - 1))
                        }"
                        :title="`Game ${(col - 1) * 5 + row} - Click to assign/switch`"
                      >
                        <img
                          v-if="draftStore.unavailablePanelState[role] && draftStore.unavailablePanelState[role][(col - 1) * 5 + (row - 1)]"
                          :src="championsStore.getChampionIconUrl(draftStore.unavailablePanelState[role][(col - 1) * 5 + (row - 1)], 'creator-pool')"
                          :alt="draftStore.unavailablePanelState[role][(col - 1) * 5 + (row - 1)]"
                          class="milestone-review-slot-image w-full h-full object-cover"
                        />
                        <div
                          v-else
                          class="milestone-review-slot-empty flex items-center justify-center h-full"
                        >
                          <img src="/assets/icons/no_champion.png" alt="Empty slot" class="w-12 h-12 opacity-50" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="p-4 border-t border-gray-700 flex justify-end gap-3">
            <button
              @click="handleBalance"
              class="modal-button modal-button-confirm"
            >
              Balance Champions
            </button>
            <button
              @click="milestoneStore.close()"
              class="modal-button modal-button-cancel"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useMilestoneStore } from '@/stores/milestone'
import { useDraftStore } from '@/stores/draft'
import { useChampionsStore } from '@/stores/champions'

const milestoneStore = useMilestoneStore()
const draftStore = useDraftStore()
const championsStore = useChampionsStore()

const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']

const handleSlotClick = (role, index) => {
  const currentChampion = draftStore.unavailablePanelState[role]?.[index]
  
  if (milestoneStore.selectedChampionFromPanel) {
    // Swap champions
    const selectedRole = milestoneStore.selectedChampionFromPanel.role
    const selectedIndex = milestoneStore.selectedChampionFromPanel.index
    const selectedChampion = draftStore.unavailablePanelState[selectedRole]?.[selectedIndex]
    
    if (selectedRole === role && selectedIndex === index) {
      // Deselect
      milestoneStore.setSelectedChampion(null, null)
    } else {
      // Swap - need to trigger reactivity and save
      const newPanelState = JSON.parse(JSON.stringify(draftStore.unavailablePanelState))
      newPanelState[selectedRole][selectedIndex] = currentChampion
      newPanelState[role][index] = selectedChampion
      draftStore.unavailablePanelState = newPanelState
      // Trigger save
      draftStore.queueSave()
      milestoneStore.setSelectedChampion(null, null)
    }
  } else if (currentChampion) {
    // Select champion for moving
    milestoneStore.setSelectedChampion(role, index)
  }
}

const handleBalance = () => {
  draftStore.balanceChampionsAcrossRoles()
  milestoneStore.close()
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

.milestone-review-slot {
  aspect-ratio: 1;
  min-height: 80px;
}

.milestone-review-slot-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.milestone-review-slot-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
</style>

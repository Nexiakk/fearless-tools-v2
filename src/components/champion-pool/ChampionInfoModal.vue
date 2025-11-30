<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isOpen && champion"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="close"
      >
        <div class="fixed inset-0 bg-black/60" @click="close"></div>
        <div
          class="relative w-full max-w-2xl max-h-[90vh] rounded-lg bg-gray-800 border border-gray-700 shadow-lg overflow-hidden flex flex-col"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
            <div class="flex items-center gap-4">
              <img
                :src="championIconUrl"
                :alt="champion.name"
                class="w-12 h-12 rounded"
              />
              <div>
                <h3 class="text-xl font-semibold text-white">{{ champion.name }}</h3>
                <p class="text-sm text-gray-400">{{ rolesDisplay }}</p>
              </div>
            </div>
            <button
              @click="close"
              class="text-gray-400 hover:text-white transition-colors"
            >
              <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
          
          <!-- Messages -->
          <div v-if="adminStore.error" class="mx-6 mt-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
            {{ adminStore.error }}
          </div>
          <div v-if="adminStore.success" class="mx-6 mt-4 p-3 bg-green-900/50 border border-green-700 rounded text-green-200 text-sm">
            {{ adminStore.success }}
          </div>
          
          <!-- Scrollable Content -->
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <!-- Champion Editor Section -->
            <div v-if="adminStore.editedChampion">
              <h4 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Champion Editor
              </h4>
              
              <div class="space-y-4">
                <!-- Champion Editor Form -->
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Champion Name</label>
                  <input
                    type="text"
                    v-model="adminStore.editedChampion.name"
                    class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Image Name</label>
                  <input
                    type="text"
                    v-model="adminStore.editedChampion.imageName"
                    class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Roles</label>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="role in adminStore.validRoles"
                      :key="role"
                      @click="adminStore.toggleRole(role)"
                      class="px-3 py-1 rounded transition-colors"
                      :class="{
                        'bg-amber-600 text-white': adminStore.editedChampion.roles.includes(role),
                        'bg-gray-700 text-gray-300 hover:bg-gray-600': !adminStore.editedChampion.roles.includes(role)
                      }"
                    >
                      {{ role }}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Main Role</label>
                  <select
                    v-model="adminStore.editedChampion.mainRole"
                    @change="adminStore.setMainRole(adminStore.editedChampion.mainRole)"
                    class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
                    :disabled="!adminStore.editedChampion.roles || adminStore.editedChampion.roles.length === 0"
                  >
                    <option
                      v-for="role in adminStore.getSortedRoles(adminStore.editedChampion)"
                      :key="role"
                      :value="role"
                    >
                      {{ role }}
                    </option>
                    <option v-if="!adminStore.editedChampion.roles || adminStore.editedChampion.roles.length === 0" value="">
                      No roles selected
                    </option>
                  </select>
                  <p
                    v-if="adminStore.editedChampion.roles && adminStore.editedChampion.roles.length === 1"
                    class="text-xs text-gray-400 mt-1"
                  >
                    Only one role selected - this is automatically the main role
                  </p>
                </div>
              </div>
            </div>
            
            <!-- OP Tier Editor Section -->
            <div class="border-t border-gray-700 pt-6">
              <h4 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                OP Tier Editor
              </h4>
              
              <div class="space-y-3">
                <p class="text-sm text-gray-400 mb-3">
                  Select which roles this champion is OP tier for:
                </p>
                <div class="flex flex-wrap gap-2">
                  <label
                    v-for="role in adminStore.validRoles"
                    :key="role"
                    class="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      :checked="adminStore.isOpForRole(champion.name, role)"
                      @change="adminStore.toggleOpTier(champion.name, role)"
                      class="w-4 h-4 rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500 focus:ring-1"
                    />
                    <img
                      :src="championsStore.getRoleIconUrl(role)"
                      :alt="role"
                      class="w-5 h-5"
                    />
                    <span class="text-white text-sm font-medium">{{ role }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Footer with Save Button -->
          <div class="border-t border-gray-700 p-6 flex-shrink-0 flex justify-end">
            <button
              @click="handleSave"
              :disabled="adminStore.isLoading"
              class="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <span v-if="!adminStore.isLoading">Save</span>
              <span v-else>Saving...</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useChampionsStore } from '@/stores/champions'
import { useAdminStore } from '@/stores/admin'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  champion: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])

const championsStore = useChampionsStore()
const adminStore = useAdminStore()

const championIconUrl = computed(() => {
  if (!props.champion) return ''
  return championsStore.getChampionIconUrl(props.champion.name, 'creator-pool')
})

const rolesDisplay = computed(() => {
  if (!props.champion) return 'No roles'
  return adminStore.getRolesDisplay(props.champion)
})

const close = () => {
  // Close champion editor modal if open
  if (adminStore.isEditModalOpen) {
    adminStore.closeEditModal()
  }
  emit('close')
}

const handleSave = async () => {
  // Save both champion data and OP tier data
  await adminStore.saveChampion()
  // Don't close the editor - keep it open so user can continue editing if needed
}

// Watch for modal opening and auto-open champion editor
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen && props.champion) {
    // Ensure admin data is loaded
    if (adminStore.champions.length === 0) {
      await adminStore.loadData()
    }
    // Auto-open the champion editor
    if (!adminStore.isEditModalOpen) {
      adminStore.openEditModal(props.champion)
    }
  }
}, { immediate: true })

// Watch for champion changes and load data if needed
watch(() => props.champion, async (newChampion) => {
  if (newChampion && props.isOpen) {
    if (adminStore.champions.length === 0) {
      await adminStore.loadData()
    }
    // Auto-open the champion editor when champion changes
    if (!adminStore.isEditModalOpen) {
      adminStore.openEditModal(newChampion)
    }
  }
}, { immediate: true })
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

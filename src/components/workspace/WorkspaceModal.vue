<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="workspaceStore.isWorkspaceModalOpen"
        class="fixed inset-0 z-[200] flex items-center justify-center p-4"
        @click.self="handleClose"
      >
        <div 
          :class="!workspaceStore.hasWorkspace ? 'bg-black/30' : 'bg-black/80'" 
          class="fixed inset-0 backdrop-blur-sm" 
          @click="handleClose"
        ></div>
        <div
          class="relative w-full max-w-md rounded-lg bg-[#1a1a1a] shadow-lg"
          @click.stop
        >
          <!-- Tabs -->
          <div class="flex border-b border-gray-700">
            <button
              @click="workspaceStore.workspaceModalTab = 'join'"
              :class="{
                'border-b-2 border-amber-500 text-amber-500': workspaceStore.workspaceModalTab === 'join',
                'text-gray-400 hover:text-white': workspaceStore.workspaceModalTab !== 'join'
              }"
              class="flex-1 px-4 py-3 font-medium transition-colors"
            >
              Join Workspace
            </button>
          </div>

          <div class="p-6">
            <h3 class="text-xl font-semibold text-white mb-4">
              {{ workspaceStore.workspaceModalTab === 'join' ? 'Join Workspace' : 'Create Local Workspace' }}
            </h3>
            <p class="text-sm text-gray-400 mb-4">
              {{
                workspaceStore.workspaceModalTab === 'join'
                  ? workspaceStore.currentWorkspaceId
                    ? 'Join a different workspace. You will switch to the new workspace.'
                    : 'You must join a workspace to use the site.'
                  : 'Create a private workspace stored only on your device.'
              }}
            </p>

            <!-- Join Workspace Tab -->
            <div v-if="workspaceStore.workspaceModalTab === 'join'" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Workspace ID</label>
                <input
                  type="text"
                  v-model="joinWorkspaceId"
                  @keyup.enter="handleJoinWorkspace"
                  placeholder="my-team"
                  class="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  v-model="joinWorkspacePassword"
                  @keyup.enter="handleJoinWorkspace"
                  placeholder="Enter password"
                  class="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                />
              </div>
              <p v-if="workspaceError" class="text-red-400 text-sm">{{ workspaceError }}</p>
              <div class="flex justify-end gap-3">
                <button
                  @click="handleJoinWorkspace"
                  :disabled="workspaceStore.isLoading || !joinWorkspaceId || !joinWorkspacePassword"
                  class="modal-button modal-button-confirm"
                >
                  <span v-if="!workspaceStore.isLoading">Join</span>
                  <span v-else>Joining...</span>
                </button>
              </div>
            </div>

            <!-- Create Local Workspace Tab -->
            <div v-if="workspaceStore.workspaceModalTab === 'createLocal'" class="space-y-4">
              <p class="text-xs text-gray-500">
                This workspace will be stored only on your device and won't sync to the cloud.
              </p>
              <p v-if="workspaceError && workspaceStore.workspaceModalTab === 'createLocal'" class="text-red-400 text-sm">
                {{ workspaceError }}
              </p>
              <div class="flex justify-end gap-3">
                <button
                  @click="handleCreateLocalWorkspace"
                  :disabled="workspaceStore.isLoading"
                  class="modal-button modal-button-confirm"
                >
                  <span v-if="!workspaceStore.isLoading">Create</span>
                  <span v-else>Creating...</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useWorkspace } from '@/composables/useWorkspace'

const workspaceStore = useWorkspaceStore()
const { joinWorkspace, createLocalWorkspace } = useWorkspace()

const joinWorkspaceId = ref('')
const joinWorkspacePassword = ref('')
const workspaceError = ref('')

// Watch for modal opening to reset form
watch(() => workspaceStore.isWorkspaceModalOpen, (isOpen) => {
  if (isOpen) {
    joinWorkspaceId.value = ''
    joinWorkspacePassword.value = ''
    workspaceError.value = ''
  }
})

const handleClose = () => {
  // Only allow closing if workspace is already loaded
  if (workspaceStore.currentWorkspaceId) {
    workspaceStore.isWorkspaceModalOpen = false
  }
}

const handleJoinWorkspace = async () => {
  workspaceError.value = ''
  const result = await joinWorkspace(joinWorkspaceId.value.trim(), joinWorkspacePassword.value)
  
  if (result.success) {
    await workspaceStore.loadWorkspace(joinWorkspaceId.value.trim())
    workspaceStore.isWorkspaceModalOpen = false
    joinWorkspaceId.value = ''
    joinWorkspacePassword.value = ''
  } else {
    workspaceError.value = result.error || 'Failed to join workspace'
  }
}

const handleCreateLocalWorkspace = async () => {
  workspaceError.value = ''
  const result = await createLocalWorkspace()
  
  if (result.success) {
    await workspaceStore.loadWorkspace(result.workspaceId)
    workspaceStore.isWorkspaceModalOpen = false
  } else {
    workspaceError.value = result.error || 'Failed to create local workspace'
  }
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

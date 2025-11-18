<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="workspaceStore.isWorkspaceSettingsOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="workspaceStore.isWorkspaceSettingsOpen = false"
      >
        <div class="fixed inset-0 bg-black/60" @click="workspaceStore.isWorkspaceSettingsOpen = false"></div>
        <div
          class="relative w-full max-w-md rounded-lg bg-gray-800 border border-gray-700 p-6 shadow-lg"
          @click.stop
        >
          <h3 class="text-xl font-semibold text-white mb-4">Workspace Settings</h3>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Workspace Name</label>
              <input
                type="text"
                v-model="workspaceName"
                placeholder="Workspace name"
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">New Password (leave blank to keep current)</label>
              <input
                type="password"
                v-model="newPassword"
                placeholder="New password"
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
              />
            </div>
            
            <div v-if="newPassword">
              <label class="block text-sm font-medium text-gray-300 mb-2">Confirm New Password</label>
              <input
                type="password"
                v-model="confirmPassword"
                placeholder="Confirm password"
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
              />
            </div>
            
            <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
            <p v-if="success" class="text-green-400 text-sm">{{ success }}</p>
            
            <div class="flex justify-end gap-3 mt-6">
              <button
                @click="workspaceStore.isWorkspaceSettingsOpen = false"
                class="modal-button modal-button-cancel"
              >
                Cancel
              </button>
              <button
                @click="handleSave"
                :disabled="isSaving"
                class="modal-button modal-button-confirm"
              >
                <span v-if="!isSaving">Save</span>
                <span v-else>Saving...</span>
              </button>
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
const { updateWorkspaceSettings } = useWorkspace()

const workspaceName = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref('')
const isSaving = ref(false)

// Watch for modal opening to reset form
watch(() => workspaceStore.isWorkspaceSettingsOpen, (isOpen) => {
  if (isOpen) {
    workspaceName.value = workspaceStore.currentWorkspaceName || ''
    newPassword.value = ''
    confirmPassword.value = ''
    error.value = ''
    success.value = ''
  }
})

const handleSave = async () => {
  error.value = ''
  success.value = ''
  
  if (newPassword.value && newPassword.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }
  
  isSaving.value = true
  
  try {
    const updates = {}
    if (workspaceName.value && workspaceName.value.trim() !== '') {
      updates.name = workspaceName.value.trim()
    }
    if (newPassword.value && newPassword.value.trim() !== '') {
      updates.password = newPassword.value.trim()
    }
    
    if (Object.keys(updates).length === 0) {
      error.value = 'No changes to save'
      isSaving.value = false
      return
    }
    
    await updateWorkspaceSettings(updates)
    success.value = 'Settings saved successfully'
    workspaceStore.currentWorkspaceName = workspaceName.value
    
    setTimeout(() => {
      workspaceStore.isWorkspaceSettingsOpen = false
    }, 1500)
  } catch (err) {
    error.value = err.message || 'Failed to save settings'
  } finally {
    isSaving.value = false
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


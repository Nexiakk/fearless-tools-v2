<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="workspaceStore.isWorkspaceSwitcherOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="workspaceStore.isWorkspaceSwitcherOpen = false"
      >
        <div class="fixed inset-0 bg-black/60" @click="workspaceStore.isWorkspaceSwitcherOpen = false"></div>
        <div
          class="relative w-full max-w-md rounded-lg bg-gray-800 border border-gray-700 p-6 shadow-lg"
          @click.stop
        >
          <h3 class="text-xl font-semibold text-white mb-4">Switch Workspace</h3>
          
          <div class="space-y-3 mb-4">
            <p class="text-sm text-gray-400">
              Current workspace: <span class="text-white font-medium">
                {{ workspaceStore.isLocalWorkspace ? 'Local workspace' : (workspaceStore.currentWorkspaceName || workspaceStore.currentWorkspaceId || 'None') }}
              </span>
            </p>
            
            <div class="border-t border-gray-700 pt-3">
              <h4 class="text-sm font-semibold text-gray-300 mb-2">Recent Workspaces</h4>
              <div class="space-y-2 max-h-64 overflow-y-auto">
                <button
                  v-for="workspace in workspaceStore.recentWorkspaces"
                  :key="workspace.id"
                  @click="switchWorkspace(workspace.id)"
                  :class="{
                    'bg-amber-600/20 border-amber-500': workspace.isCurrent,
                    'bg-gray-700 hover:bg-gray-600 border-gray-600': !workspace.isCurrent
                  }"
                  class="w-full p-3 rounded border text-left transition-colors"
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-white font-medium">{{ workspace.isLocal ? 'Local workspace' : (workspace.name || workspace.id) }}</div>
                      <div class="text-xs text-gray-400 mt-1">
                        <span v-if="workspace.isLocal">Local workspace</span>
                        <span v-else>Cloud workspace</span>
                        <span v-if="workspace.isCurrent" class="ml-2 text-amber-400">(Current)</span>
                      </div>
                    </div>
                    <svg v-if="workspace.isCurrent" class="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                  </div>
                </button>
                <p v-if="workspaceStore.recentWorkspaces.length === 0" class="text-gray-400 text-sm text-center py-4">
                  No recent workspaces
                </p>
              </div>
            </div>
          </div>
          
          <div class="flex justify-end gap-3 mt-6">
            <button
              @click="workspaceStore.isWorkspaceSwitcherOpen = false"
              class="modal-button modal-button-cancel"
            >
              Close
            </button>
            <button
              @click="openJoinModal"
              class="modal-button modal-button-confirm"
            >
              Join New Workspace
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useWorkspaceStore } from '@/stores/workspace'
import { useWorkspace } from '@/composables/useWorkspace'

const workspaceStore = useWorkspaceStore()
const { switchWorkspace } = useWorkspace()

const openJoinModal = () => {
  workspaceStore.isWorkspaceSwitcherOpen = false
  workspaceStore.isWorkspaceModalOpen = true
  workspaceStore.workspaceModalTab = 'join'
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


<template>
  <Dialog :open="workspaceStore.isWorkspaceSwitcherOpen" @update:open="handleOpenChange">
    <DialogContent class="sm:max-w-md bg-[#1a1a1a] border-gray-700 text-white">
      <DialogHeader>
        <DialogTitle class="text-xl font-semibold text-white">Switch Workspace</DialogTitle>
      </DialogHeader>

      <div class="space-y-3 py-4">
        <!-- Recent Workspaces List -->
        <div class="space-y-2 max-h-80 overflow-y-auto">
          <button
            v-for="workspace in workspaceStore.recentWorkspaces"
            :key="workspace.id"
            @click="handleSwitchWorkspace(workspace.id)"
            :class="{
              'bg-amber-600/20 border-amber-500': workspace.isCurrent,
              'bg-[#252525] hover:bg-[#333333] border-gray-700': !workspace.isCurrent
            }"
            class="w-full p-3 rounded-lg border text-left transition-colors"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <svg
                  class="w-4 h-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                  />
                </svg>
                <div>
                  <div class="text-white font-medium">{{ workspace.name || workspace.id }}</div>
                  <div class="text-xs text-gray-400">{{ workspace.id }}</div>
                </div>
              </div>
              <svg
                v-if="workspace.isCurrent"
                class="h-5 w-5 text-amber-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
          </button>

          <p
            v-if="workspaceStore.recentWorkspaces.length === 0"
            class="text-gray-400 text-sm text-center py-8"
          >
            No recent workspaces
          </p>
        </div>
      </div>

      <DialogFooter class="flex justify-end gap-3 sm:justify-end">
        <button
          @click="workspaceStore.isWorkspaceSwitcherOpen = false"
          class="modal-button modal-button-cancel"
        >
          Close
        </button>
        <button @click="openJoinModal" class="modal-button modal-button-confirm">
          Join New Workspace
        </button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { useWorkspaceStore } from '@/stores/workspace'
import { useWorkspace } from '@/composables/useWorkspace'

const workspaceStore = useWorkspaceStore()
const { switchWorkspace } = useWorkspace()

const handleOpenChange = (open) => {
  workspaceStore.isWorkspaceSwitcherOpen = open
  if (open) {
    workspaceStore.loadRecentWorkspaces()
  }
}

const handleSwitchWorkspace = async (workspaceId) => {
  // Add current workspace to recent before switching
  if (workspaceStore.currentWorkspaceId && !workspaceStore.isLocalWorkspace) {
    workspaceStore.addToRecentWorkspaces(
      workspaceStore.currentWorkspaceId,
      workspaceStore.currentWorkspaceName
    )
  }

  const result = await switchWorkspace(workspaceId)
  if (result.success) {
    workspaceStore.isWorkspaceSwitcherOpen = false
  }
}

const openJoinModal = () => {
  workspaceStore.isWorkspaceSwitcherOpen = false
  workspaceStore.isWorkspaceModalOpen = true
  workspaceStore.workspaceModalTab = 'join'
}
</script>

<style scoped>
.modal-button {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s, filter 0.2s;
}

.modal-button-confirm {
  background-color: #d97706;
  color: white;
}

.modal-button-confirm:hover {
  filter: brightness(1.1);
}

.modal-button-cancel {
  background-color: #444444;
  color: #e0e0e0;
}

.modal-button-cancel:hover {
  background-color: #555555;
}
</style>

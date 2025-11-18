<template>
  <div v-if="workspaceStore.networkError" class="network-error-banner">
    <div class="container mx-auto flex items-center justify-between">
      <div class="flex items-center gap-2">
        <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        <span>{{ workspaceStore.networkError }}</span>
      </div>
      <button @click="clearError" class="text-white hover:text-gray-300 transition-colors">
        <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { useWorkspaceStore } from '@/stores/workspace'

const workspaceStore = useWorkspaceStore()

const clearError = () => {
  workspaceStore.networkError = null
}
</script>

<style scoped>
.network-error-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  background: rgba(127, 29, 29, 0.9);
  border-bottom: 1px solid rgb(185, 28, 28);
  padding: 0.75rem;
  text-align: center;
  color: white;
  font-size: 0.875rem;
}
</style>



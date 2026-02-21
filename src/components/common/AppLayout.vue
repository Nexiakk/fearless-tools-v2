<template>
  <div class="app-layout" :class="{ 'modal-open': workspaceStore.isWorkspaceModalOpen }">
    <!-- Only show navbar when workspace is loaded or modal is open (initialization complete) -->
    <AppHeader v-if="shouldShowUI" />
    <main class="main-content">
      <!-- Show skeleton background when workspace modal is open and no workspace is loaded -->
      <Transition name="skeleton-fade">
        <div v-if="workspaceStore.isWorkspaceModalOpen && !workspaceStore.hasWorkspace" class="skeleton-background-container">
          <div class="container-fluid mx-auto p-4">
            <ChampionPoolSkeleton />
          </div>
        </div>
      </Transition>
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <keep-alive>
            <component :is="Component" />
          </keep-alive>
        </transition>
      </router-view>
    </main>
    <!-- Only show right panel when workspace is loaded (not during initial modal) -->
    <RightSidePanel v-if="workspaceStore.hasWorkspace" />
    
    <!-- Modals -->
    <WorkspaceModal />
    <WorkspaceSwitcher />
    <SettingsModal />
    <ConfirmationModal />
    <NotesModal />
    <ChampionStatsModal />

    <AdminView />
    
    <!-- Network Error Banner -->
    <NetworkErrorBanner />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import AppHeader from './AppHeader.vue'
import RightSidePanel from './RightSidePanel.vue'
import WorkspaceModal from '../workspace/WorkspaceModal.vue'
import WorkspaceSwitcher from '../workspace/WorkspaceSwitcher.vue'
import SettingsModal from './SettingsModal.vue'
import ConfirmationModal from './ConfirmationModal.vue'
import NotesModal from './NotesModal.vue'
import ChampionStatsModal from '@/components/champion-pool/ChampionStatsModal.vue'

import AdminView from '@/views/AdminView.vue'
import NetworkErrorBanner from './NetworkErrorBanner.vue'
import ChampionPoolSkeleton from '@/components/champion-pool/ChampionPoolSkeleton.vue'

const workspaceStore = useWorkspaceStore()

// Show navbar only after initialization is complete AND workspace is actually loaded (not just modal open)
const shouldShowUI = computed(() => {
  return !workspaceStore.isInitializing && workspaceStore.hasWorkspace
})
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Disable interactions with navbar and right panel when workspace modal is open */
.app-layout.modal-open .top-navbar,
.app-layout.modal-open .navbar-right-actions,
.app-layout.modal-open .right-side-panel {
  pointer-events: none;
}

/* Skeleton background container - positioned behind modal */
.skeleton-background-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  overflow-y: auto;
  pointer-events: none;
}

/* Skeleton fade-in transition with delay - appears after blur */
.skeleton-fade-enter-active {
  transition: opacity 0.5s ease-out;
  transition-delay: 0.2s;
}

.skeleton-fade-enter-from {
  opacity: 0;
}

.skeleton-fade-leave-active {
  transition: opacity 0.3s ease-in;
}

.skeleton-fade-leave-to {
  opacity: 0;
}
</style>

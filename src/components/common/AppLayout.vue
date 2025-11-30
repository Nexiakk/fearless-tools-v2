<template>
  <div class="app-layout" :class="{ 'modal-open': workspaceStore.isWorkspaceModalOpen }">
    <!-- Only show navbar when workspace is loaded or modal is open (initialization complete) -->
    <AppHeader v-if="shouldShowUI" />
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <!-- Only show right panel when workspace is loaded (not during initial modal) -->
    <RightSidePanel v-if="workspaceStore.hasWorkspace" />
    
    <!-- Modals -->
    <WorkspaceModal />
    <WorkspaceSwitcher />
    <AuthModal v-model="isAuthModalOpen" />
    <SettingsModal />
    <ConfirmationModal />
    <NotesModal />
    <MilestoneReviewModal />
    <AdminView />
    
    <!-- Network Error Banner -->
    <NetworkErrorBanner />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import AppHeader from './AppHeader.vue'
import RightSidePanel from './RightSidePanel.vue'
import WorkspaceModal from '../workspace/WorkspaceModal.vue'
import WorkspaceSwitcher from '../workspace/WorkspaceSwitcher.vue'
import AuthModal from './AuthModal.vue'
import SettingsModal from './SettingsModal.vue'
import ConfirmationModal from './ConfirmationModal.vue'
import NotesModal from './NotesModal.vue'
import MilestoneReviewModal from './MilestoneReviewModal.vue'
import AdminView from '@/views/AdminView.vue'
import NetworkErrorBanner from './NetworkErrorBanner.vue'

const workspaceStore = useWorkspaceStore()
const isAuthModalOpen = ref(false)

// Show navbar only after initialization is complete AND workspace is actually loaded (not just modal open)
const shouldShowUI = computed(() => {
  return !workspaceStore.isInitializing && workspaceStore.hasWorkspace
})

// Expose for external use
defineExpose({
  openAuthModal: () => { isAuthModalOpen.value = true }
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
</style>



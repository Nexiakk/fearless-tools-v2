<template>
  <div class="app-layout">
    <AppHeader />
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <RightSidePanel />
    
    <!-- Modals -->
    <WorkspaceModal />
    <WorkspaceSwitcher />
    <WorkspaceSettings />
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
import { ref } from 'vue'
import AppHeader from './AppHeader.vue'
import RightSidePanel from './RightSidePanel.vue'
import WorkspaceModal from '../workspace/WorkspaceModal.vue'
import WorkspaceSwitcher from '../workspace/WorkspaceSwitcher.vue'
import WorkspaceSettings from '../workspace/WorkspaceSettings.vue'
import AuthModal from './AuthModal.vue'
import SettingsModal from './SettingsModal.vue'
import ConfirmationModal from './ConfirmationModal.vue'
import NotesModal from './NotesModal.vue'
import MilestoneReviewModal from './MilestoneReviewModal.vue'
import AdminView from '@/views/AdminView.vue'
import NetworkErrorBanner from './NetworkErrorBanner.vue'

const isAuthModalOpen = ref(false)

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
</style>



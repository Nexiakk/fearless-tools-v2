<template>
  <aside class="right-side-panel" v-if="$route.name === 'pool'">
    <div class="side-panel-buttons">
      <!-- Reset Actions Group -->
      <div 
        class="expandable-button-group"
        @mouseenter="resetHovered = true"
        @mouseleave="resetHovered = false"
      >
        <button class="side-panel-icon-button" title="Reset Actions">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <div class="expanded-options" v-if="resetHovered">
          <button
            @click="openConfirmation('Reset unavailable champions? This cannot be undone.', () => draftStore.resetUnavailable(), true)"
            class="expanded-option-button"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Reset Unavailable</span>
          </button>
          <button
            @click="openConfirmation('Are you sure you want to reset highlighted picks?', () => draftStore.resetHighlighted())"
            class="expanded-option-button"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Reset Highlighted</span>
          </button>
        </div>
      </div>
      
      <!-- Review Assignments Button -->
      <div 
        class="expandable-button-group single-option"
        @mouseenter="reviewHovered = true"
        @mouseleave="reviewHovered = false"
      >
        <button 
          class="side-panel-icon-button single-option-button" 
          title="Review Assignments"
          @click="openMilestoneReview"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span class="button-text-expanded" v-if="reviewHovered">Review Assignments</span>
        </button>
      </div>
      
      <!-- Admin Button (Editor Mode) - Only visible to admins -->
      <div 
        v-if="authStore.isAdmin && authStore.isAuthenticated && !authStore.isAnonymous"
        class="expandable-button-group single-option"
        @mouseenter="adminHovered = true"
        @mouseleave="adminHovered = false"
      >
        <button 
          class="side-panel-icon-button single-option-button" 
          :class="{ 'editor-mode-active': adminStore.isEditorModeActive }"
          :title="adminStore.isEditorModeActive ? 'Exit Editor Mode' : 'Enter Editor Mode'"
          @click="toggleEditorMode"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span class="button-text-expanded" v-if="adminHovered">
            {{ adminStore.isEditorModeActive ? 'Exit Editor Mode' : 'Enter Editor Mode' }}
          </span>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useDraftStore } from '@/stores/draft'
import { useConfirmationStore } from '@/stores/confirmation'
import { useMilestoneStore } from '@/stores/milestone'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const draftStore = useDraftStore()
const confirmationStore = useConfirmationStore()
const milestoneStore = useMilestoneStore()
const adminStore = useAdminStore()
const authStore = useAuthStore()

const resetHovered = ref(false)
const reviewHovered = ref(false)
const adminHovered = ref(false)

const toggleEditorMode = () => {
  adminStore.toggleEditorMode()
}

const openConfirmation = (message, confirmAction, isDanger = false) => {
  confirmationStore.open({ message, confirmAction, isDanger })
}

const openMilestoneReview = () => {
  milestoneStore.open()
}
</script>

<style scoped>
.right-side-panel {
  position: fixed;
  right: 0;
  top: 40px; /* Below navbar */
  bottom: 0;
  width: auto; /* No fixed width, just for positioning */
  z-index: 90;
  display: flex;
  flex-direction: column;
  padding: 12px 8px;
  gap: 8px;
  pointer-events: none; /* Allow clicks to pass through empty areas */
}

.side-panel-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: auto; /* Re-enable pointer events for buttons */
}

.expandable-button-group {
  position: relative;
  pointer-events: auto; /* Re-enable pointer events */
}

.side-panel-icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  background-color: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  color: #e0e0e0;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: visible;
  gap: 8px;
}
.expandable-button-group:not(.single-option):hover .side-panel-icon-button {
  border-top-left-radius: 0; /* Remove radius on left side (connection side) */
  border-bottom-left-radius: 0; /* Remove radius on left side (connection side) */
  border-left: none; /* Remove left border to connect */
  background-color: #3a3a3a; /* Hover background when expanded */
  border-color: #3a3a3a; /* Keep border color consistent */
}
.expandable-button-group:not(.single-option) {
  overflow: visible; /* Allow expanded area to be visible */
}

.side-panel-icon-button.single-option-button {
  position: relative;
}
.button-text-expanded {
  position: absolute;
  right: calc(100% - 1px); /* Overlap by 1px to bridge any gap */
  top: -1px; /* Extend slightly to bridge gaps */
  bottom: -1px;
  display: flex;
  align-items: center;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0 12px;
  margin-right: 0;
  background-color: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-right: none;
  border-radius: 6px;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  color: #e0e0e0;
  pointer-events: auto; /* Enable pointer events so hover works */
  z-index: 10;
}
.expandable-button-group.single-option {
  overflow: visible; /* Allow expanded area to be visible */
}
.expandable-button-group.single-option:hover .side-panel-icon-button {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: none;
  background-color: #3a3a3a; /* Hover background when expanded */
  border-color: #3a3a3a; /* Keep consistent border color */
}
.expandable-button-group.single-option .side-panel-icon-button:hover {
  background-color: #2a2a2a; /* Override hover background when expanded */
  border-color: #3a3a3a;
}

.side-panel-icon-button:hover,
.expandable-button-group.single-option:hover .side-panel-icon-button {
  background-color: #3a3a3a;
  border-color: #3a3a3a; /* Keep border color consistent */
}
.expandable-button-group:not(.single-option):hover .side-panel-icon-button {
  border-color: #3a3a3a; /* Explicitly set border color when expanded */
}



.side-panel-icon-button svg {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}


.expanded-options {
  position: absolute;
  right: calc(100% - 1px); /* Overlap by 1px to connect seamlessly */
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  background-color: #2a2a2a; /* Same background as button */
  border: 1px solid #3a3a3a;
  border-right: none; /* No right border to connect visually */
  border-radius: 6px;
  border-top-right-radius: 0; /* No radius on right (connection side) */
  border-bottom-right-radius: 0; /* No radius on right (connection side) */
  padding: 0;
  min-width: 180px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 100;
  pointer-events: auto; /* Ensure it can receive mouse events */
  overflow: hidden; /* Ensure rounded corners work */
}

.expanded-option-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background-color: #2a2a2a; /* Ensure background is set */
  border: none;
  border-radius: 0;
  color: #e0e0e0;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
}
.expanded-option-button:first-child {
  border-top-left-radius: 6px; /* Rounded on left side (expanding left) */
}
.expanded-option-button:last-child {
  border-bottom-left-radius: 6px; /* Rounded on left side (expanding left) */
}

.expanded-option-button:hover {
  background-color: #3a3a3a;
  color: #ffffff;
}

.expanded-option-button:first-child {
  color: #f97316; /* Orangish text for Reset Unavailable */
  background-color: #2a2a2a;
}

.expanded-option-button:first-child:hover {
  background-color: #854d0e;
  color: #fbbf24; /* Keep orangish text on hover */
}

.expanded-option-button:nth-child(2) {
  color: #60a5fa; /* Blue-ish text for Reset Highlighted */
  background-color: #2a2a2a;
}

.expanded-option-button:nth-child(2):hover {
  background-color: #1e40af;
  color: #93c5fd; /* Keep blue-ish text on hover */
}

.expanded-option-button svg {
  flex-shrink: 0;
}

.side-panel-icon-button.editor-mode-active {
  background-color: #f59e0b;
  border-color: #d97706;
  color: #ffffff;
}

.side-panel-icon-button.editor-mode-active:hover {
  background-color: #d97706;
  border-color: #b45309;
}
</style>

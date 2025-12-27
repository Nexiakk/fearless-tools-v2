<template>
  <header class="top-navbar" :class="{ 'editor-mode-active': adminStore.isEditorModeActive, 'scouting-page': $route.name === 'scouting' }">
    <div class="navbar-container">
      <!-- Search Bar (aligned with Top lane container, only visible on pool route when enabled) -->
      <div 
        v-if="$route.name === 'pool' && settingsStore.settings.pool.enableSearch" 
        class="navbar-search-container"
      >
        <svg class="navbar-search-icon"><use href="#icon-search"></use></svg>
        <div class="navbar-search-input-wrapper">
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            class="navbar-search-input"
            placeholder="Search..."
            @keydown.escape="clearSearch"
            @input="updateCursorPosition"
            @focus="handleFocus"
            @blur="handleBlur"
            @click="updateCursorPosition"
            @keyup="updateCursorPosition"
          />
          <span 
            v-if="isInputFocused" 
            class="static-cursor"
            :style="cursorStyle"
          >|</span>
        </div>
      </div>
      
      <nav class="navbar-nav">
        <router-link
          to="/pool"
          class="nav-link"
          :class="{ active: $route.name === 'pool' }"
        >
          Fearless Pool
        </router-link>
        <router-link
          v-if="authStore.isAdmin"
          to="/drafting"
          class="nav-link"
          :class="{ active: $route.name === 'drafting' }"
        >
          Drafting
        </router-link>
        <router-link
          to="/scouting"
          class="nav-link"
          :class="{ active: $route.name === 'scouting' }"
        >
          Scouting
        </router-link>
      </nav>
      
      <div class="navbar-right-actions">
        <!-- Real-time sync indicator -->
        <div
          v-if="workspaceStore.currentWorkspaceId && !workspaceStore.isLocalWorkspace"
          class="flex items-center gap-2"
        >
          <div
            v-if="workspaceStore.isSyncing"
            class="flex items-center gap-1 text-xs text-amber-400"
            title="Syncing..."
          >
            <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Syncing</span>
          </div>
          <div
            v-else-if="workspaceStore.lastSyncTime"
            class="text-xs text-green-400"
            :title="'Last synced: ' + workspaceStore.lastSyncTime.toLocaleTimeString('en-US')"
          >
            <svg class="h-4 w-4 inline" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div
            v-if="workspaceStore.activeUsers > 1"
            class="text-xs text-blue-400"
            :title="workspaceStore.activeUsers + ' active users'"
          >
            <span>{{ workspaceStore.activeUsers }}</span> active
          </div>
        </div>
        
        <!-- Network status -->
        <div
          v-if="!workspaceStore.isOnline || workspaceStore.networkError"
          class="flex items-center gap-1 text-xs text-red-400"
          :title="workspaceStore.networkError || 'Offline'"
        >
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          <span v-if="!workspaceStore.isOnline">Offline</span>
        </div>
        
        <!-- Workspace info -->
        <div v-if="workspaceStore.currentWorkspaceId" class="flex items-center gap-2">
          <span v-if="!workspaceStore.isLocalWorkspace" class="text-sm text-gray-400">
            {{ workspaceStore.currentWorkspaceName || workspaceStore.currentWorkspaceId }}
          </span>
          <button
            @click="openWorkspaceSwitcher"
            class="text-gray-400 hover:text-white transition-colors text-sm"
            title="Switch Workspace"
          >
            Switch
          </button>
        </div>
        
        <!-- Admin button -->
        <button
          v-if="authStore.isAdmin && authStore.isAuthenticated && !authStore.isAnonymous"
          @click="openAdminPanel"
          class="text-gray-400 hover:text-white transition-colors text-sm px-2 py-1 bg-amber-600 hover:bg-amber-700 rounded"
          title="Admin Panel"
        >
          Admin
        </button>
        
        <!-- Settings button -->
        <button
          @click="openSettings"
          class="text-gray-400 hover:text-white transition-colors"
          title="Settings"
        >
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useAdminStore } from '@/stores/admin'
import { useChampionSearchStore } from '@/stores/championSearch'
import { storeToRefs } from 'pinia'

const route = useRoute()
const workspaceStore = useWorkspaceStore()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const adminStore = useAdminStore()

// Search functionality
const championSearchStore = useChampionSearchStore()
const { searchQuery } = storeToRefs(championSearchStore)
const isSearchActive = championSearchStore.isSearchActive
const clearSearch = championSearchStore.clearSearch
const searchInputRef = ref(null)
const cursorStyle = ref({ left: '36px' })
const isInputFocused = ref(false)

// Update cursor position for static cursor
const updateCursorPosition = () => {
  if (!searchInputRef.value) return
  nextTick(() => {
    const input = searchInputRef.value
    if (isInputFocused.value) {
      // Create a temporary span to measure text width
      const tempSpan = document.createElement('span')
      tempSpan.style.visibility = 'hidden'
      tempSpan.style.position = 'absolute'
      tempSpan.style.fontSize = window.getComputedStyle(input).fontSize
      tempSpan.style.fontFamily = window.getComputedStyle(input).fontFamily
      tempSpan.textContent = input.value.substring(0, input.selectionStart || input.value.length)
      document.body.appendChild(tempSpan)
      const textWidth = tempSpan.offsetWidth
      document.body.removeChild(tempSpan)
      cursorStyle.value = { left: `${36 + textWidth}px` }
    }
  })
}

// Handle focus events
const handleFocus = () => {
  isInputFocused.value = true
  updateCursorPosition()
}

const handleBlur = () => {
  isInputFocused.value = false
}

// Watch searchQuery to update cursor position
watch(searchQuery, () => {
  updateCursorPosition()
})

// Auto-focus logic - maintain focus when on pool route
let focusInterval = null
let clickHandler = null

const maintainFocus = () => {
  if (route.name === 'pool' && 
      settingsStore.settings.pool.enableSearch && 
      searchInputRef.value &&
      document.activeElement !== searchInputRef.value) {
    searchInputRef.value.focus()
    isInputFocused.value = true
  }
}

const setupAutoFocus = () => {
  if (route.name === 'pool' && settingsStore.settings.pool.enableSearch) {
    // Focus immediately
    nextTick(() => {
      if (searchInputRef.value) {
        searchInputRef.value.focus()
        isInputFocused.value = true
      }
    })
    
    // Set up interval to maintain focus
    focusInterval = setInterval(maintainFocus, 100)
    
    // Handle clicks to refocus
    clickHandler = (e) => {
      // Don't refocus if clicking on the search input itself or its container
      if (e.target === searchInputRef.value || 
          searchInputRef.value?.contains(e.target) ||
          e.target.closest('.navbar-search-container')) {
        return
      }
      // Refocus after a short delay to allow the click to complete
      setTimeout(() => {
        maintainFocus()
      }, 10)
    }
    document.addEventListener('click', clickHandler)
  }
}

const cleanupAutoFocus = () => {
  if (focusInterval) {
    clearInterval(focusInterval)
    focusInterval = null
  }
  if (clickHandler) {
    document.removeEventListener('click', clickHandler)
    clickHandler = null
  }
}

// Watch for route changes
watch(() => route.name, (newRoute, oldRoute) => {
  cleanupAutoFocus()
  // Clear search when leaving pool route
  if (oldRoute === 'pool' && newRoute !== 'pool') {
    clearSearch()
  }
  if (newRoute === 'pool' && settingsStore.settings.pool.enableSearch) {
    setupAutoFocus()
  }
})

// Watch for settings changes
watch(() => settingsStore.settings.pool.enableSearch, (enabled) => {
  cleanupAutoFocus()
  if (!enabled) {
    // Clear search when disabling the feature
    clearSearch()
  } else if (enabled && route.name === 'pool') {
    setupAutoFocus()
  }
})

onMounted(() => {
  if (route.name === 'pool' && settingsStore.settings.pool.enableSearch) {
    setupAutoFocus()
  }
})

onUnmounted(() => {
  cleanupAutoFocus()
})

const openWorkspaceSwitcher = () => {
  workspaceStore.isWorkspaceSwitcherOpen = true
  workspaceStore.loadRecentWorkspaces()
}

const openAdminPanel = () => {
  adminStore.open()
}

const openSettings = () => {
  const settingsStore = useSettingsStore()
  settingsStore.openSettings()
}
</script>



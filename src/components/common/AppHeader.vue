<template>
  <header class="top-navbar" :class="{ 'editor-mode-active': adminStore.isEditorModeActive }">
    <div class="navbar-container">
      <nav class="navbar-nav">
        <router-link
          to="/pool"
          class="nav-link"
          :class="{ active: $route.name === 'pool' }"
        >
          Champion Pool
        </router-link>
        <router-link
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
            :title="'Last synced: ' + workspaceStore.lastSyncTime.toLocaleTimeString()"
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
          <span class="text-sm text-gray-400">
            {{ workspaceStore.currentWorkspaceName || workspaceStore.currentWorkspaceId }}
          </span>
          <button
            @click="openWorkspaceSwitcher"
            class="text-gray-400 hover:text-white transition-colors text-sm"
            title="Switch Workspace"
          >
            Switch
          </button>
          <button
            v-if="authStore.isAdmin && authStore.isAuthenticated && !authStore.isAnonymous && !workspaceStore.isLocalWorkspace"
            @click="openWorkspaceSettings"
            class="text-gray-400 hover:text-white transition-colors text-sm"
            title="Workspace Settings"
          >
            ⚙
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
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useAdminStore } from '@/stores/admin'

const workspaceStore = useWorkspaceStore()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const adminStore = useAdminStore()

const openWorkspaceSwitcher = () => {
  workspaceStore.isWorkspaceSwitcherOpen = true
  workspaceStore.loadRecentWorkspaces()
}

const openWorkspaceSettings = () => {
  workspaceStore.openWorkspaceSettings()
}

const openAdminPanel = () => {
  adminStore.open()
}

const openSettings = () => {
  const settingsStore = useSettingsStore()
  settingsStore.openSettings()
}
</script>



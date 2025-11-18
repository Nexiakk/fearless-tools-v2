import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './assets/css/main.css'

// Initialize Firebase
import './services/firebase/config'
import { authService } from './services/firebase/auth'
import { useAuthStore } from './stores/auth'
import { useWorkspaceStore } from './stores/workspace'
import { useChampionsStore } from './stores/champions'
import { workspaceService } from './services/workspace'
import { riotApiService } from './services/riotApi'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Initialize app after stores are set up
app.mount('#app')

// Initialize app state
async function initializeApp() {
  console.log('Initializing Vue app...')
  
  // Initialize auth store (will set up listener automatically)
  const authStore = useAuthStore()
  
  // Initialize patch version
  const championsStore = useChampionsStore()
  await championsStore.initializePatchVersion()
  
  // Try to auto-join workspace
  const workspaceStore = useWorkspaceStore()
  const savedWorkspaceId = workspaceService.getCurrentWorkspaceId()
  
  if (savedWorkspaceId) {
    try {
      console.log('Attempting auto-join for workspace:', savedWorkspaceId)
      const autoJoinResult = await workspaceService.autoJoinWorkspace()
      if (autoJoinResult.success) {
        console.log('Auto-join successful, loading workspace...')
        await workspaceStore.loadWorkspace(savedWorkspaceId)
        console.log('Auto-joined workspace:', savedWorkspaceId)
      } else {
        console.log('Auto-join failed:', autoJoinResult.error)
        workspaceStore.isWorkspaceModalOpen = true
      }
    } catch (error) {
      console.error('Error auto-joining workspace:', error)
      workspaceStore.isWorkspaceModalOpen = true
    }
  } else {
    // No saved workspace, show join modal
    workspaceStore.isWorkspaceModalOpen = true
  }
  
  console.log('App initialization complete')
}

// Initialize after a short delay to ensure everything is ready
setTimeout(() => {
  initializeApp()
}, 100)



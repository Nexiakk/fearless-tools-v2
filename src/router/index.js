import { createRouter, createWebHistory } from 'vue-router'
import ChampionPoolView from '@/views/ChampionPoolView.vue'
import DraftingView from '@/views/DraftingView.vue'
import ScoutingView from '@/views/ScoutingView.vue'

const routes = [
  { 
    path: '/', 
    redirect: '/pool' 
  },
  { 
    path: '/pool', 
    name: 'pool', 
    component: ChampionPoolView,
    meta: { title: 'Fearless Pool' }
  },
  { 
    path: '/drafting', 
    name: 'drafting', 
    component: DraftingView,
    meta: { title: 'Drafting Tool' }
  },
  { 
    path: '/scouting', 
    name: 'scouting', 
    component: ScoutingView,
    meta: { title: 'Scouting' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guards
router.beforeEach(async (to, from, next) => {
  // Check authentication for protected routes
  if (to.meta.requiresAuth) {
    // Check authentication - will be implemented with auth store
    // For now, allow access
    next()
    return
  }
  
  // Cleanup when leaving scouting view
  if (from.name === 'scouting' && to.name !== 'scouting') {
    try {
      // Import store dynamically to avoid circular dependency
      const { useScoutingStore } = await import('@/stores/scouting')
      const scoutingStore = useScoutingStore()
      // Reset all loading and state
      scoutingStore.resetLoadingState()
    } catch (err) {
      // If store import fails, continue anyway
      console.warn('Failed to cleanup scouting store:', err)
    }
  }
  
  next()
})

export default router



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
    meta: { title: 'Champion Pool' }
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

// Navigation guard for admin routes
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth) {
    // Check authentication - will be implemented with auth store
    // For now, allow access
    next()
  } else {
    next()
  }
})

export default router



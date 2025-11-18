// Authentication Composable
import { computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { authService } from '@/services/firebase/auth'

export function useAuth() {
  const store = useAuthStore()
  let unsubscribe = null

  // Initialize auth state listener
  onMounted(() => {
    // Check current state
    const currentUser = authService.getCurrentUser()
    if (currentUser) {
      store.setUser(currentUser)
      if (!currentUser.isAnonymous) {
        authService.isAdmin().then(isAdmin => {
          store.setAdmin(isAdmin)
        })
      }
    }

    // Subscribe to auth state changes
    unsubscribe = authService.onAuthStateChanged(async (user) => {
      store.setUser(user)
      if (user && !user.isAnonymous) {
        const isAdmin = await authService.isAdmin()
        store.setAdmin(isAdmin)
      } else {
        store.setAdmin(false)
      }
    })
  })

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe()
    }
  })

  const signIn = async (email, password) => {
    store.setLoading(true)
    try {
      const result = await authService.signIn(email, password)
      if (result.user) {
        store.setUser(result.user)
        store.setAdmin(await authService.isAdmin())
        return { success: true }
      }
      return { success: false, error: result.error }
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      store.setLoading(false)
    }
  }

  const signOut = async () => {
    store.setLoading(true)
    try {
      const result = await authService.signOut()
      if (!result.error) {
        store.setUser(null)
        store.setAdmin(false)
        return { success: true }
      }
      return { success: false, error: result.error }
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      store.setLoading(false)
    }
  }

  return {
    // State
    isAuthenticated: computed(() => store.isAuthenticated),
    isAdmin: computed(() => store.isAdmin),
    user: computed(() => store.user),
    isLoading: computed(() => store.isLoading),
    isAnonymous: computed(() => store.isAnonymous),
    userEmail: computed(() => store.userEmail),
    // Actions
    signIn,
    signOut
  }
}


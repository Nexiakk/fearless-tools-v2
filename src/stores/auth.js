import { defineStore } from 'pinia'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { authService } from '@/services/firebase/auth'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  const isAuthenticated = ref(false)
  const isAdmin = ref(false)
  const isLoading = ref(false)
  let unsubscribe = null
  
  // Getters
  const isAnonymous = computed(() => user.value?.isAnonymous || false)
  const userEmail = computed(() => user.value?.email || null)
  
  // Initialize auth state listener
  function initializeAuthListener() {
    // Check current state
    const currentUser = authService.getCurrentUser()
    if (currentUser) {
      user.value = currentUser
      isAuthenticated.value = true
      if (!currentUser.isAnonymous) {
        authService.isAdmin().then(admin => {
          isAdmin.value = admin
        })
      }
    }
    
    // Subscribe to auth state changes
    unsubscribe = authService.onAuthStateChanged(async (newUser) => {
      user.value = newUser
      isAuthenticated.value = !!newUser
      
      if (newUser && !newUser.isAnonymous) {
        const admin = await authService.isAdmin()
        isAdmin.value = admin
      } else {
        isAdmin.value = false
      }
    })
  }
  
  // Actions
  function setUser(newUser) {
    user.value = newUser
    isAuthenticated.value = !!newUser
  }
  
  function setAdmin(value) {
    isAdmin.value = value
  }
  
  function setLoading(value) {
    isLoading.value = value
  }
  
  async function signIn(email, password) {
    isLoading.value = true
    try {
      const result = await authService.signIn(email, password)
      if (result.user) {
        user.value = result.user
        isAuthenticated.value = true
        isAdmin.value = await authService.isAdmin()
        return { success: true }
      }
      return { success: false, error: result.error }
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      isLoading.value = false
    }
  }
  
  async function signOut() {
    isLoading.value = true
    try {
      const result = await authService.signOut()
      if (!result.error) {
        user.value = null
        isAuthenticated.value = false
        isAdmin.value = false
        return { success: true }
      }
      return { success: false, error: result.error }
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      isLoading.value = false
    }
  }
  
  // Initialize on store creation
  if (typeof window !== 'undefined') {
    initializeAuthListener()
  }
  
  return {
    // State
    user,
    isAuthenticated,
    isAdmin,
    isLoading,
    // Getters
    isAnonymous,
    userEmail,
    // Actions
    setUser,
    setAdmin,
    setLoading,
    signIn,
    signOut
  }
})

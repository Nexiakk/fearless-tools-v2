// Firebase Authentication Service (v9+ modular API)
import { 
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged
} from 'firebase/auth'
import { auth } from './config'

// Authentication Service
export const authService = {
  // Get current user
  getCurrentUser() {
    return auth.currentUser
  },

  // Check if user is authenticated
  isAuthenticated() {
    return auth.currentUser !== null
  },

  // Get user ID
  getUserId() {
    return auth.currentUser?.uid || null
  },

  // Sign in with email and password
  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      return { user: userCredential.user, error: null }
    } catch (error) {
      console.error('Sign in error:', error)
      return { user: null, error: error.message }
    }
  },

  // Sign in anonymously
  async signInAnonymously() {
    try {
      const userCredential = await signInAnonymously(auth)
      return { user: userCredential.user, error: null }
    } catch (error) {
      console.error('Anonymous sign in error:', error)
      return { user: null, error: error.message }
    }
  },

  // Sign out
  async signOut() {
    try {
      await firebaseSignOut(auth)
      return { error: null }
    } catch (error) {
      console.error('Sign out error:', error)
      return { error: error.message }
    }
  },

  // Subscribe to auth state changes
  onAuthStateChanged(callback) {
    if (typeof callback !== 'function') {
      return () => {}
    }
    
    // Call immediately with current user if available
    if (auth.currentUser !== null) {
      try {
        callback(auth.currentUser)
      } catch (error) {
        console.error('Error in initial auth state callback:', error)
      }
    }
    
    // Subscribe to changes
    const unsubscribe = firebaseOnAuthStateChanged(auth, (user) => {
      try {
        callback(user)
      } catch (error) {
        console.error('Error in auth state listener:', error)
      }
    })
    
    return unsubscribe
  },

  // Check if user is a global admin (non-anonymous users are admins)
  async isAdmin() {
    const user = auth.currentUser
    if (!user) {
      return false
    }
    // Only email/password users can be admins (not anonymous)
    return !user.isAnonymous
  }
}

// Auto-sign in anonymously on load (for regular users)
// Wait for Firebase to be fully initialized and restore auth state
if (typeof window !== 'undefined') {
  setTimeout(() => {
    // Set up a one-time listener to check if we need to sign in anonymously
    const unsubscribe = firebaseOnAuthStateChanged(auth, async (user) => {
      // Unsubscribe after first check to avoid multiple calls
      unsubscribe()
      
      // Only sign in anonymously if there's truly no user
      if (!user) {
        try {
          await signInAnonymously(auth)
          console.log('Auto-signed in anonymously (no persisted session found)')
        } catch (error) {
          console.error('Failed to sign in anonymously:', error)
        }
      } else {
        console.log('Persisted session found:', user.isAnonymous ? 'Anonymous' : user.email)
      }
    })
  }, 500)
}


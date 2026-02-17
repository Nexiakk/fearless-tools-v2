// Workspace Service (v9+ modular API)
import {
  doc,
  getDoc,
  setDoc,
  collection,
  serverTimestamp
} from 'firebase/firestore'
import { db } from './firebase/config'
import { authService } from './firebase/auth'

// Simple password hashing
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

// Sanitize workspace name to use as ID
function sanitizeWorkspaceId(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export const workspaceService = {
  // Get current workspace ID from localStorage
  getCurrentWorkspaceId() {
    return localStorage.getItem('currentWorkspaceId')
  },

  // Get saved workspace password hash
  getSavedWorkspacePasswordHash() {
    return localStorage.getItem('currentWorkspacePasswordHash')
  },

  // Get password hash for a specific workspace
  getWorkspacePasswordHash(workspaceId) {
    if (!workspaceId) return null
    try {
      const stored = localStorage.getItem('workspacePasswordHashes')
      const hashes = stored ? JSON.parse(stored) : {}
      return hashes[workspaceId] || null
    } catch (error) {
      console.error('Error reading workspace password hash:', error)
      return null
    }
  },

  // Save password hash for a specific workspace
  saveWorkspacePasswordHash(workspaceId, passwordHash) {
    if (!workspaceId) return
    try {
      const stored = localStorage.getItem('workspacePasswordHashes')
      const hashes = stored ? JSON.parse(stored) : {}
      hashes[workspaceId] = passwordHash
      localStorage.setItem('workspacePasswordHashes', JSON.stringify(hashes))
    } catch (error) {
      console.error('Error saving workspace password hash:', error)
    }
  },

  // Set current workspace ID and password hash
  setCurrentWorkspaceId(workspaceId, passwordHash = null) {
    if (workspaceId) {
      localStorage.setItem('currentWorkspaceId', workspaceId)
      if (passwordHash) {
        localStorage.setItem('currentWorkspacePasswordHash', passwordHash)
        // Also save in per-workspace store for easy switching
        workspaceService.saveWorkspacePasswordHash(workspaceId, passwordHash)
      }
    } else {
      localStorage.removeItem('currentWorkspaceId')
      localStorage.removeItem('currentWorkspacePasswordHash')
    }
  },

  // Create a new workspace (Admin only)
  async createWorkspace(name, password) {
    if (!authService.isAuthenticated()) {
      throw new Error('User must be authenticated to create a workspace.')
    }

    // Only allow email/password users (admins) to create workspaces
    const currentUser = authService.getCurrentUser()
    if (currentUser && currentUser.isAnonymous) {
      throw new Error('Workspace creation is only available to admins.')
    }

    // Use sanitized name as workspace ID
    const workspaceId = sanitizeWorkspaceId(name)
    if (!workspaceId) {
      throw new Error('Invalid workspace name. Please use alphanumeric characters and spaces.')
    }

    // Hash password
    const passwordHash = await hashPassword(password)
    const userId = authService.getUserId()

    try {
      const workspaceRef = doc(db, 'workspaces', workspaceId)
      const metadataRef = doc(workspaceRef, 'metadata', 'info')

      // Check if workspace already exists
      const existingMetadata = await getDoc(metadataRef)
      if (existingMetadata.exists()) {
        return { workspaceId: null, error: 'Workspace with this name already exists.' }
      }

      // Create workspace metadata
      await setDoc(metadataRef, {
        name: name,
        passwordHash: passwordHash,
        createdAt: serverTimestamp(),
        createdBy: userId
      })

      // Initialize default draft data
      const draftsRef = collection(workspaceRef, 'drafts')
      await setDoc(doc(draftsRef, 'current_draft'), {
        draftSeries: [],
        highlightedChampions: {},
        unavailablePanelState: {
          Top: Array(10).fill(null),
          Jungle: Array(10).fill(null),
          Mid: Array(10).fill(null),
          Bot: Array(10).fill(null),
          Support: Array(10).fill(null)
        },
        pickContext: []
      })

      // Set as current workspace
      this.setCurrentWorkspaceId(workspaceId, passwordHash)

      return { workspaceId, error: null }
    } catch (error) {
      console.error('Error creating workspace:', error)
      return { workspaceId: null, error: error.message }
    }
  },

  // Join an existing workspace
  async joinWorkspace(workspaceId, password) {
    // Ensure user is authenticated (anonymous is fine)
    if (!authService.isAuthenticated()) {
      // Sign in anonymously to enable Firestore writes
      const result = await authService.signInAnonymously()
      if (!result.user) {
        throw new Error('Failed to authenticate anonymously: ' + (result.error || 'Unknown error'))
      }
    }

    const passwordHash = await hashPassword(password)

    try {
      const workspaceRef = doc(db, 'workspaces', workspaceId)
      const metadataRef = doc(workspaceRef, 'metadata', 'info')
      const metadataDoc = await getDoc(metadataRef)

      if (!metadataDoc.exists()) {
        return { success: false, error: 'Workspace not found.' }
      }

      const metadata = metadataDoc.data()
      if (metadata.passwordHash !== passwordHash) {
        return { success: false, error: 'Incorrect password.' }
      }

      // Set as current workspace and save password hash for auto-join
      this.setCurrentWorkspaceId(workspaceId, passwordHash)

      return { success: true, error: null }
    } catch (error) {
      console.error('Error joining workspace:', error)
      return { success: false, error: error.message }
    }
  },

  // Get workspace metadata
  async getWorkspaceMetadata(workspaceId) {
    if (!workspaceId) {
      return null
    }
    try {
      const workspaceRef = doc(db, 'workspaces', workspaceId)
      const metadataRef = doc(workspaceRef, 'metadata', 'info')
      const metadataDoc = await getDoc(metadataRef)
      if (metadataDoc.exists()) {
        return { id: workspaceId, ...metadataDoc.data() }
      }
      return null
    } catch (error) {
      console.error('Error fetching workspace metadata:', error)
      return null
    }
  },

  // Check if user has access to workspace (simplified - just checks localStorage)
  // Workspace access is controlled by knowing the workspace password
  async isWorkspaceMember(workspaceId) {
    // Access is determined by having the workspace password saved
    return this.getCurrentWorkspaceId() === workspaceId
  },

  // Leave workspace
  async leaveWorkspace(workspaceId) {
    if (!workspaceId) {
      return { success: false, error: 'Invalid workspace.' }
    }

    // If leaving current workspace, clear it
    if (this.getCurrentWorkspaceId() === workspaceId) {
      this.setCurrentWorkspaceId(null)
    }

    return { success: true, error: null }
  },

  // Create a local storage workspace (only one local workspace allowed)
  createLocalWorkspace(name = null) {
    // Delete any existing local workspaces (only one allowed)
    const existingLocalWorkspaces = this.getLocalWorkspaces()
    const existingIds = Object.keys(existingLocalWorkspaces)
    
    // Clear current workspace if it's a local workspace
    const currentWorkspaceId = this.getCurrentWorkspaceId()
    if (currentWorkspaceId && currentWorkspaceId.startsWith('local_')) {
      this.setCurrentWorkspaceId(null)
    }

    // Generate a unique local workspace ID
    const workspaceId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Store workspace data in localStorage (only one local workspace)
    const workspaceData = {
      id: workspaceId,
      name: name && name.trim() !== '' ? name.trim() : null,
      isLocal: true,
      createdAt: new Date().toISOString(),
      draftData: {
        draftSeries: [],
        highlightedChampions: {},
        unavailablePanelState: {
          Top: Array(10).fill(null),
          Jungle: Array(10).fill(null),
          Mid: Array(10).fill(null),
          Bot: Array(10).fill(null),
          Support: Array(10).fill(null)
        },
        pickContext: []
      }
    }

    // Store in localStorage (replace all existing local workspaces)
    const localWorkspaces = {}
    localWorkspaces[workspaceId] = workspaceData
    localStorage.setItem('localWorkspaces', JSON.stringify(localWorkspaces))

    // Set as current workspace
    this.setCurrentWorkspaceId(workspaceId)

    return { workspaceId, error: null }
  },

  // Get all local workspaces
  getLocalWorkspaces() {
    try {
      const stored = localStorage.getItem('localWorkspaces')
      return stored ? JSON.parse(stored) : {}
    } catch (error) {
      console.error('Error reading local workspaces:', error)
      return {}
    }
  },

  // Get local workspace data
  getLocalWorkspaceData(workspaceId) {
    if (!workspaceId || !workspaceId.startsWith('local_')) {
      return null
    }

    const localWorkspaces = this.getLocalWorkspaces()
    return localWorkspaces[workspaceId] || null
  },

  // Save local workspace data
  saveLocalWorkspaceData(workspaceId, draftData) {
    if (!workspaceId || !workspaceId.startsWith('local_')) {
      return false
    }

    try {
      const localWorkspaces = this.getLocalWorkspaces()
      if (localWorkspaces[workspaceId]) {
        localWorkspaces[workspaceId].draftData = draftData
        localWorkspaces[workspaceId].lastUpdated = new Date().toISOString()
        localStorage.setItem('localWorkspaces', JSON.stringify(localWorkspaces))
        return true
      }
      return false
    } catch (error) {
      console.error('Error saving local workspace data:', error)
      return false
    }
  },

  // Auto-join workspace if credentials are saved and still valid
  async autoJoinWorkspace() {
    const savedWorkspaceId = this.getCurrentWorkspaceId()

    if (!savedWorkspaceId) {
      return { success: false, error: 'No saved workspace' }
    }

    // Handle local workspaces
    if (savedWorkspaceId.startsWith('local_')) {
      const localWorkspace = this.getLocalWorkspaceData(savedWorkspaceId)
      if (localWorkspace) {
        console.log('Auto-joining local workspace:', savedWorkspaceId)
        return { success: true, workspaceId: savedWorkspaceId }
      } else {
        this.setCurrentWorkspaceId(null)
        return { success: false, error: 'Local workspace not found' }
      }
    }

    // Handle Firestore workspaces
    const savedPasswordHash = this.getSavedWorkspacePasswordHash()

    if (!savedPasswordHash) {
      return { success: false, error: 'No saved workspace password' }
    }

    try {
      // Check if workspace still exists and password matches
      const metadata = await this.getWorkspaceMetadata(savedWorkspaceId)

      if (!metadata) {
        this.setCurrentWorkspaceId(null)
        return { success: false, error: 'Workspace no longer exists' }
      }

      if (metadata.passwordHash !== savedPasswordHash) {
        this.setCurrentWorkspaceId(null)
        return { success: false, error: 'Workspace password has changed' }
      }

      // Ensure user is authenticated for Firestore access
      if (!authService.isAuthenticated()) {
        const result = await authService.signInAnonymously()
        if (!result.user) {
          return { success: false, error: 'Failed to authenticate: ' + (result.error || 'Unknown error') }
        }
      }

      return { success: true, error: null }
    } catch (error) {
      console.error('Error auto-joining workspace:', error)
      return { success: false, error: error.message }
    }
  },

  // Update workspace settings (Admin only)
  async updateWorkspaceSettings(workspaceId, updates) {
    if (!workspaceId || workspaceId.startsWith('local_')) {
      throw new Error('Cannot update settings for local workspaces')
    }

    if (!authService.isAuthenticated()) {
      throw new Error('Authentication required')
    }

    const isAdmin = await authService.isAdmin()
    if (!isAdmin) {
      throw new Error('Admin access required')
    }

    try {
      const workspaceRef = doc(db, 'workspaces', workspaceId)
      const metadataRef = doc(workspaceRef, 'metadata', 'info')

      const updateData = {}
      if (updates.name && updates.name.trim() !== '') {
        updateData.name = updates.name.trim()
      }
      if (updates.password && updates.password.trim() !== '') {
        updateData.passwordHash = await hashPassword(updates.password)
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error('No changes to save')
      }

      await setDoc(metadataRef, updateData, { merge: true })

      // Update localStorage if password changed
      if (updateData.passwordHash) {
        this.setCurrentWorkspaceId(workspaceId, updateData.passwordHash)
      }

      return { success: true }
    } catch (error) {
      console.error('Error updating workspace settings:', error)
      throw error
    }
  }
}


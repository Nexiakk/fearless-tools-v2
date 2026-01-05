import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import { useWorkspaceStore } from './workspace'
import {
  saveDrawingStroke,
  getDrawingStrokes,
  clearDrawingCanvas,
  setupDrawingRealtimeSync
} from '@/services/firebase/firestore'

export const useDrawingStore = defineStore('drawing', () => {
  // State
  const isDrawingModeActive = ref(false)
  const strokes = ref([])
  const currentStroke = ref(null)
  const color = ref('#ffffff') // Default white
  const brushWidth = ref(3)
  const isSaving = ref(false)
  let unsubscribeRealtimeSync = null
  let pointBatch = []
  let batchTimeout = null

  // Getters
  const canDraw = computed(() => {
    const authStore = useAuthStore()
    return authStore.isAdmin && isDrawingModeActive.value
  })

  const isAdmin = computed(() => {
    const authStore = useAuthStore()
    return authStore.isAdmin
  })

  // Actions
  function toggleDrawingMode() {
    const authStore = useAuthStore()
    if (!authStore.isAdmin) {
      console.warn('Only admins can toggle drawing mode')
      return
    }
    isDrawingModeActive.value = !isDrawingModeActive.value
    
    // If disabling, end any current stroke
    if (!isDrawingModeActive.value && currentStroke.value) {
      endStroke()
    }
  }

  function setColor(newColor) {
    color.value = newColor
  }

  function setBrushWidth(width) {
    brushWidth.value = Math.max(1, Math.min(20, width))
  }

  function startStroke(point) {
    if (!canDraw.value) return

    const strokeId = `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    currentStroke.value = {
      id: strokeId,
      points: [point],
      color: color.value,
      width: brushWidth.value,
      userId: useAuthStore().user?.uid || 'unknown',
      timestamp: Date.now()
    }
  }

  function addPointToStroke(point) {
    if (!canDraw.value || !currentStroke.value) return

    currentStroke.value.points.push(point)
    
    // Batch points for performance (save every 10 points or 50ms)
    pointBatch.push(point)
    
    if (pointBatch.length >= 10) {
      saveCurrentStrokeBatch()
    } else {
      clearTimeout(batchTimeout)
      batchTimeout = setTimeout(() => {
        saveCurrentStrokeBatch()
      }, 50)
    }
  }

  function endStroke() {
    if (!currentStroke.value) return

    // Save any remaining points
    if (pointBatch.length > 0) {
      saveCurrentStrokeBatch()
    }

    // Finalize stroke
    const stroke = { ...currentStroke.value }
    strokes.value.push(stroke)
    
    // Save complete stroke to Firestore
    saveStrokeToFirestore(stroke)
    
    currentStroke.value = null
    pointBatch = []
    if (batchTimeout) {
      clearTimeout(batchTimeout)
      batchTimeout = null
    }
  }

  function saveCurrentStrokeBatch() {
    if (!currentStroke.value || pointBatch.length === 0) return

    // Update stroke with new points
    const stroke = { ...currentStroke.value }
    stroke.points = [...currentStroke.value.points]
    
    // Save batch update to Firestore
    saveStrokeToFirestore(stroke, true) // true = partial update
    
    pointBatch = []
  }

  async function saveStrokeToFirestore(stroke, isPartial = false) {
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId || workspaceStore.isLocalWorkspace) {
      return
    }

    isSaving.value = true
    try {
      await saveDrawingStroke(
        workspaceStore.currentWorkspaceId,
        'drafting',
        stroke,
        isPartial
      )
    } catch (error) {
      console.error('Error saving stroke:', error)
    } finally {
      isSaving.value = false
    }
  }

  async function loadStrokes() {
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId || workspaceStore.isLocalWorkspace) {
      return
    }

    try {
      const loadedStrokes = await getDrawingStrokes(
        workspaceStore.currentWorkspaceId,
        'drafting'
      )
      strokes.value = loadedStrokes
    } catch (error) {
      console.error('Error loading strokes:', error)
    }
  }

  async function clearCanvas() {
    const authStore = useAuthStore()
    if (!authStore.isAdmin) {
      console.warn('Only admins can clear canvas')
      return
    }

    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId || workspaceStore.isLocalWorkspace) {
      return
    }

    try {
      await clearDrawingCanvas(workspaceStore.currentWorkspaceId, 'drafting')
      strokes.value = []
      currentStroke.value = null
    } catch (error) {
      console.error('Error clearing canvas:', error)
      throw error
    }
  }

  function setupRealtimeSync() {
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId || workspaceStore.isLocalWorkspace) {
      return
    }

    // Clean up existing listener
    if (unsubscribeRealtimeSync) {
      unsubscribeRealtimeSync()
      unsubscribeRealtimeSync = null
    }

    unsubscribeRealtimeSync = setupDrawingRealtimeSync(
      workspaceStore.currentWorkspaceId,
      'drafting',
      (newStrokes) => {
        // Merge new strokes with existing ones (avoid duplicates)
        const existingIds = new Set(strokes.value.map(s => s.id))
        const newStrokesToAdd = newStrokes.filter(s => !existingIds.has(s.id))
        
        if (newStrokesToAdd.length > 0) {
          strokes.value = [...strokes.value, ...newStrokesToAdd]
        }
      }
    )
  }

  function cleanup() {
    if (unsubscribeRealtimeSync) {
      unsubscribeRealtimeSync()
      unsubscribeRealtimeSync = null
    }
    if (batchTimeout) {
      clearTimeout(batchTimeout)
      batchTimeout = null
    }
    strokes.value = []
    currentStroke.value = null
    pointBatch = []
    isDrawingModeActive.value = false
  }

  return {
    // State
    isDrawingModeActive,
    strokes,
    currentStroke,
    color,
    brushWidth,
    isSaving,
    // Getters
    canDraw,
    isAdmin,
    // Actions
    toggleDrawingMode,
    setColor,
    setBrushWidth,
    startStroke,
    addPointToStroke,
    endStroke,
    loadStrokes,
    clearCanvas,
    setupRealtimeSync,
    cleanup
  }
})



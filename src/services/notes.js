import {
  saveSlotNote,
  saveChampionNote,
  getNotesForSeries,
  deleteNote,
  setupNotesRealtimeSync
} from '@/services/firebase/firestore'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSeriesStore } from '@/stores/series'

class NotesService {
  constructor() {
    this.slotNotes = new Map() // key: `${side}_${type}_${index}_${gameId || 'global'}`
    this.championNotes = new Map() // key: `${championName}_${gameId || 'global'}`
    this.unsubscribeRealtimeSync = null
  }

  /**
   * Get slot note key
   */
  getSlotNoteKey(side, type, index, gameId = null) {
    return `${side}_${type}_${index}_${gameId || 'global'}`
  }

  /**
   * Get champion note key
   */
  getChampionNoteKey(championName, gameId = null) {
    return `${championName}_${gameId || 'global'}`
  }

  /**
   * Get slot note (checks both local and global)
   */
  getSlotNote(side, type, index, gameId = null) {
    // Check local first
    if (gameId) {
      const localKey = this.getSlotNoteKey(side, type, index, gameId)
      if (this.slotNotes.has(localKey)) {
        return this.slotNotes.get(localKey)
      }
    }
    // Check global
    const globalKey = this.getSlotNoteKey(side, type, index, null)
    return this.slotNotes.get(globalKey) || null
  }

  /**
   * Get champion note (checks both local and global)
   */
  getChampionNote(championName, gameId = null) {
    // Check local first
    if (gameId) {
      const localKey = this.getChampionNoteKey(championName, gameId)
      if (this.championNotes.has(localKey)) {
        return this.championNotes.get(localKey)
      }
    }
    // Check global
    const globalKey = this.getChampionNoteKey(championName, null)
    return this.championNotes.get(globalKey) || null
  }

  /**
   * Save slot note
   */
  async saveSlotNote(side, type, index, notes, scope, gameId = null) {
    const workspaceStore = useWorkspaceStore()
    const seriesStore = useSeriesStore()
    
    if (!workspaceStore.currentWorkspaceId || !seriesStore.currentSeries?.id) {
      console.warn('Cannot save note: No workspace or series selected')
      return
    }

    const noteData = {
      side,
      type,
      index,
      notes,
      gameId: scope === 'local' ? (gameId || seriesStore.currentGame?.id) : null,
      seriesId: seriesStore.currentSeries.id
    }

    try {
      const saved = await saveSlotNote(
        workspaceStore.currentWorkspaceId,
        seriesStore.currentSeries.id,
        noteData
      )
      
      // Update local cache
      const key = this.getSlotNoteKey(side, type, index, noteData.gameId)
      this.slotNotes.set(key, saved)
      
      return saved
    } catch (error) {
      console.error('Error saving slot note:', error)
      throw error
    }
  }

  /**
   * Save champion note
   */
  async saveChampionNote(championName, notes, scope, gameId = null) {
    const workspaceStore = useWorkspaceStore()
    const seriesStore = useSeriesStore()
    
    if (!workspaceStore.currentWorkspaceId || !seriesStore.currentSeries?.id) {
      console.warn('Cannot save note: No workspace or series selected')
      return
    }

    const noteData = {
      championName,
      notes,
      gameId: scope === 'local' ? (gameId || seriesStore.currentGame?.id) : null,
      seriesId: seriesStore.currentSeries.id
    }

    try {
      const saved = await saveChampionNote(
        workspaceStore.currentWorkspaceId,
        seriesStore.currentSeries.id,
        noteData
      )
      
      // Update local cache
      const key = this.getChampionNoteKey(championName, noteData.gameId)
      this.championNotes.set(key, saved)
      
      return saved
    } catch (error) {
      console.error('Error saving champion note:', error)
      throw error
    }
  }

  /**
   * Load notes for series
   */
  async loadNotesForSeries(workspaceId, seriesId) {
    try {
      const { slotNotes, championNotes } = await getNotesForSeries(workspaceId, seriesId)
      
      // Clear existing notes
      this.slotNotes.clear()
      this.championNotes.clear()
      
      // Load slot notes
      slotNotes.forEach(note => {
        const key = this.getSlotNoteKey(note.side, note.type, note.index, note.gameId)
        this.slotNotes.set(key, note)
      })
      
      // Load champion notes
      championNotes.forEach(note => {
        const key = this.getChampionNoteKey(note.championName, note.gameId)
        this.championNotes.set(key, note)
      })
      
      return { slotNotes, championNotes }
    } catch (error) {
      console.error('Error loading notes:', error)
      throw error
    }
  }

  /**
   * Set up real-time sync for notes
   */
  setupRealtimeSync(workspaceId, seriesId) {
    // Clean up existing listener
    if (this.unsubscribeRealtimeSync) {
      this.unsubscribeRealtimeSync()
      this.unsubscribeRealtimeSync = null
    }

    this.unsubscribeRealtimeSync = setupNotesRealtimeSync(
      workspaceId,
      seriesId,
      ({ slotNotes, championNotes }) => {
        // Clear and reload
        this.slotNotes.clear()
        this.championNotes.clear()
        
        slotNotes.forEach(note => {
          const key = this.getSlotNoteKey(note.side, note.type, note.index, note.gameId)
          this.slotNotes.set(key, note)
        })
        
        championNotes.forEach(note => {
          const key = this.getChampionNoteKey(note.championName, note.gameId)
          this.championNotes.set(key, note)
        })
      }
    )
  }

  /**
   * Clean up
   */
  cleanup() {
    if (this.unsubscribeRealtimeSync) {
      this.unsubscribeRealtimeSync()
      this.unsubscribeRealtimeSync = null
    }
    this.slotNotes.clear()
    this.championNotes.clear()
  }
}

export const notesService = new NotesService()



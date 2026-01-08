import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useChampionsStore } from './champions'
import { useNotesStore } from './notes'
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '@/services/firebase/config'
import { useWorkspaceStore } from './workspace'

export const useDraftingStore = defineStore('drafting', () => {
  // State
  const currentDraft = ref({
    id: null,
    name: 'New Draft',
    bluePicks: Array(5).fill(null).map(() => ({ champion: null, notes: '' })),
    blueBans: Array(5).fill(null).map(() => ({ champion: null, notes: '' })),
    redPicks: Array(5).fill(null).map(() => ({ champion: null, notes: '' })),
    redBans: Array(5).fill(null).map(() => ({ champion: null, notes: '' })),
    generalNotes: '',
    createdAt: null
  })
  
  const savedDrafts = ref([])
  const isLoadingSavedDrafts = ref(false)
  const selectedChampionForPlacement = ref(null)
  const selectedChampionSource = ref(null)
  const selectedTargetSlot = ref(null)
  const draftCreatorSearchTerm = ref('')
  const draftCreatorRoleFilter = ref('all')
  
  // Actions
  function resetCurrentDraft() {
    currentDraft.value = {
      id: null,
      name: 'New Draft',
      bluePicks: Array(5).fill(null).map(() => ({ champion: null, notes: '' })),
      blueBans: Array(5).fill(null).map(() => ({ champion: null, notes: '' })),
      redPicks: Array(5).fill(null).map(() => ({ champion: null, notes: '' })),
      redBans: Array(5).fill(null).map(() => ({ champion: null, notes: '' })),
      generalNotes: '',
      createdAt: null
    }
    selectedChampionForPlacement.value = null
    selectedChampionSource.value = null
    selectedTargetSlot.value = null
    draftCreatorSearchTerm.value = ''
    draftCreatorRoleFilter.value = 'all'
  }
  
  function updateSlotNotes(side, type, index, notes) {
    const slotKey = `${side}${type.charAt(0).toUpperCase() + type.slice(1)}`
    if (currentDraft.value[slotKey] && currentDraft.value[slotKey][index]) {
      currentDraft.value[slotKey][index].notes = notes
      saveCurrentDraft()
    }
  }
  
  function updateGeneralNotes(notes) {
    currentDraft.value.generalNotes = notes
    saveCurrentDraft()
  }
  
  function handleSlotClick(side, type, index) {
    const slotKey = `${side}${type.charAt(0).toUpperCase() + type.slice(1)}`
    const slot = currentDraft.value[slotKey]?.[index]
    
    if (selectedChampionForPlacement.value) {
      // Place champion
      if (slot) {
        slot.champion = selectedChampionForPlacement.value
        selectedChampionForPlacement.value = null
        saveCurrentDraft()
      }
    } else if (selectedChampionSource.value) {
      // Move champion
      const sourceKey = `${selectedChampionSource.value.side}${selectedChampionSource.value.type.charAt(0).toUpperCase() + selectedChampionSource.value.type.slice(1)}`
      const sourceSlot = currentDraft.value[sourceKey]?.[selectedChampionSource.value.index]
      
      if (slot && sourceSlot) {
        const tempChamp = sourceSlot.champion
        const tempNotes = sourceSlot.notes
        
        sourceSlot.champion = slot.champion
        sourceSlot.notes = slot.notes
        
        slot.champion = tempChamp
        slot.notes = tempNotes
        
        selectedChampionSource.value = null
        saveCurrentDraft()
      }
    } else if (slot?.champion) {
      // Select for move
      selectedChampionSource.value = { side, type, index }
    } else {
      // Select for targeting
      selectedTargetSlot.value = { side, type, index }
    }
  }
  
  function clearCreatorSlot(side, type, index) {
    const slotKey = `${side}${type.charAt(0).toUpperCase() + type.slice(1)}`
    if (currentDraft.value[slotKey]?.[index]) {
      currentDraft.value[slotKey][index].champion = null
      currentDraft.value[slotKey][index].notes = ''
      if (selectedChampionSource.value && selectedChampionSource.value.side === side && selectedChampionSource.value.type === type && selectedChampionSource.value.index === index) {
        selectedChampionSource.value = null
      }
      if (selectedTargetSlot.value && selectedTargetSlot.value.side === side && selectedTargetSlot.value.type === type && selectedTargetSlot.value.index === index) {
        selectedTargetSlot.value = null
      }
      saveCurrentDraft()
    }
  }
  
  async function saveCurrentDraft() {
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId || workspaceStore.isLocalWorkspace) {
      console.warn('Cannot save draft: No cloud workspace selected')
      return
    }
    
    try {
      const draftData = {
        name: currentDraft.value.name,
        bluePicks: currentDraft.value.bluePicks,
        blueBans: currentDraft.value.blueBans,
        redPicks: currentDraft.value.redPicks,
        redBans: currentDraft.value.redBans,
        generalNotes: currentDraft.value.generalNotes,
        updatedAt: serverTimestamp()
      }
      
      if (currentDraft.value.id) {
        // Update existing
        const draftRef = doc(db, 'workspaces', workspaceStore.currentWorkspaceId, 'drafts', currentDraft.value.id)
        await updateDoc(draftRef, draftData)
      } else {
        // Create new
        draftData.createdAt = serverTimestamp()
        const draftsRef = collection(db, 'workspaces', workspaceStore.currentWorkspaceId, 'drafts')
        const docRef = await addDoc(draftsRef, draftData)
        currentDraft.value.id = docRef.id
        currentDraft.value.createdAt = new Date()
      }
    } catch (error) {
      console.error('Error saving draft:', error)
      throw error
    }
  }
  
  async function refreshSavedDrafts() {
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId || workspaceStore.isLocalWorkspace) {
      savedDrafts.value = []
      return
    }
    
    isLoadingSavedDrafts.value = true
    try {
      const draftsRef = collection(db, 'workspaces', workspaceStore.currentWorkspaceId, 'drafts')
      const q = query(draftsRef)
      const querySnapshot = await getDocs(q)
      
      savedDrafts.value = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0)
        const bTime = b.createdAt?.toDate?.() || new Date(0)
        return bTime - aTime
      })
    } catch (error) {
      console.error('Error loading saved drafts:', error)
    } finally {
      isLoadingSavedDrafts.value = false
    }
  }
  
  async function loadSavedDraft(draftId) {
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId || workspaceStore.isLocalWorkspace) {
      console.warn('Cannot load draft: No cloud workspace selected')
      return
    }
    
    try {
      const draftRef = doc(db, 'workspaces', workspaceStore.currentWorkspaceId, 'drafts', draftId)
      const draftDoc = await draftRef.get()
      
      if (draftDoc.exists()) {
        const data = draftDoc.data()
        currentDraft.value = {
          id: draftId,
          name: data.name || 'Unnamed Draft',
          bluePicks: sanitizeDraftArray(data.bluePicks, 5),
          blueBans: sanitizeDraftArray(data.blueBans, 5),
          redPicks: sanitizeDraftArray(data.redPicks, 5),
          redBans: sanitizeDraftArray(data.redBans, 5),
          generalNotes: data.generalNotes || '',
          createdAt: data.createdAt?.toDate?.() || null
        }
        selectedChampionForPlacement.value = null
        selectedChampionSource.value = null
        selectedTargetSlot.value = null
        draftCreatorSearchTerm.value = ''
        draftCreatorRoleFilter.value = 'all'
      }
    } catch (error) {
      console.error('Error loading draft:', error)
      throw error
    }
  }
  
  async function deleteSavedDraft(draftId) {
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.currentWorkspaceId || workspaceStore.isLocalWorkspace) {
      console.warn('Cannot delete draft: No cloud workspace selected')
      return
    }
    
    try {
      const draftRef = doc(db, 'workspaces', workspaceStore.currentWorkspaceId, 'drafts', draftId)
      await deleteDoc(draftRef)
      savedDrafts.value = savedDrafts.value.filter(d => d.id !== draftId)
      if (currentDraft.value.id === draftId) {
        resetCurrentDraft()
      }
    } catch (error) {
      console.error('Error deleting draft:', error)
      throw error
    }
  }
  
  function sanitizeDraftArray(arr, expectedLength) {
    const defaultSlot = () => ({ champion: null, notes: '' })
    if (!Array.isArray(arr)) {
      return Array(expectedLength).fill(null).map(defaultSlot)
    }
    const sanitized = arr.map(item => ({
      champion: item?.champion || null,
      notes: item?.notes || ''
    }))
    while (sanitized.length < expectedLength) {
      sanitized.push(defaultSlot())
    }
    return sanitized.slice(0, expectedLength)
  }
  
  // Computed
  const filteredChampions = computed(() => {
    const championsStore = useChampionsStore()
    if (!championsStore.allChampions || championsStore.allChampions.length === 0) return []
    
    const normalizeString = (str) => str.toLowerCase().replace(/[^a-z0-9]/gi, '')
    let champs = [...championsStore.allChampions]
    
    if (draftCreatorRoleFilter.value !== 'all') {
      champs = champs.filter((c) => Array.isArray(c.roles) && c.roles.includes(draftCreatorRoleFilter.value))
    }
    
    if (draftCreatorSearchTerm.value.trim() !== '') {
      const normalizedSearch = normalizeString(draftCreatorSearchTerm.value.trim())
      champs = champs.filter((c) => normalizeString(c.name).includes(normalizedSearch))
    }
    
    return champs.sort((a, b) => a.name.localeCompare(b.name))
  })
  
  function isChampionPlacedInCurrentDraft(championName) {
    if (!championName) return false
    
    const allSlots = [
      ...currentDraft.value.bluePicks,
      ...currentDraft.value.blueBans,
      ...currentDraft.value.redPicks,
      ...currentDraft.value.redBans
    ]
    
    return allSlots.some(slot => slot.champion === championName)
  }
  
  function selectChampionForPlacement(championName) {
    if (selectedChampionForPlacement.value === championName) {
      selectedChampionForPlacement.value = null
    } else {
      selectedChampionForPlacement.value = championName
      selectedChampionSource.value = null
      selectedTargetSlot.value = null
    }
  }
  
  function setDraftCreatorRoleFilter(role) {
    if (draftCreatorRoleFilter.value === role) {
      draftCreatorRoleFilter.value = 'all'
    } else {
      draftCreatorRoleFilter.value = role
    }
  }
  
  function toggleNotesVisibility(side, type, index) {
    const notesStore = useNotesStore()
    const slotKey = `${side}${type.charAt(0).toUpperCase() + type.slice(1)}`
    const slot = currentDraft.value[slotKey]?.[index]
    
    if (!slot) return
    
    let noteSource = ''
    let title = 'Edit Notes'
    
    if (side === 'general') {
      noteSource = currentDraft.value.generalNotes || ''
      title = 'Edit General Draft Notes'
    } else {
      noteSource = slot.notes || ''
      const champName = slot.champion ? ` for ${slot.champion}` : ''
      const slotLabel = `${side.charAt(0).toUpperCase()}${type.charAt(0).toUpperCase()}${index + 1}`
      title = `Edit Notes${champName} (${slotLabel})`
    }
    
    notesStore.open({
      side: side === 'general' ? 'general' : side,
      type: side === 'general' ? null : type,
      index: side === 'general' ? null : index,
      currentNote: noteSource,
      title
    })
  }

  return {
    // State
    currentDraft,
    savedDrafts,
    isLoadingSavedDrafts,
    selectedChampionForPlacement,
    selectedChampionSource,
    selectedTargetSlot,
    draftCreatorSearchTerm,
    draftCreatorRoleFilter,
    // Computed
    filteredChampions,
    // Actions
    resetCurrentDraft,
    updateSlotNotes,
    updateGeneralNotes,
    handleSlotClick,
    clearCreatorSlot,
    saveCurrentDraft,
    refreshSavedDrafts,
    loadSavedDraft,
    deleteSavedDraft,
    isChampionPlacedInCurrentDraft,
    selectChampionForPlacement,
    setDraftCreatorRoleFilter,
    toggleNotesVisibility
  }
})


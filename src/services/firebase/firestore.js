// Firestore Service (v9+ modular API)
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { db } from './config'

// Constants
const DRAFT_TRACKER_DOC_ID = 'current_draft'
const SAVED_DRAFTS_COLLECTION = 'savedDrafts'

/**
 * Get workspace path helper
 */
function getWorkspacePath(workspaceId, ...path) {
  if (!workspaceId) {
    throw new Error('Workspace ID is required')
  }
  return `workspaces/${workspaceId}/${path.join('/')}`
}

/**
 * Fetch draft data from Firestore
 */
export async function fetchDraftDataFromFirestore(workspaceId) {
  const defaultData = {
    draftSeries: [],
    unavailablePanelState: {
      Top: Array(10).fill(null),
      Jungle: Array(10).fill(null),
      Mid: Array(10).fill(null),
      Bot: Array(10).fill(null),
      Support: Array(10).fill(null)
    },
    pickContext: [],
    bannedChampions: []
  }

  if (!workspaceId) {
    console.warn('No workspace ID provided. Returning default data.')
    return defaultData
  }

  try {
    const workspaceRef = doc(db, 'workspaces', workspaceId)
    const draftRef = doc(workspaceRef, 'drafts', DRAFT_TRACKER_DOC_ID)
    const docSnap = await getDoc(draftRef)

    if (docSnap.exists()) {
      const data = docSnap.data()
      return {
        draftSeries: Array.isArray(data.draftSeries) ? data.draftSeries : defaultData.draftSeries,
        unavailablePanelState: data.unavailablePanelState || defaultData.unavailablePanelState,
        pickContext: Array.isArray(data.pickContext) ? data.pickContext : defaultData.pickContext,
        bannedChampions: Array.isArray(data.bannedChampions) ? data.bannedChampions : defaultData.bannedChampions
      }
    } else {
      console.log('No draft data found in Firestore, using defaults.')
      return defaultData
    }
  } catch (error) {
    console.error('Error fetching draft data:', error)
    return defaultData
  }
}

/**
 * Save draft data to Firestore
 */
export async function saveDraftDataToFirestore(workspaceId, draftData) {
  if (!workspaceId) {
    throw new Error('Workspace ID is required')
  }

  try {
    const workspaceRef = doc(db, 'workspaces', workspaceId)
    const draftRef = doc(workspaceRef, 'drafts', DRAFT_TRACKER_DOC_ID)
    
    const dataToSave = {
      draftSeries: Array.isArray(draftData.draftSeries) ? draftData.draftSeries : [],
      unavailablePanelState: draftData.unavailablePanelState || {},
      pickContext: Array.isArray(draftData.pickContext) ? draftData.pickContext : [],
      bannedChampions: Array.isArray(draftData.bannedChampions) ? draftData.bannedChampions : []
    }

    await setDoc(draftRef, dataToSave)
    console.log('Draft data saved successfully.')
  } catch (error) {
    console.error('Error saving draft data:', error)
    throw error
  }
}

/**
 * Set up real-time listener for draft data
 */
export function setupDraftRealtimeSync(workspaceId, callback) {
  if (!workspaceId) {
    console.warn('No workspace ID provided for real-time sync')
    return () => {}
  }

  try {
    const workspaceRef = doc(db, 'workspaces', workspaceId)
    const draftRef = doc(workspaceRef, 'drafts', DRAFT_TRACKER_DOC_ID)

    const unsubscribe = onSnapshot(
      draftRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data()
          callback({
            draftSeries: data.draftSeries || [],
            unavailablePanelState: data.unavailablePanelState || {
              Top: Array(10).fill(null),
              Jungle: Array(10).fill(null),
              Mid: Array(10).fill(null),
              Bot: Array(10).fill(null),
              Support: Array(10).fill(null)
            },
            pickContext: data.pickContext || [],
            bannedChampions: data.bannedChampions || []
          })
        } else {
          callback({
            draftSeries: [],
            unavailablePanelState: {
              Top: Array(10).fill(null),
              Jungle: Array(10).fill(null),
              Mid: Array(10).fill(null),
              Bot: Array(10).fill(null),
              Support: Array(10).fill(null)
            },
            pickContext: [],
            bannedChampions: []
          })
        }
      },
      (error) => {
        console.error('Error listening to draft updates:', error)
      }
    )

    return unsubscribe
  } catch (error) {
    console.error('Error setting up real-time sync:', error)
    return () => {}
  }
}

/**
 * Save draft to creator collection
 */
export async function saveDraftToCreatorCollection(workspaceId, draftObject) {
  if (!workspaceId) {
    throw new Error('Workspace ID is required')
  }

  try {
    const workspaceRef = doc(db, 'workspaces', workspaceId)
    const savedDraftsRef = collection(workspaceRef, SAVED_DRAFTS_COLLECTION)

    const dataToSave = {
      ...draftObject,
      createdAt: serverTimestamp(),
      name: draftObject.name || 'Unnamed Draft'
    }
    delete dataToSave.id

    let docRef
    if (draftObject.id) {
      docRef = doc(savedDraftsRef, draftObject.id)
      await setDoc(docRef, dataToSave, { merge: true })
    } else {
      docRef = doc(savedDraftsRef)
      await setDoc(docRef, dataToSave)
    }

    const savedDoc = await getDoc(docRef)
    return { id: docRef.id, ...savedDoc.data() }
  } catch (error) {
    console.error('Error saving draft to creator collection:', error)
    throw error
  }
}

/**
 * Fetch saved drafts from Firestore
 */
export async function fetchSavedDraftsFromFirestore(workspaceId) {
  if (!workspaceId) {
    console.warn('No workspace ID provided. Returning empty array.')
    return []
  }

  const drafts = []
  try {
    const workspaceRef = doc(db, 'workspaces', workspaceId)
    const savedDraftsRef = collection(workspaceRef, SAVED_DRAFTS_COLLECTION)
    const q = query(savedDraftsRef, orderBy('createdAt', 'desc'))
    const querySnapshot = await getDocs(q)

    querySnapshot.forEach((docSnap) => {
      drafts.push({ id: docSnap.id, ...docSnap.data() })
    })

    return drafts
  } catch (error) {
    console.error('Error fetching saved drafts:', error)
    return []
  }
}

/**
 * Load specific draft from Firestore
 */
export async function loadSpecificDraftFromFirestore(draftId, workspaceId) {
  if (!draftId || !workspaceId) {
    console.error('Draft ID and workspace ID are required.')
    return null
  }

  try {
    const workspaceRef = doc(db, 'workspaces', workspaceId)
    const savedDraftsRef = collection(workspaceRef, SAVED_DRAFTS_COLLECTION)
    const draftRef = doc(savedDraftsRef, draftId)
    const docSnap = await getDoc(draftRef)

    if (docSnap.exists()) {
      return docSnap.data()
    } else {
      return null
    }
  } catch (error) {
    console.error(`Error loading draft ${draftId}:`, error)
    return null
  }
}

/**
 * Delete draft from creator collection
 */
export async function deleteDraftFromCreatorCollection(draftId, workspaceId) {
  if (!draftId || !workspaceId) {
    throw new Error('Draft ID and workspace ID are required.')
  }

  try {
    const workspaceRef = doc(db, 'workspaces', workspaceId)
    const savedDraftsRef = collection(workspaceRef, SAVED_DRAFTS_COLLECTION)
    const draftRef = doc(savedDraftsRef, draftId)
    await deleteDoc(draftRef)
  } catch (error) {
    console.error(`Error deleting draft ${draftId}:`, error)
    throw error
  }
}

// ========== SERIES FUNCTIONS ==========

/**
 * Create a new series in Firestore
 */
export async function createSeriesInFirestore(workspaceId, seriesData) {
  if (!workspaceId) {
    throw new Error('Workspace ID is required')
  }

  try {
    const seriesRef = collection(db, 'workspaces', workspaceId, 'series')
    const docRef = doc(seriesRef)
    
    // Convert Date objects to Timestamp for nested objects
    const processedData = {
      ...seriesData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      games: seriesData.games?.map(game => ({
        ...game,
        createdAt: game.createdAt instanceof Date ? Timestamp.fromDate(game.createdAt) : game.createdAt,
        drafts: game.drafts?.map(draft => ({
          ...draft,
          createdAt: draft.createdAt instanceof Date ? Timestamp.fromDate(draft.createdAt) : draft.createdAt,
          updatedAt: draft.updatedAt instanceof Date ? Timestamp.fromDate(draft.updatedAt) : draft.updatedAt
        })) || []
      })) || []
    }
    
    await setDoc(docRef, processedData)
    return { id: docRef.id, ...seriesData }
  } catch (error) {
    console.error('Error creating series:', error)
    throw error
  }
}

/**
 * Save series to Firestore
 */
export async function saveSeriesToFirestore(workspaceId, seriesId, seriesData) {
  if (!workspaceId || !seriesId) {
    throw new Error('Workspace ID and Series ID are required')
  }

  try {
    const seriesRef = doc(db, 'workspaces', workspaceId, 'series', seriesId)
    
    // Firestore automatically converts Date objects to Timestamp
    const dataToSave = {
      ...seriesData,
      updatedAt: serverTimestamp()
    }
    
    await updateDoc(seriesRef, dataToSave)
    return { id: seriesId, ...seriesData }
  } catch (error) {
    console.error('Error saving series:', error)
    throw error
  }
}

/**
 * Load series from Firestore
 */
export async function loadSeriesFromFirestore(workspaceId, seriesId) {
  if (!workspaceId || !seriesId) {
    throw new Error('Workspace ID and Series ID are required')
  }

  try {
    const seriesRef = doc(db, 'workspaces', workspaceId, 'series', seriesId)
    const docSnap = await getDoc(seriesRef)

    if (docSnap.exists()) {
      const data = docSnap.data()
      // Convert Timestamps to Dates
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
        games: data.games?.map(game => ({
          ...game,
          createdAt: game.createdAt?.toDate ? game.createdAt.toDate() : game.createdAt,
          drafts: game.drafts?.map(draft => ({
            ...draft,
            createdAt: draft.createdAt?.toDate ? draft.createdAt.toDate() : draft.createdAt,
            updatedAt: draft.updatedAt?.toDate ? draft.updatedAt.toDate() : draft.updatedAt
          })) || []
        })) || []
      }
    } else {
      return null
    }
  } catch (error) {
    console.error('Error loading series:', error)
    throw error
  }
}

/**
 * Get all series for a workspace
 */
export async function getAllSeriesForWorkspace(workspaceId) {
  if (!workspaceId) {
    console.warn('No workspace ID provided. Returning empty array.')
    return []
  }

  try {
    const seriesRef = collection(db, 'workspaces', workspaceId, 'series')
    const q = query(seriesRef, orderBy('updatedAt', 'desc'))
    const querySnapshot = await getDocs(q)

    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
      }
    })
  } catch (error) {
    console.error('Error fetching series:', error)
    return []
  }
}

/**
 * Delete series from Firestore
 */
export async function deleteSeriesFromFirestore(workspaceId, seriesId) {
  if (!workspaceId || !seriesId) {
    throw new Error('Workspace ID and Series ID are required')
  }

  try {
    const seriesRef = doc(db, 'workspaces', workspaceId, 'series', seriesId)
    await deleteDoc(seriesRef)
  } catch (error) {
    console.error('Error deleting series:', error)
    throw error
  }
}

/**
 * Set up real-time sync for series
 */
export function setupSeriesRealtimeSync(workspaceId, seriesId, callback) {
  if (!workspaceId || !seriesId) {
    console.warn('Workspace ID and Series ID are required for real-time sync')
    return () => {}
  }

  try {
    const seriesRef = doc(db, 'workspaces', workspaceId, 'series', seriesId)

    const unsubscribe = onSnapshot(
      seriesRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data()
          const processedData = {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
            games: data.games?.map(game => ({
              ...game,
              createdAt: game.createdAt?.toDate ? game.createdAt.toDate() : game.createdAt,
              drafts: game.drafts?.map(draft => ({
                ...draft,
                createdAt: draft.createdAt?.toDate ? draft.createdAt.toDate() : draft.createdAt,
                updatedAt: draft.updatedAt?.toDate ? draft.updatedAt.toDate() : draft.updatedAt
              })) || []
            })) || []
          }
          callback(processedData)
        } else {
          callback(null)
        }
      },
      (error) => {
        console.error('Error listening to series updates:', error)
      }
    )

    return unsubscribe
  } catch (error) {
    console.error('Error setting up series real-time sync:', error)
    return () => {}
  }
}

// ========== NOTES FUNCTIONS ==========

/**
 * Save slot note
 */
export async function saveSlotNote(workspaceId, seriesId, noteData) {
  if (!workspaceId || !seriesId) {
    throw new Error('Workspace ID and Series ID are required')
  }

  try {
    const notesRef = collection(db, 'workspaces', workspaceId, 'series', seriesId, 'notes')
    
    // Check if note exists - need separate queries for null and non-null gameId
    let querySnapshot
    if (noteData.gameId) {
      const q = query(
        notesRef,
        where('type', '==', 'slot'),
        where('side', '==', noteData.side),
        where('slotType', '==', noteData.type),
        where('index', '==', noteData.index),
        where('gameId', '==', noteData.gameId)
      )
      querySnapshot = await getDocs(q)
    } else {
      // For null gameId, we need to get all matching notes and filter
      const q = query(
        notesRef,
        where('type', '==', 'slot'),
        where('side', '==', noteData.side),
        where('slotType', '==', noteData.type),
        where('index', '==', noteData.index)
      )
      const allDocs = await getDocs(q)
      const matchingDocs = []
      allDocs.forEach(doc => {
        const data = doc.data()
        if (!data.gameId) {
          matchingDocs.push(doc)
        }
      })
      querySnapshot = {
        empty: matchingDocs.length === 0,
        docs: matchingDocs
      }
    }
    
    if (querySnapshot.empty || querySnapshot.docs.length === 0) {
      // Create new note
      const newNote = {
        type: 'slot',
        side: noteData.side,
        slotType: noteData.type,
        index: noteData.index,
        gameId: noteData.gameId || null,
        scope: noteData.gameId ? 'local' : 'global',
        notes: noteData.notes || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
      const docRef = doc(notesRef)
      await setDoc(docRef, newNote)
      return { id: docRef.id, ...newNote }
    } else {
      // Update existing note
      const existingDoc = querySnapshot.docs[0]
      await updateDoc(existingDoc.ref, {
        notes: noteData.notes || '',
        updatedAt: serverTimestamp()
      })
      const existingData = existingDoc.data()
      return { 
        id: existingDoc.id, 
        ...existingData, 
        notes: noteData.notes || '',
        createdAt: existingData.createdAt?.toDate ? existingData.createdAt.toDate() : existingData.createdAt,
        updatedAt: existingData.updatedAt?.toDate ? existingData.updatedAt.toDate() : existingData.updatedAt
      }
    }
  } catch (error) {
    console.error('Error saving slot note:', error)
    throw error
  }
}

/**
 * Save champion note
 */
export async function saveChampionNote(workspaceId, seriesId, noteData) {
  if (!workspaceId || !seriesId) {
    throw new Error('Workspace ID and Series ID are required')
  }

  try {
    const notesRef = collection(db, 'workspaces', workspaceId, 'series', seriesId, 'notes')
    
    // Check if note exists - need separate queries for null and non-null gameId
    let querySnapshot
    if (noteData.gameId) {
      const q = query(
        notesRef,
        where('type', '==', 'champion'),
        where('championName', '==', noteData.championName),
        where('gameId', '==', noteData.gameId)
      )
      querySnapshot = await getDocs(q)
    } else {
      // For null gameId, we need to get all matching notes and filter
      const q = query(
        notesRef,
        where('type', '==', 'champion'),
        where('championName', '==', noteData.championName)
      )
      const allDocs = await getDocs(q)
      const matchingDocs = []
      allDocs.forEach(doc => {
        const data = doc.data()
        if (!data.gameId) {
          matchingDocs.push(doc)
        }
      })
      querySnapshot = {
        empty: matchingDocs.length === 0,
        docs: matchingDocs
      }
    }
    
    if (querySnapshot.empty || querySnapshot.docs.length === 0) {
      // Create new note
      const newNote = {
        type: 'champion',
        championName: noteData.championName,
        gameId: noteData.gameId || null,
        scope: noteData.gameId ? 'local' : 'global',
        notes: noteData.notes || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
      const docRef = doc(notesRef)
      await setDoc(docRef, newNote)
      return { id: docRef.id, ...newNote }
    } else {
      // Update existing note
      const existingDoc = querySnapshot.docs[0]
      await updateDoc(existingDoc.ref, {
        notes: noteData.notes || '',
        updatedAt: serverTimestamp()
      })
      const existingData = existingDoc.data()
      return { 
        id: existingDoc.id, 
        ...existingData, 
        notes: noteData.notes || '',
        createdAt: existingData.createdAt?.toDate ? existingData.createdAt.toDate() : existingData.createdAt,
        updatedAt: existingData.updatedAt?.toDate ? existingData.updatedAt.toDate() : existingData.updatedAt
      }
    }
  } catch (error) {
    console.error('Error saving champion note:', error)
    throw error
  }
}

/**
 * Get all notes for a series
 */
export async function getNotesForSeries(workspaceId, seriesId) {
  if (!workspaceId || !seriesId) {
    return { slotNotes: [], championNotes: [] }
  }

  try {
    const notesRef = collection(db, 'workspaces', workspaceId, 'series', seriesId, 'notes')
    const querySnapshot = await getDocs(notesRef)

    const slotNotes = []
    const championNotes = []

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data()
      const note = {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
      }

      if (data.type === 'slot') {
        slotNotes.push(note)
      } else if (data.type === 'champion') {
        championNotes.push(note)
      }
    })

    return { slotNotes, championNotes }
  } catch (error) {
    console.error('Error fetching notes:', error)
    return { slotNotes: [], championNotes: [] }
  }
}

/**
 * Delete note
 */
export async function deleteNote(workspaceId, seriesId, noteId) {
  if (!workspaceId || !seriesId || !noteId) {
    throw new Error('Workspace ID, Series ID, and Note ID are required')
  }

  try {
    const noteRef = doc(db, 'workspaces', workspaceId, 'series', seriesId, 'notes', noteId)
    await deleteDoc(noteRef)
  } catch (error) {
    console.error('Error deleting note:', error)
    throw error
  }
}

/**
 * Set up real-time sync for notes
 */
export function setupNotesRealtimeSync(workspaceId, seriesId, callback) {
  if (!workspaceId || !seriesId) {
    console.warn('Workspace ID and Series ID are required for notes real-time sync')
    return () => {}
  }

  try {
    const notesRef = collection(db, 'workspaces', workspaceId, 'series', seriesId, 'notes')

    const unsubscribe = onSnapshot(
      notesRef,
      (querySnapshot) => {
        const slotNotes = []
        const championNotes = []

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data()
          const note = {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
          }

          if (data.type === 'slot') {
            slotNotes.push(note)
          } else if (data.type === 'champion') {
            championNotes.push(note)
          }
        })

        callback({ slotNotes, championNotes })
      },
      (error) => {
        console.error('Error listening to notes updates:', error)
      }
    )

    return unsubscribe
  } catch (error) {
    console.error('Error setting up notes real-time sync:', error)
    return () => {}
  }
}



// ========== LCU DRAFTS FUNCTIONS ==========

/**
 * Fetch all LCU drafts from Firestore
 */
export async function fetchLcuDraftsFromFirestore(workspaceId) {
  if (!workspaceId) {
    console.warn('No workspace ID provided. Returning empty array.')
    return []
  }

  try {
    const workspaceRef = doc(db, 'workspaces', workspaceId)
    const lcuDraftsRef = collection(workspaceRef, 'lcuDrafts')
    const q = query(lcuDraftsRef, orderBy('updatedAt', 'desc'))
    const querySnapshot = await getDocs(q)

    const drafts = []
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data()
      drafts.push({
        id: docSnap.id,
        lobbyId: data.lobbyId || null,
        phase: data.phase || 'UNKNOWN',
        blueSide: data.blueSide || { picks: [], bans: [], picksOrdered: [], bansOrdered: [] },
        redSide: data.redSide || { picks: [], bans: [], picksOrdered: [], bansOrdered: [] },
        isNewGame: data.isNewGame || false,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
      })
    })

    return drafts
  } catch (error) {
    console.error('Error fetching LCU drafts:', error)
    return []
  }
}

/**
 * Delete all LCU drafts from Firestore
 */
export async function deleteAllLcuDrafts(workspaceId) {
  if (!workspaceId) {
    throw new Error('Workspace ID is required')
  }

  try {
    const workspaceRef = doc(db, 'workspaces', workspaceId)
    const lcuDraftsRef = collection(workspaceRef, 'lcuDrafts')
    const querySnapshot = await getDocs(lcuDraftsRef)

    // Delete all lcuDrafts documents
    const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(docSnap.ref))
    await Promise.all(deletePromises)
    
    return true
  } catch (error) {
    console.error('Error deleting LCU drafts:', error)
    throw error
  }
}

/**
 * Set up real-time listener for LCU drafts
 */
export function setupLcuDraftsRealtimeSync(workspaceId, callback) {
  if (!workspaceId) {
    console.warn('No workspace ID provided for LCU drafts real-time sync')
    return () => {}
  }

  try {
    const workspaceRef = doc(db, 'workspaces', workspaceId)
    const lcuDraftsRef = collection(workspaceRef, 'lcuDrafts')
    const q = query(lcuDraftsRef, orderBy('updatedAt', 'desc'))

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const drafts = []
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data()
          drafts.push({
            id: docSnap.id,
            lobbyId: data.lobbyId || null,
            phase: data.phase || 'UNKNOWN',
            blueSide: data.blueSide || { picks: [], bans: [], picksOrdered: [], bansOrdered: [] },
            redSide: data.redSide || { picks: [], bans: [], picksOrdered: [], bansOrdered: [] },
            isNewGame: data.isNewGame || false,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
          })
        })
        callback(drafts)
      },
      (error) => {
        console.error('Error listening to LCU draft updates:', error)
      }
    )

    return unsubscribe
  } catch (error) {
    console.error('Error setting up LCU drafts real-time sync:', error)
    return () => {}
  }
}

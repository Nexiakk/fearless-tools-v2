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
        highlightedChampions: typeof data.highlightedChampions === 'object' && 
          data.highlightedChampions !== null && 
          !Array.isArray(data.highlightedChampions) 
          ? data.highlightedChampions 
          : defaultData.highlightedChampions,
        unavailablePanelState: data.unavailablePanelState || defaultData.unavailablePanelState,
        pickContext: Array.isArray(data.pickContext) ? data.pickContext : defaultData.pickContext
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
      highlightedChampions: typeof draftData.highlightedChampions === 'object' && 
        draftData.highlightedChampions !== null && 
        !Array.isArray(draftData.highlightedChampions) 
        ? draftData.highlightedChampions 
        : {},
      draftSeries: Array.isArray(draftData.draftSeries) ? draftData.draftSeries : [],
      unavailablePanelState: draftData.unavailablePanelState || {},
      pickContext: Array.isArray(draftData.pickContext) ? draftData.pickContext : []
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
            highlightedChampions: data.highlightedChampions || {},
            unavailablePanelState: data.unavailablePanelState || {
              Top: Array(10).fill(null),
              Jungle: Array(10).fill(null),
              Mid: Array(10).fill(null),
              Bot: Array(10).fill(null),
              Support: Array(10).fill(null)
            },
            pickContext: data.pickContext || []
          })
        } else {
          callback({
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


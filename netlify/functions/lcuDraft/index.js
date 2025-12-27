// LCU Draft Data Handler
// Receives draft data from LCU client and stores it in Firestore
// Uses lobbyId as unique identifier to prevent duplicates

let admin = null
let db = null

// Try to initialize Firebase Admin (optional - will work without it for testing)
try {
  admin = require('firebase-admin')
  
  // Initialize Firebase Admin if not already initialized
  if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    
    if (privateKey && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: privateKey,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        })
      })
      db = admin.firestore()
      console.log('[LCU Draft] Firebase Admin initialized')
    } else {
      console.warn('[LCU Draft] Firebase Admin credentials not found - function will work in test mode only')
    }
  } else {
    db = admin.firestore()
  }
} catch (error) {
  console.warn('[LCU Draft] Firebase Admin not available:', error.message)
  console.warn('[LCU Draft] Function will work in test mode (logging only)')
}

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    }
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const draftData = JSON.parse(event.body)
    
    // Validate required fields
    if (!draftData.lobbyId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'lobbyId is required' })
      }
    }

    if (!draftData.workspaceId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'workspaceId is required' })
      }
    }

    // Validate workspace exists (if database is available)
    if (db) {
      const workspaceRef = db.collection('workspaces').doc(draftData.workspaceId)
      const metadataRef = workspaceRef.collection('metadata').doc('info')
      const metadataDoc = await metadataRef.get()
      
      if (!metadataDoc.exists()) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Workspace not found' })
        }
      }
    }

    // Handle delete request (champion select cancelled)
    if (draftData.action === 'delete') {
      const { lobbyId, workspaceId } = draftData
      
      if (!workspaceId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'workspaceId is required for delete' })
        }
      }
      
      if (db) {
        const draftRef = db.collection('workspaces')
          .doc(String(workspaceId))
          .collection('lcuDrafts')
          .doc(String(lobbyId))
        await draftRef.delete()
        console.log(`[LCU Draft] Deleted draft for lobby ${lobbyId} (champion select cancelled)`)
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            lobbyId: String(lobbyId),
            message: 'Draft deleted (champion select cancelled)'
          })
        }
      } else {
        console.log(`[LCU Draft] Test mode - would delete draft for lobby ${lobbyId}`)
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            lobbyId: String(lobbyId),
            message: 'Delete request received (test mode)'
          })
        }
      }
    }

    const { lobbyId, workspaceId, phase, blue_side, red_side } = draftData

    // Prepare data for Firestore
    // Structure: workspaces/{workspaceId}/lcuDrafts/{lobbyId}
    const draftDoc = {
      lobbyId: String(lobbyId),
      phase: phase || 'UNKNOWN',
      blueSide: {
        picks: blue_side?.picks || [],
        bans: blue_side?.bans || [],
        picksOrdered: blue_side?.picks_ordered || [],
        bansOrdered: blue_side?.bans_ordered || []
      },
      redSide: {
        picks: red_side?.picks || [],
        bans: red_side?.bans || [],
        picksOrdered: red_side?.picks_ordered || [],
        bansOrdered: red_side?.bans_ordered || []
      },
      // Use isNewGame flag from client (more reliable than phase check)
      // Client detects CREATE events and phase changes
      isNewGame: draftData.isNewGame === true
    }

    // Save to Firestore if available, otherwise just log
    let docExists = false
    if (db) {
      draftDoc.updatedAt = admin.firestore.FieldValue.serverTimestamp()
      
      // Use workspace-scoped path: workspaces/{workspaceId}/lcuDrafts/{lobbyId}
      // This prevents duplicates when multiple clients send data for the same lobby
      const draftRef = db.collection('workspaces')
        .doc(String(workspaceId))
        .collection('lcuDrafts')
        .doc(String(lobbyId))

      // Check if document exists
      const docSnapshot = await draftRef.get()
      docExists = docSnapshot.exists

      if (docSnapshot.exists && draftDoc.isNewGame) {
        // New game detected - overwrite existing data
        await draftRef.set({
          ...draftDoc,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: false }) // Overwrite completely
        
        console.log(`[LCU Draft] New game detected for lobby ${lobbyId} - overwrote existing data`)
      } else {
        // Update existing or create new
        await draftRef.set(draftDoc, { merge: true })
        
        if (docSnapshot.exists) {
          console.log(`[LCU Draft] Updated draft for lobby ${lobbyId}`)
        } else {
          draftDoc.createdAt = admin.firestore.FieldValue.serverTimestamp()
          await draftRef.set(draftDoc, { merge: true })
          console.log(`[LCU Draft] Created new draft for lobby ${lobbyId}`)
        }
      }
    } else {
      // Test mode - just log the data
      console.log(`[LCU Draft] Test mode - received data for lobby ${lobbyId}:`, JSON.stringify(draftDoc, null, 2))
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        lobbyId: String(lobbyId),
        message: docExists ? 'Draft updated' : 'Draft created',
        mode: db ? 'production' : 'test'
      })
    }
  } catch (error) {
    console.error('[LCU Draft] Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to save draft data',
        message: error.message
      })
    }
  }
}

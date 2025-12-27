// Workspace Authentication Handler
// Validates workspace ID and password for LCU client

let admin = null
let db = null

// Try to initialize Firebase Admin
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
      console.log('[Authenticate Workspace] Firebase Admin initialized')
    } else {
      console.warn('[Authenticate Workspace] Firebase Admin credentials not found')
    }
  } else {
    db = admin.firestore()
  }
} catch (error) {
  console.error('[Authenticate Workspace] Firebase Admin initialization error:', error)
}

const crypto = require('crypto')

// Hash password using SHA-256 (same as web app)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
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
    // Parse request body
    let requestData
    try {
      requestData = JSON.parse(event.body || '{}')
    } catch (parseError) {
      console.error('[Authenticate Workspace] JSON parse error:', parseError)
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid JSON in request body' 
        })
      }
    }
    
    const { workspaceId, password } = requestData
    
    // Validate required fields
    if (!workspaceId || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'workspaceId and password are required' 
        })
      }
    }

    if (!db || !admin) {
      console.error('[Authenticate Workspace] Database not available - Firebase Admin not initialized')
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Database not available. Please check server configuration.' 
        })
      }
    }

    // Get workspace metadata
    const workspaceRef = db.collection('workspaces').doc(workspaceId)
    const metadataRef = workspaceRef.collection('metadata').doc('info')
    const metadataDoc = await metadataRef.get()

    if (!metadataDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Workspace not found' 
        })
      }
    }

    const metadata = metadataDoc.data()
    const passwordHash = hashPassword(password)

    // Compare password hashes
    if (metadata.passwordHash !== passwordHash) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Incorrect password' 
        })
      }
    }

    // Authentication successful
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        workspaceId: workspaceId,
        workspaceName: metadata.name || workspaceId
      })
    }
  } catch (error) {
    console.error('[Authenticate Workspace] Error:', error)
    console.error('[Authenticate Workspace] Error stack:', error.stack)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to authenticate workspace',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    }
  }
}

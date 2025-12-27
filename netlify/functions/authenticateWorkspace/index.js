// Workspace Authentication Handler
// Validates workspace ID and password for LCU client

const admin = require('firebase-admin')

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    
    if (privateKey && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: privateKey,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        })
      })
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error)
  }
}

const db = admin.firestore()
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
    const { workspaceId, password } = JSON.parse(event.body)
    
    // Validate required fields
    if (!workspaceId || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'workspaceId and password are required' })
      }
    }

    if (!db) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Database not available' })
      }
    }

    // Get workspace metadata
    const workspaceRef = db.collection('workspaces').doc(workspaceId)
    const metadataRef = workspaceRef.collection('metadata').doc('info')
    const metadataDoc = await metadataRef.get()

    if (!metadataDoc.exists()) {
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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to authenticate workspace',
        message: error.message
      })
    }
  }
}

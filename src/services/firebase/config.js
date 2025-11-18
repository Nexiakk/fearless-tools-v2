// Firebase configuration
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

// Firebase config from existing firebase-init.js
const firebaseConfig = {
  apiKey: "AIzaSyA8Sn1xWu628UB1MUABfvohYLzuchWVX18",
  authDomain: "fearless-tools.firebaseapp.com",
  projectId: "fearless-tools",
  storageBucket: "fearless-tools.appspot.com",
  messagingSenderId: "830913150506",
  appId: "1:830913150506:web:6d6986862e404bc8ae0d53",
  measurementId: "G-6Z91GFX42Q"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize services
export const db = getFirestore(app)
export const auth = getAuth(app)

export default app


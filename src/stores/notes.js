import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNotesStore = defineStore('notes', () => {
  // State
  const isOpen = ref(false)
  const side = ref(null) // 'blue', 'red', or 'general'
  const type = ref(null) // 'bans', 'picks', or null for general
  const index = ref(null) // index in the array
  const currentNote = ref('')
  const title = ref('')
  
  // Actions
  function open({ side: s, type: t, index: i, currentNote: note, title: tit }) {
    side.value = s
    type.value = t
    index.value = i
    currentNote.value = note || ''
    title.value = tit || 'Edit Notes'
    isOpen.value = true
  }
  
  function close() {
    isOpen.value = false
    setTimeout(() => {
      side.value = null
      type.value = null
      index.value = null
      currentNote.value = ''
      title.value = ''
    }, 200)
  }
  
  function updateNote(note) {
    currentNote.value = note
  }
  
  return {
    // State
    isOpen,
    side,
    type,
    index,
    currentNote,
    title,
    // Actions
    open,
    close,
    updateNote
  }
})


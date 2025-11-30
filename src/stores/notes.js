import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNotesStore = defineStore('notes', () => {
  // State
  const isOpen = ref(false)
  const noteType = ref(null) // 'slot', 'champion', or 'general'
  const side = ref(null) // 'blue', 'red', or 'general'
  const type = ref(null) // 'bans', 'picks', or null for general
  const index = ref(null) // index in the array (for slot notes)
  const championName = ref(null) // for champion-based notes
  const currentNote = ref('')
  const title = ref('')
  const scope = ref('local') // 'global' or 'local' (local = current game only)
  
  // Actions
  function open({ 
    noteType: nt = 'slot', 
    side: s, 
    type: t, 
    index: i, 
    championName: cn = null,
    currentNote: note, 
    title: tit,
    scope: sc = 'local'
  }) {
    noteType.value = nt
    side.value = s
    type.value = t
    index.value = i
    championName.value = cn
    currentNote.value = note || ''
    title.value = tit || 'Edit Notes'
    scope.value = sc
    isOpen.value = true
  }
  
  function close() {
    isOpen.value = false
    setTimeout(() => {
      noteType.value = null
      side.value = null
      type.value = null
      index.value = null
      championName.value = null
      currentNote.value = ''
      title.value = ''
      scope.value = 'local'
    }, 200)
  }
  
  function updateNote(note) {
    currentNote.value = note
  }
  
  function setScope(newScope) {
    scope.value = newScope
  }
  
  return {
    // State
    isOpen,
    noteType,
    side,
    type,
    index,
    championName,
    currentNote,
    title,
    scope,
    // Actions
    open,
    close,
    updateNote,
    setScope
  }
})


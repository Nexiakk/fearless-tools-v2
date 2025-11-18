import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useConfirmationStore = defineStore('confirmation', () => {
  // State
  const isOpen = ref(false)
  const message = ref('')
  const confirmAction = ref(null)
  const isDanger = ref(false)
  
  // Actions
  function open({ message: msg, confirmAction: action, isDanger: danger = false }) {
    message.value = msg
    confirmAction.value = action
    isDanger.value = danger
    isOpen.value = true
  }
  
  function close() {
    isOpen.value = false
    setTimeout(() => {
      message.value = ''
      confirmAction.value = null
      isDanger.value = false
    }, 200)
  }
  
  function confirm() {
    if (typeof confirmAction.value === 'function') {
      confirmAction.value()
    }
    close()
  }
  
  return {
    // State
    isOpen,
    message,
    confirmAction,
    isDanger,
    // Actions
    open,
    close,
    confirm
  }
})


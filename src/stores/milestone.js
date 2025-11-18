import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMilestoneStore = defineStore('milestone', () => {
  // State
  const isOpen = ref(false)
  const selectedChampionFromPanel = ref(null)
  
  // Actions
  function open() {
    isOpen.value = true
  }
  
  function close() {
    isOpen.value = false
    selectedChampionFromPanel.value = null
  }
  
  function setSelectedChampion(role, index) {
    selectedChampionFromPanel.value = { role, index }
  }
  
  return {
    // State
    isOpen,
    selectedChampionFromPanel,
    // Actions
    open,
    close,
    setSelectedChampion
  }
})


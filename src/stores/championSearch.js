import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * Store for champion search functionality
 * Manages search query state globally
 */
export const useChampionSearchStore = defineStore('championSearch', () => {
  const searchQuery = ref('')

  /**
   * Normalize string by removing special characters and converting to lowercase
   */
  const normalizeString = (str) => {
    return str.toLowerCase().replace(/[^a-z0-9]/gi, '')
  }

  /**
   * Check if a champion name matches the search query
   * Case-insensitive, matches anywhere in the name, ignores special characters
   */
  const matchesSearch = (championName) => {
    if (!searchQuery.value.trim()) {
      return true // No search query means all champions match
    }
    const normalizedQuery = normalizeString(searchQuery.value.trim())
    const normalizedName = normalizeString(championName)
    return normalizedName.includes(normalizedQuery)
  }

  /**
   * Clear the search query
   */
  const clearSearch = () => {
    searchQuery.value = ''
  }

  /**
   * Check if search is active (has non-empty query)
   */
  const isSearchActive = computed(() => {
    return searchQuery.value.trim().length > 0
  })

  return {
    searchQuery,
    matchesSearch,
    clearSearch,
    isSearchActive
  }
})


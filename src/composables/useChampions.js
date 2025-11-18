// Champions Composable
import { computed } from 'vue'
import { useChampionsStore } from '@/stores/champions'
import { fetchChampionDataFromFirestore } from '@/services/firebase/championData'

export function useChampions() {
  const store = useChampionsStore()

  const loadChampions = async () => {
    store.setLoading(true)
    try {
      const data = await fetchChampionDataFromFirestore('global')
      if (data && data.allChampions) {
        store.setChampions(data.allChampions)
        store.setOpTierChampions(data.opTierChampions || {})
        if (data.version) {
          // Version is already a timestamp
        }
      }
    } catch (error) {
      console.error('Error loading champions:', error)
      throw error
    } finally {
      store.setLoading(false)
    }
  }

  return {
    // State
    allChampions: computed(() => store.allChampions),
    opTierChampions: computed(() => store.opTierChampions),
    isLoading: computed(() => store.isLoading),
    patchVersion: computed(() => store.patchVersion),
    championsByRole: computed(() => store.championsByRole),
    // Actions
    loadChampions,
    getChampionIconUrl: store.getChampionIconUrl,
    getRoleIconUrl: store.getRoleIconUrl,
    isOpForRole: store.isOpForRole
  }
}


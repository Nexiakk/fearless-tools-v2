import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/services/firebase/config'
import { riotApiService } from '@/services/riotApi'

export const useChampionStatsModalStore = defineStore('championStatsModal', () => {
  // State
  const isOpen = ref(false)
  const champion = ref(null)
  const detailedData = ref(null)
  const isLoading = ref(false)
  const error = ref(null)

  // Getters
  const championIconUrl = computed(() => {
    if (!champion.value) return ''
    // Use Riot API service to get icon URL
    return riotApiService.getChampionIconUrl(champion.value.imageName, '15.24.1') // Use current patch
  })

  const abilities = computed(() => {
    return detailedData.value?.abilities || []
  })

  const passiveAbility = computed(() => {
    const abilitiesList = abilities.value || []
    return abilitiesList.find(ability => ability.type === 'Passive')
  })

  const activeAbilities = computed(() => {
    const abilitiesList = abilities.value || []
    return abilitiesList.filter(ability => ability.type !== 'Passive')
  })

  const counters = computed(() => {
    // Extract counters from build data if available
    const roles = detailedData.value?.roles || {}
    const countersData = []

    // Look through roles for counter information
    Object.entries(roles).forEach(([role, roleData]) => {
      if (roleData && roleData.counters && Array.isArray(roleData.counters)) {
        countersData.push(...roleData.counters)
      }
    })

    return countersData.slice(0, 10) // Limit to top 10 counters
  })

  // Actions
  async function openModal(championData) {
    champion.value = championData
    isOpen.value = true
    error.value = null

    // Load detailed data
    await loadDetailedData()
  }

  function closeModal() {
    isOpen.value = false
    champion.value = null
    detailedData.value = null
    error.value = null
  }

  async function loadDetailedData() {
    if (!champion.value) return

    isLoading.value = true
    error.value = null

    try {
      // Get champion internal key for Firebase lookup
      const internalKey = getChampionInternalKey(champion.value.name)

      if (!internalKey) {
        throw new Error('Could not determine champion internal key')
      }

      console.log(`Loading detailed data for ${champion.value.name} (key: ${internalKey})`)

      // Fetch from Firebase using the correct 4-segment path
      const docRef = doc(db, 'champions', 'data', 'champions', internalKey)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        detailedData.value = docSnap.data()
        console.log(`✅ Loaded detailed data for ${champion.value.name}`)
      } else {
        console.warn(`⚠️ No detailed data found for ${champion.value.name}`)
        detailedData.value = null
      }
    } catch (err) {
      console.error('Error loading detailed champion data:', err)
      error.value = err.message
      detailedData.value = null
    } finally {
      isLoading.value = false
    }
  }

  function getChampionInternalKey(championName) {
    // Convert display name to internal key (e.g., "K'Sante" -> "KSante")
    const nameMappings = {
      "K'Sante": 'KSante',
      "Wukong": 'MonkeyKing',
      "Jarvan IV": 'JarvanIV',
      "Miss Fortune": 'MissFortune',
      "Dr. Mundo": 'DrMundo',
      "Rek'Sai": 'RekSai',
      "Kog'Maw": 'KogMaw',
      "Cho'Gath": 'Chogath',
      "Vel'Koz": 'Velkoz',
      "Kai'Sa": 'Kaisa',
      "Kha'Zix": 'Khazix',
      "LeBlanc": 'Leblanc'
    }

    // Check for exact match first
    if (nameMappings[championName]) {
      return nameMappings[championName]
    }

    // Convert to internal format: remove apostrophes, spaces, and special chars
    return championName.replace(/['\s]/g, '').replace(/[^a-zA-Z0-9]/g, '')
  }

  return {
    // State
    isOpen,
    champion,
    detailedData,
    isLoading,
    error,

    // Getters
    championIconUrl,
    abilities,
    passiveAbility,
    activeAbilities,
    counters,

    // Actions
    openModal,
    closeModal,
    loadDetailedData
  }
})

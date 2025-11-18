import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchChampionDataFromFirestore } from '@/services/firebase/championData'
import { riotApiService } from '@/services/riotApi'

export const useChampionsStore = defineStore('champions', () => {
  // State
  const allChampions = ref([])
  const opTierChampions = ref({})
  const isLoading = ref(false)
  const patchVersion = ref('15.22.1')
  
  // Getters
  const championsByRole = computed(() => {
    const grouped = {
      Top: [],
      Jungle: [],
      Mid: [],
      Bot: [],
      Support: []
    }
    
    allChampions.value.forEach(champ => {
      if (Array.isArray(champ.roles)) {
        champ.roles.forEach(role => {
          if (grouped[role]) {
            grouped[role].push(champ)
          }
        })
      }
    })
    
    return grouped
  })
  
  // Actions
  async function loadChampions() {
    isLoading.value = true
    try {
      console.log('=== LOADING GLOBAL CHAMPION DATA ===')
      
      // Fetch directly from Firestore (bypassing cache for now)
      const firestoreData = await fetchChampionDataFromFirestore('global')
      
      if (firestoreData && firestoreData.allChampions && Array.isArray(firestoreData.allChampions) && firestoreData.allChampions.length > 0) {
        // Create a deep copy to avoid reference issues
        allChampions.value = firestoreData.allChampions.map(champ => {
          // Convert roles to a real array (not Proxy)
          let rolesArray = []
          if (Array.isArray(champ.roles)) {
            rolesArray = Array.from(champ.roles)
          }
          return {
            ...champ,
            roles: rolesArray
          }
        })
        opTierChampions.value = { ...(firestoreData.opTierChampions || {}) }
        
        console.log(`✓ Champion data loaded from Firestore: ${firestoreData.allChampions.length} champions`)
      } else {
        console.warn('⚠️ No champion data in database. Please import data using Admin Panel > Migration tab.')
        allChampions.value = []
        opTierChampions.value = {}
      }
    } catch (error) {
      console.error('=== ERROR loading champion data from Firestore ===', error)
      allChampions.value = []
      opTierChampions.value = {}
    } finally {
      isLoading.value = false
    }
  }

  function setChampions(champions) {
    allChampions.value = champions
  }
  
  function setOpTierChampions(opTier) {
    opTierChampions.value = opTier
  }
  
  function setLoading(value) {
    isLoading.value = value
  }
  
  async function initializePatchVersion() {
    try {
      const version = await riotApiService.getLatestPatchVersionWithRetry()
      if (version) {
        patchVersion.value = version
        console.log(`Patch version loaded: ${version}`)
      }
    } catch (error) {
      console.error('Error loading patch version:', error)
      // Keep default patch version
    }
  }

  function setPatchVersion(version) {
    patchVersion.value = version
  }
  
  function getChampionIconUrl(championName, context = 'creator-pool') {
    const champ = allChampions.value.find(
      c => c.name?.toLowerCase() === championName?.toLowerCase()
    )
    if (!champ?.imageName) return getPlaceholderUrl(context)
    return `https://ddragon.leagueoflegends.com/cdn/${patchVersion.value}/img/champion/${champ.imageName}.png`
  }
  
  function getRoleIconUrl(role) {
    const urls = {
      top: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top-blue-hover.png',
      jungle: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle-blue-hover.png',
      mid: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle-blue-hover.png',
      bot: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom-blue-hover.png',
      support: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility-blue-hover.png',
      unknown: 'https://placehold.co/16x16/cccccc/777777?text=?'
    }
    return urls[role?.toLowerCase()] || urls.unknown
  }
  
  function isOpForRole(championName, role) {
    return opTierChampions.value[championName]?.includes(role) || false
  }
  
  function getPlaceholderUrl(context) {
    const placeholders = {
      pick: 'https://placehold.co/60x60/374151/9ca3af?text=?',
      ban: 'https://placehold.co/38x38/374151/9ca3af?text=?',
      list: 'https://placehold.co/22x22/374151/9ca3af?text=?',
      'creator-pool': 'https://placehold.co/56x56/374151/9ca3af?text=?',
      'holding-area': 'https://placehold.co/40x40/374151/9ca3af?text=?'
    }
    return placeholders[context] || placeholders['creator-pool']
  }
  
  return {
    // State
    allChampions,
    opTierChampions,
    isLoading,
    patchVersion,
    // Getters
    championsByRole,
    // Actions
    loadChampions,
    setChampions,
    setOpTierChampions,
    setLoading,
    setPatchVersion,
    initializePatchVersion,
    getChampionIconUrl,
    getRoleIconUrl,
    isOpForRole
  }
})

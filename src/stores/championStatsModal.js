import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/services/firebase/config'
import { riotApiService } from '@/services/riotApi'
import { useChampionsStore } from './champions'

export const useChampionStatsModalStore = defineStore('championStatsModal', () => {
  // Get reference to champions store for patch version
  const championsStore = useChampionsStore()

  // State
  const isOpen = ref(false)
  const champion = ref(null)
  const detailedData = ref(null)
  const isLoading = ref(false)
  const error = ref(null)
  const sourceRole = ref(null) // Role from which champion was clicked
  const selectedRole = ref(null) // Currently selected role in the modal
  const selectedFormIndex = ref(0) // Selected form index for multi-form champions
  const abilityDescriptions = ref(null) // Ability descriptions from Riot API
  const currentPatch = computed(() => championsStore.patchVersion || '16.1.1') // Dynamic patch version from champions store

  // Getters
  const championIconUrl = computed(() => {
    if (!champion.value) return ''
    return riotApiService.getChampionIconUrl(champion.value.imageName, currentPatch.value)
  })

  // Get forms from Firebase data (new format)
  const abilityForms = computed(() => {
    // First check if we have the new forms structure
    if (detailedData.value?.forms && detailedData.value.forms.length > 0) {
      return detailedData.value.forms
    }

    // Otherwise, build forms from flat abilities with formName field
    const abilities = detailedData.value?.abilities || []
    if (!abilities.length) return []

    // Check if any ability has formName
    const hasFormNames = abilities.some(a => a.formName)
    if (!hasFormNames) {
      // Single form - create one form with all abilities
      return [{ name: 'Skills', abilities: abilities }]
    }

    // Group abilities by formName
    const formMap = new Map()
    for (const ability of abilities) {
      const formName = ability.formName || 'Skills'
      if (!formMap.has(formName)) {
        formMap.set(formName, [])
      }
      formMap.get(formName).push(ability)
    }

    // Convert to forms array
    return Array.from(formMap.entries()).map(([name, abilities]) => ({
      name,
      abilities
    }))
  })

  // Check if champion has multiple forms
  const hasMultipleForms = computed(() => {
    if (detailedData.value?.hasMultipleForms) return true
    if (abilityForms.value.length > 1) return true

    // Check for formName in flat abilities
    const abilities = detailedData.value?.abilities || []
    const formNames = new Set(abilities.map(a => a.formName).filter(Boolean))
    return formNames.size > 1
  })

  // Legacy: Get abilities from Firebase data (abilities array)
  const abilities = computed(() => {
    return detailedData.value?.abilities || []
  })

  // Get available roles from the roles object
  const availableRoles = computed(() => {
    if (!detailedData.value?.roles) return []
    return Object.keys(detailedData.value.roles)
  })

  // Get current role data
  const currentRoleData = computed(() => {
    if (!selectedRole.value || !detailedData.value?.roles) return null
    return detailedData.value.roles[selectedRole.value] || null
  })

  // Get stats for current role
  const currentRoleStats = computed(() => {
    return currentRoleData.value?.stats || null
  })

  // Get counters for current role
  const currentRoleCounters = computed(() => {
    const counters = currentRoleData.value?.counters || []
    // Sort by win rate (highest first - champions this champion beats)
    return counters
      .slice()
      .sort((a, b) => (b.win_rate || 0) - (a.win_rate || 0))
      .slice(0, 15) // Limit to top 15
  })

  // Format stats for display
  const formattedStats = computed(() => {
    const stats = currentRoleStats.value
    if (!stats) return null

    // Parse rank string like "11 / 101" or use individual fields
    let rankDisplay = '-'
    if (stats.rank) {
      if (typeof stats.rank === 'string') {
        rankDisplay = stats.rank
      } else if (typeof stats.rank === 'number') {
        const total = stats.totalChampions || 51
        rankDisplay = `${stats.rank} / ${total}`
      }
    }

    return {
      tier: stats.tier || '-',
      rank: rankDisplay,
      winRate: typeof stats.win_rate === 'number' ? `${stats.win_rate.toFixed(1)}%` : '-',
      pickRate: typeof stats.pick_rate === 'number' ? `${stats.pick_rate.toFixed(1)}%` : '-',
      banRate: typeof stats.ban_rate === 'number' ? `${stats.ban_rate.toFixed(1)}%` : '-',
      games: typeof stats.games === 'number' ? stats.games.toLocaleString() : '-'
    }
  })

  // Build ability icons with data from Firebase and descriptions from Riot API
  // This is the legacy flat view - use abilityIconsForForm for form-aware display
  const abilityIcons = computed(() => {
    // If using new form structure, return abilities for current form
    if (hasMultipleForms.value && abilityForms.value.length > 0) {
      return abilityIconsForForm.value
    }

    // Legacy: flat abilities list
    const icons = []

    // Get abilities from Firebase
    const firebaseAbilities = detailedData.value?.abilities || []

    // Get descriptions from Riot API
    const riotAbilities = abilityDescriptions.value

    // Passive - find in firebaseAbilities where type === 'Passive'
    const passiveAbility = firebaseAbilities.find(a => a.type === 'Passive')
    if (passiveAbility) {
      const riotPassive = riotAbilities?.passive
      icons.push({
        key: 'P',
        name: passiveAbility.name || riotPassive?.name || 'Passive',
        description: riotPassive?.description || passiveAbility.name || 'Passive ability',
        cooldown: passiveAbility.cooldown || '',
        iconUrl: riotPassive?.image ? riotApiService.getPassiveIconUrl(riotPassive.image, currentPatch.value) : null
      })
    }

    // Active abilities Q, W, E, R
    const abilityTypes = ['Q', 'W', 'E', 'R']
    abilityTypes.forEach((type, index) => {
      const firebaseAbility = firebaseAbilities.find(a => a.type === type)
      const riotSpell = riotAbilities?.spells?.[index]

      if (firebaseAbility || riotSpell) {
        icons.push({
          key: type,
          name: firebaseAbility?.name || riotSpell?.name || `${type} Ability`,
          description: riotSpell?.description || firebaseAbility?.name || `${type} ability`,
          cooldown: firebaseAbility?.cooldown || riotSpell?.cooldown || '',
          cost: firebaseAbility?.cost || null,
          iconUrl: riotSpell?.image ? riotApiService.getAbilityIconUrl(riotSpell.image, currentPatch.value) : null
        })
      }
    })

    return icons
  })

  // Get ability icons for the currently selected form (new form-aware display)
  // Shows complete kit (P+Q+W+E+R) for each form, merging shared abilities across forms
  const abilityIconsForForm = computed(() => {
    const forms = abilityForms.value
    if (!forms || forms.length === 0) {
      return []
    }

    // Get current form
    const formIndex = Math.min(selectedFormIndex.value, forms.length - 1)
    const currentForm = forms[formIndex]
    if (!currentForm) return []

    const riotAbilities = abilityDescriptions.value

    // Build complete ability map across ALL forms
    // This allows us to show shared abilities (like transform R) in all forms
    const completeAbilityMap = {
      'Passive': null,
      'Q': null,
      'W': null,
      'E': null,
      'R': null
    }

    // Collect all abilities from all forms
    for (const form of forms) {
      const abilities = form.abilities || []
      for (const ability of abilities) {
        const type = ability.type
        if (completeAbilityMap.hasOwnProperty(type) && !completeAbilityMap[type]) {
          completeAbilityMap[type] = ability
        }
      }
    }

    // Now build icons for current form, using current form's abilities when available,
    // falling back to shared abilities from other forms
    const icons = []

    // Get current form abilities for override
    const currentFormAbilities = currentForm.abilities || []
    const currentFormAbilityMap = {}
    for (const ability of currentFormAbilities) {
      currentFormAbilityMap[ability.type] = ability
    }

    // Helper function to find Riot spell by ability name (for multi-form champions)
    function findRiotSpellByName(abilityName, type) {
      if (!abilityName || !riotAbilities) return null

      const normalizedAbilityName = abilityName.toLowerCase().trim()

      // For passive, check passive
      if (type === 'Passive') {
        if (riotAbilities.passive?.name?.toLowerCase().trim() === normalizedAbilityName) {
          return riotAbilities.passive
        }
        return null
      }

      // For spells, search all spells for matching name
      for (const spell of riotAbilities.spells || []) {
        if (spell.name?.toLowerCase().trim() === normalizedAbilityName) {
          return spell
        }
      }
      return null
    }

    // Helper function to get Riot data for an ability (by name match or fallback to index)
    function getRiotDataForAbility(formAbility, type) {
      // First try to match by name (important for multi-form champions)
      const matchedByName = findRiotSpellByName(formAbility?.name, type)
      if (matchedByName) {
        return matchedByName
      }

      // Fallback to index-based lookup for single-form champions
      const indexMap = { 'Q': 0, 'W': 1, 'E': 2, 'R': 3 }
      if (type === 'Passive') {
        return riotAbilities?.passive
      }
      return riotAbilities?.spells?.[indexMap[type]]
    }

    // Build icons in order: P, Q, W, E, R
    const abilityTypes = [
      { type: 'Passive', key: 'P' },
      { type: 'Q', key: 'Q' },
      { type: 'W', key: 'W' },
      { type: 'E', key: 'E' },
      { type: 'R', key: 'R' }
    ]

    for (const { type, key } of abilityTypes) {
      // Use current form's ability if available, otherwise use shared ability
      const formAbility = currentFormAbilityMap[type] || completeAbilityMap[type]

      if (formAbility) {
        // Get Riot data by matching ability name (crucial for multi-form champions)
        const riotData = getRiotDataForAbility(formAbility, type)
        let iconUrl = null

        // Use Riot API images (matched by name)
        if (type === 'Passive' && riotData?.image) {
          iconUrl = riotApiService.getPassiveIconUrl(riotData.image, currentPatch.value)
        } else if (riotData?.image) {
          iconUrl = riotApiService.getAbilityIconUrl(riotData.image, currentPatch.value)
        }

        // Check if this is a shared ability (not in current form but in another form)
        const isSharedAbility = !currentFormAbilityMap[type] && completeAbilityMap[type]

        icons.push({
          key,
          name: formAbility.name || riotData?.name || `${key} Ability`,
          description: riotData?.description || formAbility.name || `${key} ability`,
          cooldown: formAbility.cooldown || '',
          cost: formAbility.cost || null,
          iconUrl,
          isShared: isSharedAbility // Flag to indicate shared ability
        })
      }
    }

    return icons
  })

  // Get form names for tabs
  const formNames = computed(() => {
    return abilityForms.value.map(form => form.name || 'Skills')
  })

  // Actions
  async function openModal(championData, roleFromClick = null) {
    champion.value = championData
    sourceRole.value = roleFromClick
    isOpen.value = true
    error.value = null
    detailedData.value = null
    selectedRole.value = null
    abilityDescriptions.value = null

    // Load detailed data
    await loadDetailedData()

    // Set initial selected role
    if (roleFromClick && availableRoles.value.includes(roleFromClick)) {
      selectedRole.value = roleFromClick
    } else if (availableRoles.value.length > 0) {
      selectedRole.value = availableRoles.value[0]
    }

    // Load ability descriptions from Riot API
    await loadAbilityDescriptions()
  }

  function closeModal() {
    isOpen.value = false
    champion.value = null
    detailedData.value = null
    sourceRole.value = null
    selectedRole.value = null
    abilityDescriptions.value = null
    error.value = null
  }

  function setSelectedRole(role) {
    if (availableRoles.value.includes(role)) {
      selectedRole.value = role
    }
  }

  function setSelectedFormIndex(index) {
    if (index >= 0 && index < abilityForms.value.length) {
      selectedFormIndex.value = index
    }
  }

  async function loadDetailedData() {
    if (!champion.value) return

    isLoading.value = true
    error.value = null

    try {
      // Use imageName as the internal key (Riot API key)
      const internalKey = champion.value.imageName

      if (!internalKey) {
        throw new Error('Could not determine champion internal key')
      }

      console.log(`Loading detailed data for ${champion.value.name} (key: ${internalKey})`)

      // Fetch from Firebase using the correct 4-segment path
      const docRef = doc(db, 'champions', 'data', 'champions', internalKey)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        detailedData.value = docSnap.data()
        console.log(`✅ Loaded detailed data for ${champion.value.name}`, detailedData.value)
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

  async function loadAbilityDescriptions() {
    if (!champion.value) return

    try {
      // Use imageName as the Riot API key
      const internalKey = champion.value.imageName
      if (!internalKey) return

      console.log(`Loading ability descriptions for ${champion.value.name} (key: ${internalKey})`)
      abilityDescriptions.value = await riotApiService.getChampionDetails(internalKey, currentPatch.value)
      console.log(`✅ Loaded ability descriptions`, abilityDescriptions.value)
    } catch (err) {
      console.error('Error loading ability descriptions:', err)
      abilityDescriptions.value = null
    }
  }

  function getCounterIconUrl(counter) {
    // Look up the champion in the champions store to get the correct imageName
    const champ = championsStore.allChampions.find(
      c => c.name?.toLowerCase() === counter.champion?.toLowerCase()
    )
    const imageName = champ?.imageName || counter.champion?.replace(/['\s]/g, '').replace(/[^a-zA-Z0-9]/g, '')
    return riotApiService.getChampionIconUrl(imageName, currentPatch.value)
  }

  return {
    // State
    isOpen,
    champion,
    detailedData,
    isLoading,
    error,
    sourceRole,
    selectedRole,
    selectedFormIndex,
    abilityDescriptions,
    currentPatch,

    // Getters
    championIconUrl,
    abilities,
    abilityForms,
    hasMultipleForms,
    formNames,
    availableRoles,
    currentRoleData,
    currentRoleStats,
    currentRoleCounters,
    formattedStats,
    abilityIcons,

    // Actions
    openModal,
    closeModal,
    setSelectedRole,
    setSelectedFormIndex,
    loadDetailedData,
    loadAbilityDescriptions,
    getCounterIconUrl
  }
})

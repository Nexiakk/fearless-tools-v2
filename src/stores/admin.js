import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useChampionsStore } from './champions'
import { fetchChampionDataFromFirestore, saveChampionDataToFirestore, migrateChampionDataToFirestore } from '@/services/firebase/championData'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/services/firebase/config'
import { authService } from '@/services/firebase/auth'
import { riotApiService } from '@/services/riotApi'
import { cacheService } from '@/services/cache'

export const useAdminStore = defineStore('admin', () => {
  // State
  const isOpen = ref(false)
  const activeTab = ref('champions') // 'champions', 'opTier', 'migration', 'settings', 'workspaceSettings'
  const isLoading = ref(false)
  const error = ref('')
  const success = ref('')
  
  // Champion Editor State
  const champions = ref([])
  const searchTerm = ref('')
  const roleFilter = ref('all')
  const selectedChampion = ref(null)
  const isEditModalOpen = ref(false)
  const editedChampion = ref(null)
  
  // OP Tier Editor State
  const opTierChampions = ref({})
  const opTierSearchTerm = ref('')
  
  // Migration State
  const migrationStatus = ref('')
  
  // Global Settings State
  const globalSettings = ref({
    anonymousUserMode: 'interact', // 'interact' or 'view'
    useHeadlessBrowser: false // Use headless browser for op.gg scraping (slower but more reliable)
  })
  const isSavingSettings = ref(false)
  
  // Editor Mode State (for UI interaction system)
  const isEditorModeActive = ref(false)
  const selectedChampionForEditor = ref(null)
  const isOpTierEditorModalOpen = ref(false)
  const opTierEditorChampion = ref(null)
  
  // Valid roles
  const validRoles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']
  
  // Computed
  const filteredChampions = computed(() => {
    let filtered = [...champions.value]
    
    // Filter by role, "new", or "multiple"
    if (roleFilter.value !== 'all') {
      if (roleFilter.value === 'new') {
        filtered = filtered.filter(c => isNewChampion(c))
      } else if (roleFilter.value === 'multiple') {
        filtered = filtered.filter(c => Array.isArray(c.roles) && c.roles.length > 1)
      } else {
        filtered = filtered.filter(c => Array.isArray(c.roles) && c.roles.includes(roleFilter.value))
      }
    }
    
    // Filter by search term
    if (searchTerm.value.trim()) {
      const search = searchTerm.value.toLowerCase()
      filtered = filtered.filter(c => c.name && c.name.toLowerCase().includes(search))
    }
    
    // Sort: new champions first, then alphabetically
    return filtered.sort((a, b) => {
      const aIsNew = isNewChampion(a)
      const bIsNew = isNewChampion(b)
      if (aIsNew && !bIsNew) return -1
      if (!aIsNew && bIsNew) return 1
      return (a.name || '').localeCompare(b.name || '')
    })
  })
  
  const filteredChampionsForOpTier = computed(() => {
    let filtered = [...champions.value]
    
    if (opTierSearchTerm.value.trim()) {
      const search = opTierSearchTerm.value.toLowerCase()
      filtered = filtered.filter(c => c.name && c.name.toLowerCase().includes(search))
    }
    
    return filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  })
  
  const newChampionsCount = computed(() => {
    return champions.value.filter(c => isNewChampion(c)).length
  })
  
  // Helper functions
  function isNewChampion(champion) {
    return !champion.roles || champion.roles.length === 0
  }
  
  function getSortedRoles(champion) {
    if (!champion || !champion.roles || champion.roles.length === 0) return []
    if (!champion.mainRole || champion.roles.length === 1) return champion.roles
    
    // Put main role first
    const sorted = champion.roles.filter(r => r !== champion.mainRole)
    sorted.unshift(champion.mainRole)
    return sorted
  }
  
  function getRolesDisplay(champion) {
    if (!champion || !champion.roles || champion.roles.length === 0) return 'No roles assigned'
    const sorted = getSortedRoles(champion)
    return sorted.join(', ')
  }
  
  // Actions
  async function open(tab = null) {
    isOpen.value = true
    error.value = ''
    success.value = ''
    if (tab) {
      activeTab.value = tab
    }
    await loadData()
    await loadGlobalSettings()
    await loadApiChampionsForEditor()
  }
  
  function close() {
    isOpen.value = false
    error.value = ''
    success.value = ''
    selectedChampion.value = null
    isEditModalOpen.value = false
  }
  
  // Editor Mode Functions
  function toggleEditorMode() {
    isEditorModeActive.value = !isEditorModeActive.value
    if (!isEditorModeActive.value) {
      // Clear selection when exiting editor mode
      selectedChampionForEditor.value = null
    }
  }
  
  function setEditorMode(value) {
    isEditorModeActive.value = value
    if (!value) {
      // Clear selection when exiting editor mode
      selectedChampionForEditor.value = null
    }
  }
  
  function setSelectedChampionForEditor(champion) {
    selectedChampionForEditor.value = champion
  }
  
  function clearSelectedChampionForEditor() {
    selectedChampionForEditor.value = null
  }
  
  function openOpTierEditorModal(champion) {
    // Ensure data is loaded
    if (champions.value.length === 0) {
      loadData()
    }
    opTierEditorChampion.value = champion
    isOpTierEditorModalOpen.value = true
  }
  
  function closeOpTierEditorModal() {
    isOpTierEditorModalOpen.value = false
    opTierEditorChampion.value = null
  }
  
  async function loadData() {
    console.log('Admin panel loadData called - loading GLOBAL champion data from database ONLY')
    
    champions.value = []
    opTierChampions.value = {}
    error.value = ''
    
    try {
      const freshData = await fetchChampionDataFromFirestore('global')
      
      if (freshData && freshData.allChampions && Array.isArray(freshData.allChampions) && freshData.allChampions.length > 0) {
        champions.value = freshData.allChampions.map(champ => {
          let rolesArray = []
          if (Array.isArray(champ.roles)) {
            rolesArray = Array.from(champ.roles)
            // Sort roles to put main role first
            if (champ.mainRole && rolesArray.includes(champ.mainRole) && rolesArray.length > 1) {
              const sorted = rolesArray.filter(r => r !== champ.mainRole)
              sorted.unshift(champ.mainRole)
              rolesArray = sorted
            }
          }
          return { ...champ, roles: rolesArray }
        })
        opTierChampions.value = { ...(freshData.opTierChampions || {}) }
        
        console.log(`Admin panel loaded ${champions.value.length} champions from Firestore database`)
        error.value = ''
      } else {
        champions.value = []
        opTierChampions.value = {}
        error.value = 'No champion data found in database. Please use the Migration tab to import data from champions.js first.'
      }
    } catch (error) {
      console.error('Error loading data from Firestore in admin panel:', error)
      champions.value = []
      opTierChampions.value = {}
      error.value = 'Error loading champion data from database: ' + (error.message || 'Unknown error')
    }
  }
  
  async function loadApiChampionsForEditor() {
    try {
      let apiChampions = null
      
      // Try cache first
      if (cacheService.isAvailable()) {
        const cached = await cacheService.getCachedMetadata('api_champions_data')
        if (cached && cached.champions) {
          apiChampions = cached.champions
          console.log('Loaded API champions from cache')
        }
      }
      
      // If no cache, fetch from API
      if (!apiChampions) {
        const patchVersion = await riotApiService.getLatestPatchVersionWithRetry()
        apiChampions = await riotApiService.getChampionDataWithRetry(patchVersion)
        console.log('Fetched API champions directly')
      }
      
      if (!apiChampions || apiChampions.length === 0) {
        return
      }
      
      // Merge API champions with database champions
      const dbMap = new Map()
      champions.value.forEach(champ => {
        const key = champ.name?.toLowerCase()
        if (key) dbMap.set(key, champ)
        if (champ.id) dbMap.set(`id_${champ.id}`, champ)
      })
      
      const merged = apiChampions.map(apiChamp => {
        const nameKey = apiChamp.name?.toLowerCase()
        const idKey = apiChamp.id ? `id_${apiChamp.id}` : null
        const dbChamp = dbMap.get(nameKey) || (idKey ? dbMap.get(idKey) : null)
        
        if (dbChamp) {
          return {
            ...apiChamp,
            roles: dbChamp.roles || [],
            mainRole: dbChamp.mainRole || null
          }
        } else {
          return {
            ...apiChamp,
            roles: [],
            mainRole: null
          }
        }
      })
      
      champions.value = merged
      console.log(`Merged ${merged.length} champions (${merged.filter(c => isNewChampion(c)).length} new)`)
    } catch (error) {
      console.error('Error loading API champions for editor:', error)
    }
  }
  
  function openEditModal(champion) {
    const currentChampion = champions.value.find(c => c.id === champion.id || c.name === champion.name)
    const champToEdit = currentChampion || champion
    
    selectedChampion.value = champToEdit
    
    let roles = []
    if (champToEdit.roles) {
      if (Array.isArray(champToEdit.roles)) {
        roles = Array.from(champToEdit.roles)
      }
    }
    
    let mainRole = champToEdit.mainRole || ''
    if (!mainRole && roles.length > 0) {
      mainRole = roles[0]
    } else if (mainRole && !roles.includes(mainRole)) {
      mainRole = roles.length > 0 ? roles[0] : ''
    }
    
    let sortedRoles = [...roles]
    if (mainRole && sortedRoles.includes(mainRole) && sortedRoles.length > 1) {
      sortedRoles = sortedRoles.filter(r => r !== mainRole)
      sortedRoles.unshift(mainRole)
    }
    
    editedChampion.value = {
      name: champToEdit.name || '',
      imageName: champToEdit.imageName || '',
      roles: sortedRoles,
      mainRole: mainRole
    }
    isEditModalOpen.value = true
    error.value = ''
  }
  
  function closeEditModal() {
    isEditModalOpen.value = false
    selectedChampion.value = null
    editedChampion.value = null
    error.value = ''
  }
  
  function toggleRole(role) {
    if (!editedChampion.value) return
    const index = editedChampion.value.roles.indexOf(role)
    if (index === -1) {
      editedChampion.value.roles.push(role)
      if (!editedChampion.value.mainRole) {
        editedChampion.value.mainRole = role
      }
    } else {
      editedChampion.value.roles.splice(index, 1)
      if (editedChampion.value.mainRole === role) {
        editedChampion.value.mainRole = editedChampion.value.roles.length > 0 ? editedChampion.value.roles[0] : ''
      }
    }
  }
  
  function setMainRole(role) {
    if (!editedChampion.value) return
    if (editedChampion.value.roles.includes(role)) {
      editedChampion.value.mainRole = role
      const sorted = editedChampion.value.roles.filter(r => r !== role)
      sorted.unshift(role)
      editedChampion.value.roles = sorted
    }
  }
  
  function validateChampion() {
    if (!editedChampion.value) return false
    
    if (!editedChampion.value.name || editedChampion.value.name.trim() === '') {
      error.value = 'Champion name is required'
      return false
    }
    
    if (!editedChampion.value.imageName || editedChampion.value.imageName.trim() === '') {
      error.value = 'Image name is required'
      return false
    }
    
    if (!Array.isArray(editedChampion.value.roles) || editedChampion.value.roles.length === 0) {
      error.value = 'At least one role is required'
      return false
    }
    
    if (editedChampion.value.mainRole && !editedChampion.value.roles.includes(editedChampion.value.mainRole)) {
      error.value = 'Main role must be one of the selected roles'
      return false
    }
    
    return true
  }
  
  async function saveChampion() {
    if (!validateChampion()) return
    
    isLoading.value = true
    error.value = ''
    
    try {
      let mainRole = editedChampion.value.mainRole || ''
      if (!mainRole && editedChampion.value.roles.length > 0) {
        mainRole = editedChampion.value.roles[0]
      } else if (mainRole && !editedChampion.value.roles.includes(mainRole)) {
        mainRole = editedChampion.value.roles.length > 0 ? editedChampion.value.roles[0] : ''
      }
      
      let sortedRoles = Array.isArray(editedChampion.value.roles) ? [...editedChampion.value.roles] : []
      if (mainRole && sortedRoles.includes(mainRole) && sortedRoles.length > 1) {
        sortedRoles = sortedRoles.filter(r => r !== mainRole)
        sortedRoles.unshift(mainRole)
      }
      
      // Update local champion data
      const index = champions.value.findIndex(c => c.id === selectedChampion.value.id)
      if (index === -1) {
        const nameIndex = champions.value.findIndex(c => c.name === selectedChampion.value.name)
        if (nameIndex !== -1) {
          champions.value[nameIndex] = {
            ...champions.value[nameIndex],
            name: editedChampion.value.name.trim(),
            imageName: editedChampion.value.imageName.trim(),
            roles: sortedRoles,
            mainRole: mainRole
          }
        } else {
          throw new Error('Champion not found in champions array')
        }
      } else {
        champions.value[index] = {
          ...champions.value[index],
          name: editedChampion.value.name.trim(),
          imageName: editedChampion.value.imageName.trim(),
          roles: sortedRoles,
          mainRole: mainRole
        }
      }
      
      // Save to Firestore
      const championsToSave = champions.value.map(champ => {
        if (champ.mainRole && Array.isArray(champ.roles) && champ.roles.length > 1 && champ.roles.includes(champ.mainRole)) {
          const sorted = champ.roles.filter(r => r !== champ.mainRole)
          sorted.unshift(champ.mainRole)
          return { ...champ, roles: sorted }
        }
        return champ
      })
      
      const result = await saveChampionDataToFirestore('global', championsToSave, opTierChampions.value)
      
      if (result.success) {
        // Invalidate cache
        if (cacheService.invalidateCache) {
          await cacheService.invalidateCache('global')
        }
        
        // Reload data
        await loadData()
        
        // Update champions store
        const championsStore = useChampionsStore()
        await championsStore.loadChampions()
        
        success.value = 'Champion and OP tier data saved successfully'
        
        setTimeout(() => {
          success.value = ''
        }, 3000)
      } else {
        throw new Error(result.error || 'Failed to save champion')
      }
    } catch (err) {
      console.error('Error saving champion:', err)
      error.value = err.message || 'Failed to save champion'
    } finally {
      isLoading.value = false
    }
  }
  
  function toggleOpTier(championName, role) {
    if (!opTierChampions.value[championName]) {
      opTierChampions.value[championName] = []
    }
    
    const index = opTierChampions.value[championName].indexOf(role)
    if (index === -1) {
      opTierChampions.value[championName].push(role)
    } else {
      opTierChampions.value[championName].splice(index, 1)
      if (opTierChampions.value[championName].length === 0) {
        delete opTierChampions.value[championName]
      }
    }
    
    saveOpTierChanges()
  }
  
  function isOpForRole(championName, role) {
    return opTierChampions.value[championName]?.includes(role) || false
  }
  
  async function saveOpTierChanges() {
    isLoading.value = true
    error.value = ''
    
    try {
      const result = await saveChampionDataToFirestore('global', champions.value, opTierChampions.value)
      
      if (result.success) {
        success.value = 'OP tier changes saved successfully'
        setTimeout(() => {
          success.value = ''
        }, 3000)
      } else {
        throw new Error(result.error || 'Failed to save OP tier changes')
      }
    } catch (err) {
      console.error('Error saving OP tier changes:', err)
      error.value = err.message || 'Failed to save OP tier changes'
    } finally {
      isLoading.value = false
    }
  }
  
  function exportChampionData() {
    const data = {
      allChampions: champions.value,
      opTierChampions: opTierChampions.value
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `champion-data-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    success.value = 'Champion data exported successfully'
    setTimeout(() => { success.value = '' }, 3000)
  }
  
  async function importChampionData(event) {
    const file = event.target.files[0]
    if (!file) return
    
    isLoading.value = true
    error.value = ''
    
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      
      if (!data.allChampions || !Array.isArray(data.allChampions)) {
        throw new Error('Invalid data format: allChampions must be an array')
      }
      
      champions.value = data.allChampions.map(champ => {
        let rolesArray = []
        if (Array.isArray(champ.roles)) {
          rolesArray = Array.from(champ.roles)
        }
        return { ...champ, roles: rolesArray }
      })
      opTierChampions.value = { ...(data.opTierChampions || {}) }
      
      const result = await saveChampionDataToFirestore('global', champions.value, opTierChampions.value)
      
      if (result.success) {
        success.value = 'Champion data imported successfully'
        setTimeout(() => { success.value = '' }, 3000)
      } else {
        throw new Error(result.error || 'Failed to save imported data')
      }
    } catch (err) {
      console.error('Error importing champion data:', err)
      error.value = err.message || 'Failed to import champion data'
    } finally {
      isLoading.value = false
      event.target.value = ''
    }
  }
  
  async function migrateFromChampionsJs() {
    // Check if champions.js data is available
    if (!window.allLolChampions || !Array.isArray(window.allLolChampions)) {
      error.value = 'No champion data found in champions.js'
      return
    }
    
    if (!authService.isAuthenticated()) {
      error.value = 'You must be logged in to migrate data. Please sign in first.'
      return
    }
    
    const currentUser = authService.getCurrentUser()
    if (currentUser && currentUser.isAnonymous) {
      error.value = 'Anonymous users cannot migrate data. Please sign in with email/password.'
      return
    }
    
    const isAdmin = await authService.isAdmin()
    if (!isAdmin) {
      error.value = 'Admin access required. Please ensure you are signed in with email/password (not anonymous).'
      return
    }
    
    isLoading.value = true
    error.value = ''
    migrationStatus.value = 'Starting migration...'
    
    try {
      const result = await migrateChampionDataToFirestore(
        'global',
        window.allLolChampions,
        window.opTierChampions || {}
      )
      
      if (result.success) {
        migrationStatus.value = 'Migration completed successfully'
        success.value = 'Champion data migrated successfully to global database'
        
        // Invalidate cache
        if (cacheService.invalidateCache) {
          await cacheService.invalidateCache('global')
        }
        
        // Reload data
        await loadData()
        
        // Update champions store
        const championsStore = useChampionsStore()
        await championsStore.loadChampions()
        
        setTimeout(() => {
          migrationStatus.value = ''
          success.value = ''
        }, 5000)
      } else {
        throw new Error(result.error || 'Migration failed')
      }
    } catch (err) {
      console.error('Error migrating champion data:', err)
      error.value = err.message || 'Failed to migrate champion data'
      migrationStatus.value = ''
    } finally {
      isLoading.value = false
    }
  }
  
  async function loadGlobalSettings() {
    try {
      const settingsRef = doc(db, 'settings', 'global')
      const settingsDoc = await getDoc(settingsRef)
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data()
        globalSettings.value = {
          anonymousUserMode: data.anonymousUserMode || 'interact',
          useHeadlessBrowser: data.useHeadlessBrowser || false
        }
        console.log('Loaded global settings:', globalSettings.value)
      }
    } catch (err) {
      console.error('Error loading global settings:', err)
    }
  }
  
  async function saveGlobalSettings() {
    if (!authService.isAuthenticated()) {
      error.value = 'Authentication required'
      return
    }
    
    const isAdmin = await authService.isAdmin()
    if (!isAdmin) {
      error.value = 'Admin access required'
      return
    }
    
    isSavingSettings.value = true
    error.value = ''
    
    try {
      const settingsRef = doc(db, 'settings', 'global')
      await setDoc(settingsRef, {
        anonymousUserMode: globalSettings.value.anonymousUserMode,
        useHeadlessBrowser: globalSettings.value.useHeadlessBrowser,
        lastUpdated: serverTimestamp(),
        updatedBy: authService.getUserId()
      }, { merge: true })
      
      success.value = 'Settings saved successfully'
      setTimeout(() => { success.value = '' }, 3000)
    } catch (err) {
      console.error('Error saving global settings:', err)
      error.value = err.message || 'Failed to save settings'
    } finally {
      isSavingSettings.value = false
    }
  }
  
  return {
    // State
    isOpen,
    activeTab,
    isLoading,
    error,
    success,
    champions,
    searchTerm,
    roleFilter,
    selectedChampion,
    isEditModalOpen,
    editedChampion,
    opTierChampions,
    opTierSearchTerm,
    migrationStatus,
    globalSettings,
    isSavingSettings,
    isEditorModeActive,
    selectedChampionForEditor,
    isOpTierEditorModalOpen,
    opTierEditorChampion,
    validRoles,
    // Computed
    filteredChampions,
    filteredChampionsForOpTier,
    newChampionsCount,
    // Actions
    open,
    close,
    toggleEditorMode,
    setEditorMode,
    setSelectedChampionForEditor,
    clearSelectedChampionForEditor,
    openOpTierEditorModal,
    closeOpTierEditorModal,
    loadData,
    loadApiChampionsForEditor,
    openEditModal,
    closeEditModal,
    toggleRole,
    setMainRole,
    saveChampion,
    toggleOpTier,
    isOpForRole,
    saveOpTierChanges,
    exportChampionData,
    importChampionData,
    migrateFromChampionsJs,
    loadGlobalSettings,
    saveGlobalSettings,
    // Helpers
    isNewChampion,
    getSortedRoles,
    getRolesDisplay
  }
})


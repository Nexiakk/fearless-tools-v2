<template>
  <div>
    <!-- Show skeleton when workspace is loading OR when workspace exists OR when saved workspace exists -->
    <div v-if="showSkeletonContainer" class="container-fluid mx-auto p-6" :class="{ 'p-8': !shouldShowBannedChampions, 'p-6': shouldShowBannedChampions }">
      <!-- Editor Mode Bottom Border -->
      <div v-if="adminStore.isEditorModeActive && workspaceStore.hasWorkspace" class="editor-mode-banner-bottom-line"></div>
      
      <!-- Skeleton Loader - Show when workspace/champions/draft data is loading -->
      <Transition name="fade" mode="out-in">
        <ChampionPoolSkeleton v-if="isLoading" key="skeleton" />
        
        <!-- Actual Content - Show only when workspace exists and all data is loaded -->
        <div v-else-if="workspaceStore.hasWorkspace" key="content" class="pool-main-area">
          <!-- Banned Champions Container -->
          <div 
            v-if="shouldShowBannedChampions" 
            class="banned-champions-container"
          >
            <ChampionCard
              v-for="champion in bannedChampionsList"
              :key="`banned-${champion.id}`"
              :champion="champion"
              role=""
              :search-match="championSearchStore.isSearchActive ? championSearchStore.matchesSearch(champion.name) : true"
            />
          </div>
          
          <div 
            class="compact-view-container" 
            :class="{ ...viewClasses, 'search-active': isSearchActive, 'has-banned': bannedChampionsList.length > 0 }"
            :style="cardSizeStyles"
          >
            <RolePillar
              v-for="role in roles"
              :key="role"
              :role="role"
              :champions="championsByRole[role]"
              :ref="(el) => setPillarRef(el, role)"
            />
          </div>
        </div>
      </Transition>
      
      <!-- Champion Info Modal (for Editor Mode) -->
      <ChampionInfoModal
        v-if="workspaceStore.hasWorkspace"
        :is-open="isChampionInfoModalOpen"
        :champion="adminStore.selectedChampionForEditor"
        @close="closeChampionInfoModal"
      />
    </div>
    
    <!-- Show "join workspace" only when not loading and no workspace -->
    <div v-else class="flex items-center justify-center h-screen">
      <p class="text-gray-400">Please join a workspace to continue</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useWorkspaceStore } from '@/stores/workspace'
import { useDraftStore } from '@/stores/draft'
import { useChampionsStore } from '@/stores/champions'
import { useSettingsStore } from '@/stores/settings'
import { useAdminStore } from '@/stores/admin'
import { useChampionSearchStore } from '@/stores/championSearch'
import { workspaceService } from '@/services/workspace'
import RolePillar from '@/components/champion-pool/RolePillar.vue'
import ChampionInfoModal from '@/components/champion-pool/ChampionInfoModal.vue'
import ChampionPoolSkeleton from '@/components/champion-pool/ChampionPoolSkeleton.vue'
import ChampionCard from '@/components/champion-pool/ChampionCard.vue'

const workspaceStore = useWorkspaceStore()
const draftStore = useDraftStore()
const championsStore = useChampionsStore()
const settingsStore = useSettingsStore()
const adminStore = useAdminStore()

// Get search active state for CSS class - use storeToRefs to ensure reactivity
const championSearchStore = useChampionSearchStore()
const { isSearchActive, searchQuery } = storeToRefs(championSearchStore)

// Store pillar refs for scrolling
const pillarRefs = ref(new Map()) // Map of role -> RolePillar component instance

const setPillarRef = (el, role) => {
  if (el) {
    pillarRefs.value.set(role, el)
  }
}

const roles = ['top', 'jungle', 'middle', 'bottom', 'support']

// Check if there's a saved workspace synchronously (to avoid flash of "join workspace" message)
let initialSavedWorkspace = false
if (typeof window !== 'undefined') {
  initialSavedWorkspace = !!workspaceService.getCurrentWorkspaceId()
}
const hasSavedWorkspace = ref(initialSavedWorkspace)

const championsByRole = computed(() => {
  return draftStore.championsByRoleForCompactView
})

// Get all banned champions as a list
const bannedChampionsList = computed(() => {
  const allBanned = new Set()

  // Combine manually banned and LCU banned
  draftStore.bannedChampions.forEach(champ => allBanned.add(champ))
  draftStore.lcuBannedChampions.forEach(champ => allBanned.add(champ))

  // Convert to champion objects, sorted alphabetically
  return (championsStore.allChampions || [])
    .filter(champ => allBanned.has(champ.name))
    .sort((a, b) => a.name.localeCompare(b.name))
})

// Determine if banned champions container should be shown
const shouldShowBannedChampions = computed(() => {
  return bannedChampionsList.value.length > 0 && settingsStore.settings.pool.showBannedChampions
})

const viewClasses = computed(() => ({
  'compact-mode': settingsStore.settings.pool.compactMode,
  'no-animations': settingsStore.settings.pool.disableAnimations,
  'center-cards': settingsStore.settings.pool.centerCards
}))

const cardSizeStyles = computed(() => {
  const normalSize = settingsStore.settings.pool.normalCardSize || 100
  const highlightSize = settingsStore.settings.pool.highlightCardSize || 100
  const unavailableSize = settingsStore.settings.pool.unavailableCardSize || 83
  
  return {
    '--normal-card-scale': normalSize / 100,
    '--highlight-card-scale': highlightSize / 100,
    '--unavailable-card-scale': unavailableSize / 100,
    '--normal-font-scale': normalSize / 100,
    '--highlight-font-scale': highlightSize / 100,
    '--unavailable-font-scale': unavailableSize / 100
  }
})

// Champion Info Modal state
const isChampionInfoModalOpen = computed(() => {
  return adminStore.selectedChampionForEditor !== null
})

const closeChampionInfoModal = () => {
  adminStore.clearSelectedChampionForEditor()
}

// Combined loading state - show skeleton until workspace, champions, and draft data are all loaded
const isLoading = computed(() => {
  return workspaceStore.isLoading || championsStore.isLoading || draftStore.isLoading || (hasSavedWorkspace.value && !workspaceStore.hasWorkspace)
})

// Show skeleton container if loading, has workspace, has saved workspace, or still initializing
const showSkeletonContainer = computed(() => {
  return workspaceStore.isInitializing || isLoading.value || workspaceStore.hasWorkspace || hasSavedWorkspace.value || workspaceStore.isWorkspaceModalOpen
})

// Watch for when workspace is loaded to update hasSavedWorkspace
watch(() => workspaceStore.hasWorkspace, (hasWorkspace) => {
  if (hasWorkspace) {
    hasSavedWorkspace.value = false
  }
})

// Debounce function for scroll
let scrollTimeout = null

// Auto-scroll to matching champions when searching
watch(searchQuery, async (newQuery) => {
  // Clear any pending scroll
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
  
  if (!newQuery || !newQuery.trim() || !championSearchStore.isSearchActive) {
    return
  }
  
  // Debounce scrolling to avoid excessive scrolling while typing
  scrollTimeout = setTimeout(async () => {
    // Wait for DOM to update
    await nextTick()
    
    // Find all champions that match the search
    const matchingChampions = (championsStore.allChampions || []).filter(champ =>
      championSearchStore.matchesSearch(champ.name)
    )
    
    if (matchingChampions.length === 0) return
    
    // For each role, check if any matching champion exists in that role
    for (const role of roles) {
      const pillar = pillarRefs.value.get(role)
      if (!pillar || !pillar.scrollToChampion) continue
      
      // Get champions for this role from championsByRole
      const roleChampions = championsByRole.value[role]
      if (!roleChampions) continue
      
      // Check if this role contains any matching champion
      let roleHasMatchingChampion = false
      let matchingChampionInRole = null
      
      if (Array.isArray(roleChampions)) {
        // Non-frozen view: simple array
        matchingChampionInRole = roleChampions.find(champ => 
          championSearchStore.matchesSearch(champ.name)
        )
        roleHasMatchingChampion = !!matchingChampionInRole
      } else if (roleChampions.sticky || roleChampions.scrollable) {
        // Frozen view: check both sticky and scrollable
        const allRoleChampions = [
          ...(roleChampions.sticky || []),
          ...(roleChampions.scrollable || [])
        ]
        matchingChampionInRole = allRoleChampions.find(champ => 
          championSearchStore.matchesSearch(champ.name)
        )
        roleHasMatchingChampion = !!matchingChampionInRole
      }
      
      // Only scroll if this role actually contains a matching champion
      if (roleHasMatchingChampion && matchingChampionInRole) {
        setTimeout(() => {
          pillar.scrollToChampion(matchingChampionInRole.name)
        }, 50 * roles.indexOf(role))
      }
    }
  }, 300) // 300ms debounce
})
</script>

<style scoped>
/* Fast fade transition for skeleton to content - instant response to data loading */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

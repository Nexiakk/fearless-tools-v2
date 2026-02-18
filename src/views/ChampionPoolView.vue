<template>
  <div>
    <!-- Show skeleton when workspace is loading OR when workspace exists OR when saved workspace exists -->
    <div v-if="showSkeletonContainer" class="container-fluid mx-auto p-6">
      <!-- Editor Mode Bottom Border -->
      <div v-if="adminStore.isEditorModeActive && workspaceStore.hasWorkspace" class="editor-mode-banner-bottom-line"></div>
      
      <!-- Skeleton Loader - Show when workspace/champions/draft data is loading -->
      <Transition name="fade" mode="out-in">
        <ChampionPoolSkeleton v-if="isLoading" key="skeleton" />
        
        <!-- Actual Content - Show only when workspace exists and all data is loaded -->
        <div v-else-if="workspaceStore.hasWorkspace" key="content" class="pool-main-area" :style="pageContentScaleStyle">
          <!-- Event History - Left Side -->
          <EventHistory v-if="settingsStore.settings.pool.showEventHistory" />

          <!-- Main Content Area -->
          <div class="pool-content-area">
            <!-- Tier Selector (shown in editor mode) -->
            <TierSelector @open-tier-manager="openTierManager" />

            <!-- Role Pillars Container -->
            <div
              class="compact-view-container"
              :class="{ ...viewClasses, 'search-active': isSearchActive, 'editor-mode': adminStore.isEditorModeActive }"
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
        </div>
      </Transition>
      
      <!-- Champion Info Modal (for Editor Mode) -->
      <ChampionInfoModal
        v-if="workspaceStore.hasWorkspace"
        :is-open="isChampionInfoModalOpen"
        :champion="adminStore.selectedChampionForEditor"
        @close="closeChampionInfoModal"
      />

      <!-- Tier Manager Modal -->
      <TierManagerModal
        v-if="workspaceStore.hasWorkspace"
        :is-open="isTierManagerModalOpen"
        @close="closeTierManagerModal"
      />

      <!-- Champion Stats Modal (Bottom Drawer) -->
      <ChampionStatsModal v-if="workspaceStore.hasWorkspace" />
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
import { useWorkspaceTiersStore } from '@/stores/workspaceTiers'
import { workspaceService } from '@/services/workspace'
import RolePillar from '@/components/champion-pool/RolePillar.vue'
import ChampionInfoModal from '@/components/champion-pool/ChampionInfoModal.vue'
import ChampionPoolSkeleton from '@/components/champion-pool/ChampionPoolSkeleton.vue'
import ChampionCard from '@/components/champion-pool/ChampionCard.vue'
import TierSelector from '@/components/champion-pool/TierSelector.vue'
import TierManagerModal from '@/components/champion-pool/TierManagerModal.vue'
import EventHistory from '@/components/champion-pool/EventHistory.vue'
import ChampionStatsModal from '@/components/champion-pool/ChampionStatsModal.vue'

const workspaceStore = useWorkspaceStore()
const draftStore = useDraftStore()
const championsStore = useChampionsStore()
const settingsStore = useSettingsStore()
const adminStore = useAdminStore()
const workspaceTiersStore = useWorkspaceTiersStore()

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

// Get the unavailable champions grouping setting
const unavailableGrouping = computed(() => {
  return settingsStore.settings.pool.unavailableChampionsGrouping || 'top'
})

const championsByRole = computed(() => {
  const baseChampionsByRole = draftStore.championsByRoleForCompactView

  // Create a sorted version that prioritizes tier champions
  const sortedChampionsByRole = {}

  for (const role of roles) {
    const roleChampions = baseChampionsByRole[role]

    if (Array.isArray(roleChampions)) {
      // Non-frozen view: sort and filter champions based on grouping setting
      sortedChampionsByRole[role] = sortAndFilterChampions(roleChampions, role)
    } else if (roleChampions && typeof roleChampions === 'object') {
      // Frozen view: sort and filter both sticky and scrollable arrays
      sortedChampionsByRole[role] = {
        sticky: sortAndFilterChampions(roleChampions.sticky || [], role),
        scrollable: sortAndFilterChampions(roleChampions.scrollable || [], role)
      }
    } else {
      sortedChampionsByRole[role] = roleChampions || []
    }
  }

  return sortedChampionsByRole
})

// Helper function to sort and filter champions based on grouping setting
function sortAndFilterChampions(champions, role) {
  const grouping = unavailableGrouping.value

  // If hidden, filter out unavailable/banned champions
  if (grouping === 'hidden') {
    const filtered = champions.filter(champ => 
      !draftStore.isBannedChampion(champ.name) && !draftStore.isUnavailable(champ.name)
    )
    return sortChampionsByTier(filtered, role)
  }

  // Otherwise sort normally
  return sortChampionsByTier(champions, role)
}

// Helper function to sort champions by priority (banned/unavailable > tier > alphabetical)
function sortChampionsByTier(champions, role) {
  const grouping = unavailableGrouping.value

  return [...champions].sort((a, b) => {
    // Helper function to get priority for a champion
    const getPriority = (champ) => {
      const isUnavailable = draftStore.isBannedChampion(champ.name) || draftStore.isUnavailable(champ.name)

      // Banned and unavailable have highest priority (4) when grouping is 'top'
      // or lowest priority (-1) when grouping is 'bottom'
      if (isUnavailable) {
        return grouping === 'bottom' ? -1 : 4
      }

      // Check for tier assignment per role (3)
      const tier = workspaceTiersStore.getTierForChampion(champ.name, role)
      if (tier) return 3 - (tier.order * 0.1) // Higher tiers get higher priority
      if (championsStore.isOpForRole(champ.name, role)) return 2

      return 0
    }

    const priorityA = getPriority(a)
    const priorityB = getPriority(b)

    if (priorityA !== priorityB) return priorityB - priorityA
    return (a.name || '').localeCompare(b.name || '')
  })
}





const viewClasses = computed(() => ({
  'compact-mode': settingsStore.settings.pool.compactMode,
  'no-animations': settingsStore.settings.pool.disableAnimations,
  'center-cards': settingsStore.settings.pool.centerCards
}))

// Separate computed property for page content scale to apply to pool-main-area
const pageContentScaleStyle = computed(() => {
  const pageContentScale = settingsStore.settings.pool.pageContentScale || 100
  return {
    '--page-content-scale': pageContentScale / 100
  }
})

const cardSizeStyles = computed(() => {
  const normalSize = settingsStore.settings.pool.normalCardSize || 100
  const highlightSize = settingsStore.settings.pool.highlightCardSize || 100
  const unavailableSize = settingsStore.settings.pool.unavailableCardSize || 83
  
  const styles = {
    '--normal-card-scale': normalSize / 100,
    '--highlight-card-scale': highlightSize / 100,
    '--unavailable-card-scale': unavailableSize / 100,
    '--normal-font-scale': normalSize / 100,
    '--highlight-font-scale': highlightSize / 100,
    '--unavailable-font-scale': unavailableSize / 100
  }
  
  // Add per-tier CSS variables when using per-tier sizing
  const useGlobal = settingsStore.settings.pool.useGlobalTierSize
  const tierSizes = settingsStore.settings.pool.tierCardSizes
  
  workspaceTiersStore.sortedTiers.forEach(tier => {
    const tierSize = useGlobal 
      ? highlightSize 
      : (tierSizes[tier.id] || highlightSize)
    styles[`--tier-${tier.id}-scale`] = tierSize / 100
  })
  
  return styles
})

// Champion Info Modal state
const isChampionInfoModalOpen = computed(() => {
  return adminStore.selectedChampionForEditor !== null
})

const closeChampionInfoModal = () => {
  adminStore.clearSelectedChampionForEditor()
}

// Tier Manager Modal state
const isTierManagerModalOpen = ref(false)

const openTierManager = () => {
  isTierManagerModalOpen.value = true
}

const closeTierManagerModal = () => {
  isTierManagerModalOpen.value = false
}

// Combined loading state - show skeleton until workspace, champions, and draft data are all loaded
const isLoading = computed(() => {
  return workspaceStore.isLoading || championsStore.isLoading || draftStore.isLoading || (hasSavedWorkspace.value && !workspaceStore.hasWorkspace)
})

// Show skeleton container if loading, has workspace, has saved workspace, or still initializing
const showSkeletonContainer = computed(() => {
  return workspaceStore.isInitializing || isLoading.value || workspaceStore.hasWorkspace || hasSavedWorkspace.value || workspaceStore.isWorkspaceModalOpen
})

// Watch for when workspace is loaded to update hasSavedWorkspace and initialize tiers
watch(() => workspaceStore.hasWorkspace, async (hasWorkspace) => {
  if (hasWorkspace) {
    hasSavedWorkspace.value = false
    // Initialize workspace tiers when workspace loads
    await workspaceTiersStore.initialize()
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

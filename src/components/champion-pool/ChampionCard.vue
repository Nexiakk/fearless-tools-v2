<template>
  <div
    class="compact-champion-card"
    :class="cardClasses"
    :style="{ ...tierCardStyle, ...hoverStyle }"
    @click="handleClick($event)"
    @contextmenu.prevent="handleRightClick"

    :title="champion.name"
  >
    <div class="compact-champion-icon-wrapper">
      <img
        class="compact-champion-icon"
        :src="championIconUrl"
        :alt="champion.name"
        :style="tierIconStyle"
        draggable="false"
      />
      <div class="champion-icon-corners"></div>
      <!-- Banned indicator -->
      <div v-if="isBanned" class="banned-indicator">
        <svg viewBox="0 0 24 24" class="banned-icon">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
          <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
    </div>
    <span class="compact-champion-name">{{ champion.name }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useChampionsStore } from '@/stores/champions'
import { useDraftStore } from '@/stores/draft'
import { useAdminStore } from '@/stores/admin'
import { useWorkspaceTiersStore } from '@/stores/workspaceTiers'

const props = defineProps({
  champion: {
    type: Object,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  searchMatch: {
    type: Boolean,
    default: true
  }
})

const championsStore = useChampionsStore()
const draftStore = useDraftStore()
const adminStore = useAdminStore()
const workspaceTiersStore = useWorkspaceTiersStore()

const championIconUrl = computed(() =>
  championsStore.getChampionIconUrl(props.champion.name, 'creator-pool')
)

const isBanned = computed(() => draftStore.isBannedChampion(props.champion.name))

const cardClasses = computed(() => {
  const classes = {
    banned: isBanned.value,
    unavailable: draftStore.isUnavailable(props.champion.name) && !isBanned.value,
    'op-tier': championsStore.isOpForRole(props.champion.name, props.role) &&
      !draftStore.isUnavailable(props.champion.name) && !isBanned.value,

    'editor-mode': adminStore.isEditorModeActive,
    'search-match': props.searchMatch,
    'search-blur': !props.searchMatch
  }

  // Add tier-selected class when editor mode is active and a tier is selected
  if (adminStore.isEditorModeActive && workspaceTiersStore.selectedTier) {
    classes['tier-selected'] = true
  }

  // Add tier sizing class for highlight card scale
  const tier = workspaceTiersStore.getTierForChampion(props.champion.name, props.role)
  if (tier && !isBanned.value && !draftStore.isUnavailable(props.champion.name)) {
    classes['tier-highlight-size'] = true
    // Add tier-specific class for per-tier sizing (e.g., tier-op, tier-highlight)
    classes[`tier-${tier.id}`] = true
  }

  return classes
})

// Dynamic tier styling - applies to all champions regardless of availability
const tierIconStyle = computed(() => {
  const tier = workspaceTiersStore.getTierForChampion(props.champion.name, props.role)
  if (!tier) return {}

  if (tier.style === 'border') {
    // Match existing OP tier: border: 2px solid #d97706
    return { border: `2px solid ${tier.color}` }
  } else if (tier.style === 'highlight') {
    // Match existing manually-marked: border + shadow
    return {
      border: `2px solid ${tier.color}CC`,  // CC = 0.8 opacity
      boxShadow: `0 0 4px 1px ${tier.color}99`  // 99 = 0.6 opacity
    }
  } else {
    // Shadow style - same as highlight: border + glow shadow
    return {
      border: `2px solid ${tier.color}CC`,  // CC = 0.8 opacity
      boxShadow: `0 0 4px 1px ${tier.color}99`  // 99 = 0.6 opacity
    }
  }
})

// Card-level tier styling (for future use if needed)
const tierCardStyle = computed(() => {
  // Currently empty, but can be used for card-level tier effects
  return {}
})

// Dynamic hover styling based on editor mode and selected tier
const hoverStyle = computed(() => {
  if (!adminStore.isEditorModeActive) {
    // Normal mode: default gold hover (handled by CSS)
    return {}
  }

  if (!workspaceTiersStore.selectedTier) {
    // Editor mode but no tier selected: default gold hover
    return {}
  }

  // Editor mode with selected tier: use tier color
  const selectedTier = workspaceTiersStore.selectedTier
  return {
    '--hover-color': selectedTier.color,
    '--hover-shadow-color': selectedTier.color + '66', // 0.4 alpha
    '--hover-border-color': selectedTier.color + '99',  // 0.6 alpha
    '--gold-hover-color': selectedTier.color  // Make gold hover reactive to tier color
  }
})

const handleClick = (event) => {
  // Check for shift+click to open detailed stats modal
  if (event.shiftKey) {
    openChampionStatsModal()
    return
  }

  if (adminStore.isEditorModeActive) {
    // In editor mode, assign/remove tier instead of opening modal
    const workspaceTiersStore = useWorkspaceTiersStore()
    if (workspaceTiersStore.selectedTier) {
      // Toggle champion assignment to selected tier
      const tier = workspaceTiersStore.getTierForChampion(props.champion.name, props.role)
      if (tier && tier.id === workspaceTiersStore.selectedTier.id) {
        // Remove from current tier for this role
        workspaceTiersStore.removeChampionFromTier(props.champion.name, tier.id, props.role)
      } else {
        // Assign to selected tier for this role
        workspaceTiersStore.assignChampionToTier(props.champion.name, workspaceTiersStore.selectedTier.id, props.role)
      }
    } else {
      // No tier selected, open champion info modal as fallback
      adminStore.setSelectedChampionForEditor(props.champion)
    }
  } else {
    // Normal mode: toggle pick (but not for LCU unavailable or banned champions)
    if (!draftStore.isLcuUnavailable(props.champion.name) && !isBanned.value) {
      draftStore.togglePick(props.champion.name, props.role)
    }
  }
}

const openChampionStatsModal = async () => {
  // Lazy load the modal component
  const { useChampionStatsModalStore } = await import('@/stores/championStatsModal')
  const modalStore = useChampionStatsModalStore()

  // Set the champion and open the modal, passing the role from which champion was clicked
  modalStore.openModal(props.champion, props.role)
}

const handleRightClick = () => {
  if (!adminStore.isEditorModeActive) {
    // Right click: toggle ban (but not for LCU banned champions)
    if (!draftStore.isLcuBanned(props.champion.name)) {
      draftStore.toggleBan(props.champion.name)
    }
  }
}


</script>

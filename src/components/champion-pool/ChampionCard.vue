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
  },
  groupedMode: {
    type: Boolean,
    default: false
  },
  tier: {
    type: Object,
    default: null
  },
  neighbors: {
    type: Object,
    default: () => ({
      top: false,
      bottom: false,
      left: false,
      right: false
    })
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
    'search-blur': !props.searchMatch,
    'grouped-tier': props.groupedMode && props.tier
  }

  // Add tier-selected class when editor mode is active and a tier is selected
  if (adminStore.isEditorModeActive && workspaceTiersStore.selectedTier) {
    classes['tier-selected'] = true
  }

  // Add tier sizing class for highlight card scale
  const tier = props.tier || workspaceTiersStore.getTierForChampion(props.champion.name, props.role)
  if (tier && !isBanned.value && !draftStore.isUnavailable(props.champion.name)) {
    classes['tier-highlight-size'] = true
    classes[`tier-${tier.id}`] = true
  }

  return classes
})

// Dynamic tier styling - applies to all champions regardless of availability
const tierIconStyle = computed(() => {
  // Don't show individual tier borders when in grouped mode
  if (props.groupedMode) return {}
  
  const tier = props.tier || workspaceTiersStore.getTierForChampion(props.champion.name, props.role)
  if (!tier) return {}

  switch (tier.style) {
    case 'border':
      return { border: `2px solid ${tier.color}` }
      
    case 'shadow':
    case 'highlight':
      return {
        border: `2px solid ${tier.color}CC`,
        boxShadow: `0 0 4px 1px ${tier.color}99`
      }
      
    case 'solid':
      return {
        border: `2px solid ${tier.color}`,
        backgroundColor: `${tier.color}40`,
        boxShadow: `inset 0 0 0 1px ${tier.color}20`
      }
      
    case 'gradient':
      return {
        border: `2px solid ${tier.color}`,
        background: `linear-gradient(180deg, ${tier.color}30 0%, ${tier.color}10 100%)`,
        boxShadow: `0 2px 8px ${tier.color}20`
      }
      
    case 'underlined':
      return {
        borderBottom: `3px solid ${tier.color}`,
        boxShadow: `0 3px 6px -3px ${tier.color}40`
      }
      
    case 'left-bar':
      return {
        borderLeft: `4px solid ${tier.color}`,
        backgroundColor: `${tier.color}15`
      }
      
    case 'corner-ribbon':
      return {
        borderTop: `2px solid ${tier.color}`,
        borderRight: `2px solid ${tier.color}`,
        borderTopRightRadius: '6px',
        background: `linear-gradient(135deg, ${tier.color}25 0%, transparent 50%)`
      }
      
    case 'glow-pulse':
      return {
        border: `2px solid ${tier.color}`,
        boxShadow: `0 0 8px ${tier.color}80, 0 0 16px ${tier.color}40, 0 0 24px ${tier.color}20`,
        animation: 'tierPulse 2s infinite'
      }
      
    default:
      return { border: `2px solid ${tier.color}` }
  }
})

// Card-level tier styling for grouped blob mode
const tierCardStyle = computed(() => {
  if (!props.groupedMode || !props.tier || isBanned.value || draftStore.isUnavailable(props.champion.name)) return {}
  
  const style = {
    backgroundColor: `${props.tier.color}40`,
    zIndex: 1,
    borderRadius: '0px',
    margin: '0px',
    padding: '0px',
    border: '1px solid transparent',
    boxShadow: `inset 0 0 0 1px ${props.tier.color}70`
  }
  
  // Extend background into gaps while keeping card position unchanged
  if (props.neighbors.left) style.marginLeft = '-4px'
  if (props.neighbors.right) style.marginRight = '-4px'
  if (props.neighbors.top) style.marginTop = '-4px'
  if (props.neighbors.bottom) style.marginBottom = '-4px'
  
  // Compensate padding to keep internal content position
  if (props.neighbors.left) style.paddingLeft = '4px'
  if (props.neighbors.right) style.paddingRight = '4px'
  if (props.neighbors.top) style.paddingTop = '4px'
  if (props.neighbors.bottom) style.paddingBottom = '4px'
  
  // Draw borders only on outer perimeter edges
  if (!props.neighbors.left) style.borderLeft = `2px solid ${props.tier.color}`
  if (!props.neighbors.right) style.borderRight = `2px solid ${props.tier.color}`
  if (!props.neighbors.top) style.borderTop = `2px solid ${props.tier.color}`
  if (!props.neighbors.bottom) style.borderBottom = `2px solid ${props.tier.color}`
  
  // Only apply rounded corners on actual outer edges
  if (!props.neighbors.top && !props.neighbors.left) style.borderTopLeftRadius = '8px'
  if (!props.neighbors.top && !props.neighbors.right) style.borderTopRightRadius = '8px'
  if (!props.neighbors.bottom && !props.neighbors.left) style.borderBottomLeftRadius = '8px'
  if (!props.neighbors.bottom && !props.neighbors.right) style.borderBottomRightRadius = '8px'
  
  return style
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
  // Check for ctrl+click to set matchup comparison
  if (event.ctrlKey) {
    const { useChampionStatsModalStore } = import('@/stores/championStatsModal').then(module => {
      const modalStore = module.useChampionStatsModalStore()
      if (modalStore.isOpen && modalStore.champion) {
        modalStore.setComparingMatchup({ champion: props.champion.name })
      }
    })
    return
  }

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

<style scoped>
@keyframes tierPulse {
  0%, 100% {
    filter: brightness(1);
    box-shadow: 0 0 8px var(--pulse-color, currentColor)
  }
  50% {
    filter: brightness(1.15);
    box-shadow: 0 0 12px var(--pulse-color, currentColor), 0 0 20px var(--pulse-color, currentColor)
  }
}

.compact-champion-card.grouped-tier {
  border-radius: 0;
  margin: 0;
  border: none;
  background-clip: padding-box;
}
</style>
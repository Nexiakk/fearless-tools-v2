<template>
  <div
    class="compact-champion-card"
    :class="cardClasses"
    @click="handleClick"
    @contextmenu.prevent="handleRightClick"
    @mousedown.middle.prevent="handleMiddleClick"
    :title="champion?.name || ''"
  >
    <div class="compact-champion-icon-wrapper">
      <img
        class="compact-champion-icon"
        :src="championIconUrl"
        :alt="champion?.name || ''"
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
    <span class="compact-champion-name">{{ champion?.name || '' }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useChampionsStore } from '@/stores/champions'
import { useDraftStore } from '@/stores/draft'
import { useAdminStore } from '@/stores/admin'

const props = defineProps({
  champion: {
    type: Object,
    required: true
  },
  role: {
    type: String,
    required: true
  }
})

const championsStore = useChampionsStore()
const draftStore = useDraftStore()
const adminStore = useAdminStore()

const championIconUrl = computed(() => {
  if (!props.champion || !props.champion.name) return ''
  return championsStore.getChampionIconUrl(props.champion.name, 'creator-pool')
})

const isBanned = computed(() => {
  if (!props.champion || !props.champion.name) return false
  return draftStore.isBannedChampion(props.champion.name)
})

const cardClasses = computed(() => {
  if (!props.champion || !props.champion.name) return { 'editor-mode': adminStore.isEditorModeActive }
  return {
    banned: isBanned.value,
    unavailable: draftStore.isUnavailable(props.champion.name) && !isBanned.value,
    'op-tier': championsStore.isOpForRole(props.champion.name, props.role) &&
      !draftStore.isUnavailable(props.champion.name) && !isBanned.value,
    'manually-marked': draftStore.isHighlighted(props.champion.name, props.role) &&
      !draftStore.isUnavailable(props.champion.name) && !isBanned.value,
    'editor-mode': adminStore.isEditorModeActive
  }
})

const handleClick = () => {
  if (!props.champion || !props.champion.name) return
  if (adminStore.isEditorModeActive) {
    // In editor mode, open champion info modal
    adminStore.setSelectedChampionForEditor(props.champion)
  } else {
    // Normal mode: toggle pick (but not for LCU unavailable or banned champions)
    if (!draftStore.isLcuUnavailable(props.champion.name) && !isBanned.value) {
      draftStore.togglePick(props.champion.name, props.role)
    }
  }
}

const handleRightClick = () => {
  if (!props.champion || !props.champion.name) return
  if (!adminStore.isEditorModeActive) {
    // Right click: toggle ban (but not for LCU banned champions)
    if (!draftStore.isLcuBanned(props.champion.name)) {
      draftStore.toggleBan(props.champion.name)
    }
  }
}

const handleMiddleClick = () => {
  if (!props.champion || !props.champion.name) return
  if (!adminStore.isEditorModeActive) {
    // Middle click: toggle highlight
    draftStore.toggleHighlight(props.champion.name, props.role)
  }
}
</script>

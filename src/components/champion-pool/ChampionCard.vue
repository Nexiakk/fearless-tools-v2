<template>
  <div
    class="compact-champion-card"
    :class="cardClasses"
    @click="handleClick"
    @contextmenu.prevent="handleRightClick"
    :title="champion.name"
  >
    <div class="compact-champion-icon-wrapper">
      <img
        class="compact-champion-icon"
        :src="championIconUrl"
        :alt="champion.name"
        draggable="false"
      />
      <div class="champion-icon-corners"></div>
    </div>
    <span class="compact-champion-name">{{ champion.name }}</span>
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

const championIconUrl = computed(() =>
  championsStore.getChampionIconUrl(props.champion.name, 'creator-pool')
)

const cardClasses = computed(() => ({
  unavailable: draftStore.isUnavailable(props.champion.name),
  'op-tier': championsStore.isOpForRole(props.champion.name, props.role) &&
    !draftStore.isUnavailable(props.champion.name),
  'manually-marked': draftStore.isHighlighted(props.champion.name, props.role) &&
    !draftStore.isUnavailable(props.champion.name),
  'editor-mode': adminStore.isEditorModeActive
}))

const handleClick = () => {
  if (adminStore.isEditorModeActive) {
    // In editor mode, open champion info modal
    adminStore.setSelectedChampionForEditor(props.champion)
  } else {
    // Normal mode: toggle pick
    draftStore.togglePick(props.champion.name, props.role)
  }
}

const handleRightClick = () => {
  if (!adminStore.isEditorModeActive) {
    // Only allow highlight toggle when not in editor mode
    draftStore.toggleHighlight(props.champion.name, props.role)
  }
}
</script>



<template>
  <div class="role-pillar">
    <img :src="roleIconUrl" :alt="role" class="pillar-header-icon" />
    
    <!-- Frozen Champions View (sticky + scrollable) -->
    <div v-if="isFrozenView" class="pillar-champions-grid">
      <div class="sticky-champions-container">
        <ChampionCard
          v-for="champion in stickyChampions"
          :key="`${champion.id}-${role}-sticky`"
          :champion="champion"
          :role="role"
          :search-match="championSearchStore.isSearchActive ? championSearchStore.matchesSearch(champion.name) : true"
        />
      </div>
      <div class="scrollable-champions-container">
        <ChampionCard
          v-for="champion in scrollableChampions"
          :key="`${champion.id}-${role}-scrollable`"
          :champion="champion"
          :role="role"
          :search-match="championSearchStore.isSearchActive ? championSearchStore.matchesSearch(champion.name) : true"
        />
      </div>
    </div>
    
    <!-- Non-Frozen View (single list) -->
    <div v-else class="pillar-champions-grid fluid tier-cluster-grid">
      <ChampionCard
        v-for="(champion, index) in allChampions"
        :key="`${champion.id}-${role}`"
        :champion="champion"
        :role="role"
        :search-match="championSearchStore.isSearchActive ? championSearchStore.matchesSearch(champion.name) : true"
        :grouped-mode="settingsStore.settings.pool.tierDisplayMode === 'grouped-blocks'"
        :tier="getTierForIndex(index)"
        :neighbors="getNeighbors(index)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useChampionsStore } from '@/stores/champions'
import { useSettingsStore } from '@/stores/settings'
import { useChampionSearchStore } from '@/stores/championSearch'
import { useWorkspaceTiersStore } from '@/stores/workspaceTiers'
import { useDraftStore } from '@/stores/draft'
import ChampionCard from './ChampionCard.vue'

const props = defineProps({
  role: {
    type: String,
    required: true
  },
  champions: {
    type: Object,
    required: true
  }
})

const championsStore = useChampionsStore()
const settingsStore = useSettingsStore()
const championSearchStore = useChampionSearchStore()
const workspaceTiersStore = useWorkspaceTiersStore()
const draftStore = useDraftStore()

const roleIconSvg = computed(() => championsStore.getRoleIconSvg(props.role))
const roleIconUrl = computed(() => championsStore.getRoleIconUrl(props.role))

const isFrozenView = computed(() => {
  // Check if champions object has sticky/scrollable structure
  return props.champions && typeof props.champions === 'object' && 'sticky' in props.champions
})

const stickyChampions = computed(() => {
  if (isFrozenView.value) {
    return props.champions.sticky || []
  }
  return []
})

const scrollableChampions = computed(() => {
  if (isFrozenView.value) {
    return props.champions.scrollable || []
  }
  return []
})

const allChampions = computed(() => {
  if (!isFrozenView.value) {
    return Array.isArray(props.champions) ? props.champions : []
  }
  return []
})

const tierAssignments = computed(() => {
  return allChampions.value.map(champion => 
    workspaceTiersStore.getTierForChampion(champion.name, props.role)
  )
})

function getTierForIndex(index) {
  return tierAssignments.value[index]
}

function isChampionAvailable(champion) {
  return !draftStore.isUnavailable(champion.name) && !draftStore.isBannedChampion(champion.name)
}

function getNeighbors(index) {
  const total = allChampions.value.length
  const currentTierId = tierAssignments.value[index]?.id
  const currentChampion = allChampions.value[index]
  
  // Don't group unavailable champions
  if (!isChampionAvailable(currentChampion)) {
    return { top: false, bottom: false, left: false, right: false }
  }
  
  // Grid has 5 columns
  const cols = 5
  const row = Math.floor(index / cols)
  const col = index % cols
  
  const checkNeighbor = (neighborIndex) => {
    if (neighborIndex < 0 || neighborIndex >= total) return false
    const neighborChampion = allChampions.value[neighborIndex]
    return isChampionAvailable(neighborChampion) && tierAssignments.value[neighborIndex]?.id === currentTierId
  }
  
  return {
    top: checkNeighbor(index - cols),
    bottom: checkNeighbor(index + cols),
    left: checkNeighbor(index - 1),
    right: checkNeighbor(index + 1)
  }
}
</script>

<style scoped>
.tier-cluster-grid {
  gap: 4px 4px !important;
  padding: 8px !important;
}
</style>
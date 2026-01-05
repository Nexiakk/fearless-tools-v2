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
        />
      </div>
      <div class="scrollable-champions-container">
        <ChampionCard
          v-for="champion in scrollableChampions"
          :key="`${champion.id}-${role}-scrollable`"
          :champion="champion"
          :role="role"
        />
      </div>
    </div>
    
    <!-- Non-Frozen View (single list) -->
    <div v-else class="pillar-champions-grid fluid">
      <ChampionCard
        v-for="champion in allChampions"
        :key="`${champion.id}-${role}`"
        :champion="champion"
        :role="role"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useChampionsStore } from '@/stores/champions'
import { useSettingsStore } from '@/stores/settings'
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
</script>

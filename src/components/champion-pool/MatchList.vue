<template>
  <div class="match-list" :class="{ 'is-compact': compact }">
    <div v-if="drafts.length === 0" class="empty-state">
      <span class="text-gray-500">{{ compact ? '-' : 'No matches recorded' }}</span>
    </div>

    <!-- Compact Mode: Stack of Mini Grids -->
    <template v-if="compact">
      <div 
        v-for="(draft, index) in drafts" 
        :key="draft.id || index"
        class="compact-match-preview"
      >
        <div class="mini-grid-label">G{{ extractGameNumber(draft.id) || (index + 1) }}</div>
        <div class="mini-grid-container">
          <!-- Blue Side Column -->
          <div class="mini-col blue-col">
            <div 
              v-for="i in 5" 
              :key="`b-${i}`" 
              class="mini-slot"
            >
              <img 
                v-if="getPicks(draft, 'blue')[i-1]"
                :src="getChampionIconUrl(getPicks(draft, 'blue')[i-1])"
                class="mini-icon"
              />
            </div>
          </div>
          <!-- Red Side Column -->
          <div class="mini-col red-col">
            <div 
              v-for="i in 5" 
              :key="`r-${i}`" 
              class="mini-slot"
            >
              <img 
                v-if="getPicks(draft, 'red')[i-1]"
                :src="getChampionIconUrl(getPicks(draft, 'red')[i-1])"
                class="mini-icon"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Detailed Mode: Full Cards -->
    <template v-else>
      <MatchCard 
        v-for="(draft, index) in drafts" 
        :key="draft.id || index"
        :draft="draft"
        :game-number="extractGameNumber(draft.id) || (index + 1)"
      />
    </template>
  </div>
</template>

<script setup>
import { useChampionsStore } from '@/stores/champions'
import MatchCard from './MatchCard.vue'

const props = defineProps({
  drafts: {
    type: Array,
    required: true
  },
  compact: {
    type: Boolean,
    default: false
  }
})

const championsStore = useChampionsStore()

function getChampionIconUrl(championName) {
  return championsStore.getChampionIconUrl(championName, 'small-icon')
}

// Helper: Extract picks from draft object safely
function getPicks(draft, side) {
  if (!draft) return []
  const sideObj = side === 'blue' ? draft.blueSide : draft.redSide
  if (!sideObj) return []
  
  // Prefer pickEvents order if available, else static picks array
  if (sideObj.pickEvents && sideObj.pickEvents.length > 0) {
    return sideObj.pickEvents.map(e => {
      // Resolve ID to Name for icon URL
      const champ = championsStore.allChampions.find(c => c.id === e.championId)
      return champ ? champ.name : null
    }).filter(Boolean)
  }
  
  // Fallback to static array (IDs)
  return (sideObj.picks || []).map(id => {
      const champ = championsStore.allChampions.find(c => c.id === id)
      return champ ? champ.name : null
    }).filter(Boolean)
}

// Helper from original file
function extractGameNumber(draftId) {
  if (!draftId) return 0;
  const match = draftId.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}
</script>

<style scoped>
.match-list {
  padding: 12px;
  padding-right: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.match-list.is-compact {
  padding: 8px 4px;
  gap: 12px; /* More space between games */
  align-items: center;
}

.empty-state {
  display: flex;
  justify-content: center;
  padding: 20px;
  font-size: 0.9rem;
  font-style: italic;
}

.match-list.is-compact .empty-state {
  padding: 10px;
}

/* Mini Grid Styles */
.compact-match-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
}

.mini-grid-label {
  font-size: 0.7rem;
  color: #6b7280;
  font-weight: 700;
}

.mini-grid-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  width: 50px; /* Width for 2 cols of ~24px */
}

.mini-col {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.mini-slot {
  width: 24px;
  height: 24px;
  background-color: #1a1a1a;
  border-radius: 2px;
  overflow: hidden;
  border: 1px solid #333;
}

.blue-col .mini-slot {
  border-color: rgba(59, 130, 246, 0.3);
}

.red-col .mini-slot {
  border-color: rgba(239, 68, 68, 0.3);
}

.mini-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>

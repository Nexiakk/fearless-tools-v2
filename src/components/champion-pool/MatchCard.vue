<template>
  <div class="match-card">
    <div class="match-header">
      <span class="game-label">Game {{ gameNumber }}</span>
    </div>
    
    <div class="match-content">
      <!-- Blue Side -->
      <div class="team-section blue-team">
        <!-- Bans (Left) -->
        <div class="bans-col">
           <div 
             v-for="(ban, index) in blueBans" 
             :key="`blue-ban-${index}`"
             class="ban-wrapper"
           >
             <div class="ban-slot">
               <img 
                  v-if="ban.championName" 
                  :src="getIcon(ban.championName)" 
                  class="ban-img"
                  :title="ban.championName + ' (Ban)'"
               />
             </div>
             <!-- Phase Separator after 3rd ban (index 2) -->
             <div v-if="index === 2" class="ban-separator"></div>
           </div>
        </div>

        <!-- Picks (Right) -->
        <div class="picks-col">
           <div 
             v-for="(pick, index) in bluePicks" 
             :key="`blue-${index}`"
             class="pick-slot"
             :class="{ filled: pick.championName }"
           >
             <img 
                v-if="pick.championName" 
                :src="getIcon(pick.championName)" 
                class="pick-img" 
                :title="pick.championName"
              />
           </div>
        </div>
      </div>

      <!-- Red Side -->
      <div class="team-section red-team">
        <!-- Picks (Left) -->
        <div class="picks-col">
           <div 
             v-for="(pick, index) in redPicks" 
             :key="`red-${index}`"
             class="pick-slot"
             :class="{ filled: pick.championName }"
           >
             <img 
                v-if="pick.championName" 
                :src="getIcon(pick.championName)" 
                class="pick-img" 
                :title="pick.championName"
              />
           </div>
        </div>

        <!-- Bans (Right) -->
        <div class="bans-col">
           <div 
             v-for="(ban, index) in redBans" 
             :key="`red-ban-${index}`"
             class="ban-wrapper"
           >
             <div class="ban-slot">
               <img 
                  v-if="ban.championName" 
                  :src="getIcon(ban.championName)" 
                  class="ban-img"
                  :title="ban.championName + ' (Ban)'"
               />
             </div>
             <!-- Phase Separator after 3rd ban (index 2) -->
             <div v-if="index === 2" class="ban-separator"></div>
           </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useChampionsStore } from '@/stores/champions'

const props = defineProps({
  draft: {
    type: Object,
    required: true
  },
  gameNumber: {
    type: Number,
    default: 0
  }
})

const championsStore = useChampionsStore()

function getIcon(name) {
  return championsStore.getChampionIconUrl(name, 'event-history')
}

// Helpers to extract picks/bans safely
const bluePicks = computed(() => getPicks(props.draft, 'blue'))
const redPicks = computed(() => getPicks(props.draft, 'red'))
const blueBans = computed(() => getBans(props.draft, 'blue'))
const redBans = computed(() => getBans(props.draft, 'red'))

function getPicks(draft, side) {
  // Logic from original EventHistory to normalize picks
  // Minimal implementation: just grab from picks array for now if arrays exist
  const sideData = side === 'blue' ? draft.blueSide : draft.redSide
  const picks = []
  
  if (sideData && sideData.picks) {
     sideData.picks.forEach(id => {
       if (id && id !== '0') {
          const champ = championsStore.allChampions.find(c => c.id === id)
          picks.push({ championName: champ ? champ.name : null })
       }
     })
  }

  // Pad to 5
  while (picks.length < 5) {
    picks.push({ championName: null })
  }
  return picks.slice(0, 5)
}

function getBans(draft, side) {
  const sideData = side === 'blue' ? draft.blueSide : draft.redSide
  const bans = []
  
  if (sideData && sideData.bans) {
     sideData.bans.forEach(id => {
       if (id && id !== '0') {
          const champ = championsStore.allChampions.find(c => c.id === id)
          if (champ) bans.push({ championName: champ.name })
       }
     })
  }
  
  // Pad bans to 5
  while (bans.length < 5) {
    bans.push({ championName: null })
  }
  return bans.slice(0, 5)
}

</script>

<style scoped>
.match-card {
  background-color: #1e1e1e;
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
}

.match-header {
  background-color: #252525;
  border-bottom: 1px solid #333;
  padding: 4px 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 24px; /* Ensure height */
}

.game-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 1px;
  white-space: nowrap;
  
  /* Flex child truncation fix */
  min-width: 0; 
  overflow: hidden;
  text-overflow: ellipsis; 
}

.match-content {
  display: flex;
  flex-direction: row; /* Horizontal split */
  position: relative;
  width: 100%;
}

.team-section {
  flex: 1;
  padding: 8px 4px;
  display: flex;
  flex-direction: row; /* Everything inside is horizontal relative to each other's columns */
  gap: 6px;
  min-width: 0;
  justify-content: center;
}

.blue-team {
  background: linear-gradient(to right, rgba(59, 130, 246, 0.05), transparent);
  border-right: 1px solid #333;
}

.red-team {
  background: linear-gradient(to left, rgba(239, 68, 68, 0.05), transparent);
}

.picks-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pick-slot {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid #444;
  background-color: #1a1a1a;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}

.pick-slot.filled {
  border-color: #555;
}

.pick-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bans-col {
  display: flex;
  flex-direction: column;
  gap: 4px; /* Slightly increased gap for visual balance */
  justify-content: center; /* Center bans vertically relative to picks */
}

/* Wrapper to handle the separator insertion without breaking flex gap of container if we used just gap */
.ban-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ban-slot {
  width: 22px;
  height: 22px;
  border-radius: 3px;
  border: 1px solid #333;
  background-color: #151515;
  overflow: hidden;
  opacity: 0.7;
}

.ban-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(100%);
}

.ban-separator {
  width: 1px;      /* Vertical line thickness */
  height: 8px;     /* Vertical line length */
  background-color: #555;
  margin: 6px 0 2px 0;   /* Symmetric 6px spacing (Top: 6px, Bottom: 2px + 4px gap = 6px) */
}
</style>

<template>
  <div class="lcu-drafts-panel" :class="{ 'is-collapsed': isCollapsed }">
    <div class="panel-header" @click="toggleCollapse">
      <div class="header-left">
        <span class="pulse-indicator"></span>
        <h3 class="panel-title">Used champions this series</h3>
      </div>
      <button class="collapse-button">
        <svg viewBox="0 0 24 24" class="chevron-icon" :class="{ 'rotated': isCollapsed }">
          <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
        </svg>
      </button>
    </div>

    <div class="panel-content" v-show="!isCollapsed">
      <div v-if="lcuDrafts.length === 0" class="empty-state">
        <p>No LCU drafts detected yet. Make sure your client is running and in a lobby.</p>
      </div>
      
      <div class="drafts-list" v-else>
        <!-- Reverse to show newest at the top, or chronological? Let's do chronological -->
        <div 
          v-for="draft in lcuDrafts" 
          :key="draft.id" 
          class="draft-item"
          @click="loadLcuDraft(draft.id)"
        >
          <div class="draft-game-header">
            <h4>{{ formatDraftName(draft.id) }}</h4>
          </div>
          
          <div class="draft-composition">
            <!-- Blue Side Picks -->
            <div class="team-composition blue-team">
              <div 
                v-for="i in 5" 
                :key="`blue-pick-${i}`"
                class="comp-champ-card blue"
              >
                <img 
                  v-if="getPicks(draft, 'blue')[i-1]"
                  :src="championsStore.getChampionIconUrl(getPicks(draft, 'blue')[i-1], 'lcu-panel')" 
                  :alt="getPicks(draft, 'blue')[i-1]"
                  class="comp-champ-img"
                  draggable="false"
                />
                <div v-else class="empty-champ-slot blue-empty"></div>
              </div>
            </div>
            
            <div class="vs-divider">VS</div>
            
            <!-- Red Side Picks -->
            <div class="team-composition red-team">
              <div 
                v-for="i in 5" 
                :key="`red-pick-${i}`"
                class="comp-champ-card red"
              >
                <img 
                  v-if="getPicks(draft, 'red')[i-1]"
                  :src="championsStore.getChampionIconUrl(getPicks(draft, 'red')[i-1], 'lcu-panel')" 
                  :alt="getPicks(draft, 'red')[i-1]"
                  class="comp-champ-img"
                  draggable="false"
                />
                <div v-else class="empty-champ-slot red-empty"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useDraftStore } from '@/stores/draft';
import { useChampionsStore } from '@/stores/champions';
import { useSeriesStore } from '@/stores/series';

const draftStore = useDraftStore();
const championsStore = useChampionsStore();
const seriesStore = useSeriesStore();

const isCollapsed = ref(true);

const lcuDrafts = computed(() => {
  // Sort drafts by their game number suffix to ensure chronological order
  return [...draftStore.lcuDraftsRaw].sort((a, b) => {
    const getNum = (id) => {
      if (!id) return 0;
      const parts = id.split('_');
      return parseInt(parts[parts.length - 1], 10) || 0;
    };
    return getNum(a.id) - getNum(b.id);
  });
});

const latestGameNumber = computed(() => {
  if (lcuDrafts.value.length === 0) return 0;
  const lastDraft = lcuDrafts.value[lcuDrafts.value.length - 1];
  if (!lastDraft || !lastDraft.id) return lcuDrafts.value.length;
  
  const parts = lastDraft.id.split('_');
  return parseInt(parts[parts.length - 1], 10) || lcuDrafts.value.length;
});

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
}

function getPicks(draft, side) {
  if (!draft) return [];
  const sideObj = side === 'blue' ? draft.blueSide : draft.redSide;
  if (!sideObj) return [];
  
  if (sideObj.pickEvents && sideObj.pickEvents.length > 0) {
    return sideObj.pickEvents.map(e => {
      const champ = championsStore.allChampions.find(c => c.id === e.championId);
      return champ ? champ.name : null;
    });
  }
  
  return (sideObj.picks || []).map(id => {
      const champ = championsStore.allChampions.find(c => c.id === id);
      return champ ? champ.name : null;
  });
}

function formatDraftName(draftId) {
  if (!draftId) return 'Game ?';
  const parts = draftId.split('_');
  const num = parseInt(parts[parts.length - 1], 10);
  return `Game ${isNaN(num) ? '?' : num}`;
}

function loadLcuDraft(draftId) {
  if (!draftId) return;
  const parts = draftId.split('_');
  const gameNumber = parseInt(parts[parts.length - 1], 10);
  
  if (isNaN(gameNumber)) return;

  // Set the series game index to the clicked game
  seriesStore.setCurrentGame(gameNumber);

  // Then make sure we actually load the LCU Draft iteration (usually index 0)
  const game = seriesStore.currentGame;
  if (game && game.drafts) {
    const lcuDraftIndex = game.drafts.findIndex(d => d.source === 'lcu' || d.isReadOnly);
    if (lcuDraftIndex !== -1) {
      seriesStore.setCurrentDraft(lcuDraftIndex);
    }
  }
}
</script>

<style scoped>
.lcu-drafts-panel {
  width: 100%;
  background-color: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
  margin-top: 1rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background-color: #242424;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid #333;
  transition: background-color 0.2s;
}

.lcu-drafts-panel.is-collapsed .panel-header {
  border-bottom: none;
}

.panel-header:hover {
  background-color: #2a2a2a;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.pulse-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #38bdf8;
  box-shadow: 0 0 8px #38bdf8;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.1); }
  100% { opacity: 1; transform: scale(1); }
}

.panel-title {
  color: #f3f4f6;
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
}

.draft-count {
  color: #9ca3af;
  font-size: 0.8rem;
}

.collapse-button {
  background: transparent;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chevron-icon {
  width: 20px;
  height: 20px;
  transition: transform 0.3s ease;
}

.chevron-icon.rotated {
  transform: rotate(180deg);
}

.panel-content {
  padding: 1rem;
  max-height: 250px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #4b5563 #1f2937;
}

.panel-content::-webkit-scrollbar {
  width: 6px;
}
.panel-content::-webkit-scrollbar-track {
  background: #1f2937;
  border-radius: 3px;
}
.panel-content::-webkit-scrollbar-thumb {
  background-color: #4b5563;
  border-radius: 3px;
}

.empty-state {
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
  padding: 1rem 0;
}

.drafts-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.draft-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background-color: #222;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid #333;
}

.draft-game-header h4 {
  margin: 0;
  color: #d1d5db;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}

.draft-composition {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.team-composition {
  display: flex;
  gap: 0.375rem;
}

.comp-champ-card {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #444;
}

.comp-champ-card.blue {
  border-color: rgba(59, 130, 246, 0.5);
}

.comp-champ-card.red {
  border-color: rgba(239, 68, 68, 0.5);
}

.comp-champ-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.empty-champ-slot {
  width: 100%;
  height: 100%;
  background-color: #111;
}

.vs-divider {
  font-size: 0.75rem;
  font-weight: 800;
  color: #6b7280;
  font-style: italic;
}
</style>

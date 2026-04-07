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
        <div class="mini-grid-label-wrapper">
          <div class="mini-grid-label">G{{ extractGameNumber(draft.id) || (index + 1) }}</div>
          <button class="delete-match-btn-compact" title="Delete Game" @click.stop="promptDelete(draft)">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="trash-icon"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
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

    <!-- Delete Confirmation Modal -->
    <Dialog :open="!!draftToDelete" @update:open="val => { if (!val) draftToDelete = null }">
      <DialogContent class="sm:max-w-md delete-dialog-content">
        <DialogHeader>
          <DialogTitle>Delete Match</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete Game {{ draftToDelete ? (extractGameNumber(draftToDelete.id) || 1) : '' }}? This action cannot be undone and will affect inherited champions.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="sm:justify-end gap-2 mt-4">
          <Button variant="secondary" @click="draftToDelete = null">Cancel</Button>
          <Button variant="destructive" @click="confirmDelete">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useChampionsStore } from '@/stores/champions'
import { useDraftStore } from '@/stores/draft'
import MatchCard from './MatchCard.vue'
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

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
const draftStore = useDraftStore()

const draftToDelete = ref(null)

function promptDelete(draft) {
  draftToDelete.value = draft
}

function confirmDelete() {
  if (draftToDelete.value && draftToDelete.value.id) {
    draftStore.deleteLcuDraft(draftToDelete.value.id)
  }
  draftToDelete.value = null
}

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

.mini-grid-label-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 100%;
}

.mini-grid-label {
  font-size: 0.7rem;
  color: #6b7280;
  font-weight: 700;
}

.delete-match-btn-compact {
  position: absolute;
  right: -20px; /* Push it outside the label area to fit the narrow constraints or align slightly inside */
  background: transparent;
  border: none;
  color: #ef4444;
  opacity: 0;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s, background-color 0.2s;
}

.compact-match-preview:hover .delete-match-btn-compact {
  opacity: 1;
}

.delete-match-btn-compact:hover {
  background-color: rgba(239, 68, 68, 0.1);
}

.delete-dialog-content {
  background-color: #1e1e1e !important;
  color: #e5e5e5;
  border: 1px solid #333 !important;
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

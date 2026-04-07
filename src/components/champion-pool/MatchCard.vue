<template>
  <div class="match-card">
    <div class="match-header">
      <span class="game-label">Game {{ gameNumber }}</span>
      <button class="delete-match-btn" title="Delete Game" @click="isDeleteDialogOpen = true">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="trash-icon"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
      </button>
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
            <div class="ban-slot" :class="{ 'is-none': ban.championName === 'None' }">
              <HelmetIcon 
                v-if="ban.championName === 'None'" 
                class="helmet-placeholder" 
              />
              <img
                v-if="ban.championName && ban.championName !== 'None'"
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
            <div class="ban-slot" :class="{ 'is-none': ban.championName === 'None' }">
              <HelmetIcon 
                v-if="ban.championName === 'None'" 
                class="helmet-placeholder" 
              />
              <img
                v-if="ban.championName && ban.championName !== 'None'"
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

    <!-- Delete Confirmation Modal -->
    <Dialog :open="isDeleteDialogOpen" @update:open="isDeleteDialogOpen = $event">
      <DialogContent class="sm:max-w-md delete-dialog-content">
        <DialogHeader>
          <DialogTitle>Delete Match</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete Game {{ gameNumber }}? This action cannot be undone and will affect inherited champions.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="sm:justify-end gap-2 mt-4">
          <Button variant="secondary" @click="isDeleteDialogOpen = false">Cancel</Button>
          <Button variant="destructive" @click="confirmDelete">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useChampionsStore } from "@/stores/champions";
import { useDraftStore } from "@/stores/draft";
import HelmetIcon from "@/components/icons/HelmetIcon.vue";
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
  draft: {
    type: Object,
    required: true,
  },
  gameNumber: {
    type: Number,
    default: 0,
  },
});

const championsStore = useChampionsStore();
const draftStore = useDraftStore();

const isDeleteDialogOpen = ref(false);

function getIcon(name) {
  return championsStore.getChampionIconUrl(name, "event-history");
}

function confirmDelete() {
  if (props.draft && props.draft.id) {
    draftStore.deleteLcuDraft(props.draft.id);
  }
  isDeleteDialogOpen.value = false;
}

// Helpers to extract picks/bans safely
const bluePicks = computed(() => getPicks(props.draft, "blue"));
const redPicks = computed(() => getPicks(props.draft, "red"));
const blueBans = computed(() => getBans(props.draft, "blue"));
const redBans = computed(() => getBans(props.draft, "red"));

function getPicks(draft, side) {
  // Logic from original EventHistory to normalize picks
  // Minimal implementation: just grab from picks array for now if arrays exist
  const sideData = side === "blue" ? draft.blueSide : draft.redSide;
  const picks = [];

  if (sideData && sideData.picks) {
    sideData.picks.forEach((id) => {
      if (id && id !== "0") {
        const champ = championsStore.allChampions.find((c) => c.id === id);
        picks.push({ championName: champ ? champ.name : null });
      }
    });
  }

  // Pad to 5
  while (picks.length < 5) {
    picks.push({ championName: null });
  }
  return picks.slice(0, 5);
}

function getBans(draft, side) {
  const sideData = side === "blue" ? draft.blueSide : draft.redSide;
  const bans = [];

  if (sideData) {
    const banSources = (sideData.banEvents && sideData.banEvents.length > 0) 
      ? sideData.banEvents.map(e => e.championId) 
      : (sideData.bans || []);
      
    banSources.forEach((id) => {
      if (id === "None" || id === "0" || id === 0 || id === -1 || id === "-1") {
        bans.push({ championName: "None" });
      } else if (id) {
        const champ = championsStore.allChampions.find((c) => c.id === id);
        if (champ) bans.push({ championName: champ.name });
      }
    });
  }

  // Pad bans to 5
  while (bans.length < 5) {
    bans.push({ championName: null });
  }
  return bans.slice(0, 5);
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
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.match-header:hover .delete-match-btn {
  opacity: 1;
}

.delete-match-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: #ef4444;
  opacity: 0;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s, background-color 0.2s;
}

.delete-match-btn:hover {
  background-color: rgba(239, 68, 68, 0.1);
}

.delete-dialog-content {
  background-color: #1e1e1e !important;
  color: #e5e5e5;
  border: 1px solid #333 !important;
}

.game-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 1px;
  white-space: nowrap;
  width: auto;
  transform: none;
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

.ban-slot.is-none {
  display: flex;
  align-items: center;
  justify-content: center;
  border-color: #444;
  opacity: 1;
}

.helmet-placeholder {
  width: 50%;
  height: 50%;
  color: #555;
}

.ban-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(100%);
}

.ban-separator {
  width: 1px; /* Vertical line thickness */
  height: 8px; /* Vertical line length */
  background-color: #555;
  margin: 6px 0 2px 0; /* Symmetric 6px spacing (Top: 6px, Bottom: 2px + 4px gap = 6px) */
}
</style>

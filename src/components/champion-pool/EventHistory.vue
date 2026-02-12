<template>
  <div class="event-history-container">
    <!-- Tabs Header -->
    <div class="event-history-header">
      <Tabs
        :model-value="viewMode"
        @update:model-value="setViewMode"
        class="w-full"
      >
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <!-- History Mode -->
    <div v-if="viewMode === 'history'" class="event-history-content">
      <div class="event-history-grid">
        <div
          v-for="(batch, batchIndex) in timeBatchedEvents"
          :key="batchIndex"
          class="event-batch"
        >
          <div
            v-for="event in batch"
            :key="event.id"
            class="event-item"
            :class="{ 'is-ban': event.isBan }"
            :data-source="event.source"
            @click="handleClick(event)"
            @contextmenu.prevent="handleRightClick(event)"
            :title="`${event.championName} (${event.isBan ? 'Ban' : 'Pick'}) - ${event.source === 'lcu' ? 'LCU' : 'Manual'}`"
          >
            <img
              :src="getChampionIconUrl(event.championName)"
              :alt="event.championName"
              class="event-champion-icon"
              draggable="false"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Drafts Mode -->
    <div v-else class="drafts-view-content">
      <div v-if="sortedDrafts.length === 0" class="no-drafts-message">
        No drafts available
      </div>
      <div v-else class="drafts-list">
        <div
          v-for="(draft, index) in sortedDrafts"
          :key="draft.id"
          class="draft-game-section"
        >
          <div class="draft-game-title">Game {{ index + 1 }}</div>
          <div class="draft-game-layout">
            <!-- Blue Side -->
            <div class="draft-side blue-side">
              <div class="draft-picks">
                <div
                  v-for="(pick, pickIndex) in getOrderedPicks(draft, 'blue')"
                  :key="`blue-${pickIndex}`"
                  class="draft-pick-slot"
                  :class="{ filled: pick.championName }"
                >
                  <img
                    v-if="pick.championName"
                    :src="getChampionIconUrl(pick.championName)"
                    :alt="pick.championName"
                    class="draft-pick-icon"
                    draggable="false"
                  />
                  <div v-else class="draft-pick-placeholder">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v8M8 12h8" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <!-- Red Side -->
            <div class="draft-side red-side">
              <div class="draft-picks">
                <div
                  v-for="(pick, pickIndex) in getOrderedPicks(draft, 'red')"
                  :key="`red-${pickIndex}`"
                  class="draft-pick-slot"
                  :class="{ filled: pick.championName }"
                >
                  <img
                    v-if="pick.championName"
                    :src="getChampionIconUrl(pick.championName)"
                    :alt="pick.championName"
                    class="draft-pick-icon"
                    draggable="false"
                  />
                  <div v-else class="draft-pick-placeholder">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v8M8 12h8" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useChampionsStore } from "@/stores/champions";
import { useDraftStore } from "@/stores/draft";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const championsStore = useChampionsStore();
const draftStore = useDraftStore();

// View mode state
const viewMode = ref("history"); // 'history' | 'drafts'

function setViewMode(mode) {
  viewMode.value = mode || "history";
}

// Time window for grouping events (in milliseconds) - 4 seconds
const TIME_WINDOW = 4000;

// Get champion icon URL
function getChampionIconUrl(championName) {
  return championsStore.getChampionIconUrl(championName, "event-history");
}

// Get ordered picks for a draft side based on pickEvents order
function getOrderedPicks(draft, side) {
  const picks = [];
  const pickEvents =
    side === "blue" ? draft.blueSide?.pickEvents : draft.redSide?.pickEvents;
  const championIds =
    side === "blue" ? draft.blueSide?.picks : draft.redSide?.picks;

  // If we have pick events with timestamps, use those for ordering
  if (pickEvents && pickEvents.length > 0) {
    // Sort pick events by timestamp
    const sortedEvents = [...pickEvents].sort((a, b) => {
      const timeA = parseTimestamp(a.timestamp)?.getTime() || 0;
      const timeB = parseTimestamp(b.timestamp)?.getTime() || 0;
      return timeA - timeB;
    });

    // Map events to champion names
    sortedEvents.forEach((event) => {
      const champion = championsStore.allChampions.find(
        (c) => c.id === event.championId,
      );
      picks.push({
        championId: event.championId,
        championName: champion ? champion.name : null,
        timestamp: event.timestamp,
      });
    });
  } else if (championIds && championIds.length > 0) {
    // Fallback: use picks array order
    championIds.forEach((id) => {
      if (id && id !== "0") {
        const champion = championsStore.allChampions.find((c) => c.id === id);
        picks.push({
          championId: id,
          championName: champion ? champion.name : null,
        });
      }
    });
  }

  // Pad to 5 picks with empty slots
  while (picks.length < 5) {
    picks.push({ championId: null, championName: null });
  }

  return picks.slice(0, 5);
}

// Sort drafts by game number (Game 1, Game 2, etc.)
const sortedDrafts = computed(() => {
  const drafts = [...draftStore.lcuDraftsRaw];

  return drafts.sort((a, b) => {
    const aNum = extractGameNumber(a.id);
    const bNum = extractGameNumber(b.id);
    return aNum - bNum;
  });
});

// Extract game number from draft ID (e.g., "draft_1" -> 1, "lcu_draft_3" -> 3)
function extractGameNumber(draftId) {
  if (!draftId) return 0;
  const match = draftId.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

// Helper to parse timestamp from various formats
function parseTimestamp(timestamp) {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === "object" && timestamp.toDate) {
    // Firestore Timestamp
    return timestamp.toDate();
  }
  if (typeof timestamp === "string") {
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

// Extract manual events from eventContext
function extractManualEvents() {
  const events = [];

  draftStore.eventContext.forEach((event, index) => {
    events.push({
      id: `manual-${event.eventType}-${event.championId}-${index}`,
      championName: event.championId,
      isBan: event.eventType === "BAN",
      source: "manual",
      timestamp: parseTimestamp(event.timestamp) || new Date(),
    });
  });

  return events;
}

// Extract LCU events from drafts with real timestamps
function extractLcuEvents() {
  const events = [];
  const champions = championsStore.allChampions;

  if (!champions || champions.length === 0) return events;

  // Helper to get champion name from internal ID
  const getChampionNameById = (id) => {
    const champ = champions.find((c) => c.id === id);
    return champ ? champ.name : null;
  };

  draftStore.lcuDraftsRaw.forEach((draft) => {
    const hasEventTimestamps =
      draft.blueSide?.banEvents?.length > 0 ||
      draft.blueSide?.pickEvents?.length > 0;

    if (hasEventTimestamps) {
      // Use real timestamps from pickEvents/banEvents

      // Ban events from blue side
      draft.blueSide?.banEvents?.forEach((event, index) => {
        const name = getChampionNameById(event.championId);
        const timestamp = parseTimestamp(event.timestamp);
        if (name && timestamp) {
          events.push({
            id: `lcu-ban-blue-${draft.id}-${index}`,
            championName: name,
            isBan: true,
            source: "lcu",
            timestamp: timestamp,
            draftId: draft.id,
          });
        }
      });

      // Ban events from red side
      draft.redSide?.banEvents?.forEach((event, index) => {
        const name = getChampionNameById(event.championId);
        const timestamp = parseTimestamp(event.timestamp);
        if (name && timestamp) {
          events.push({
            id: `lcu-ban-red-${draft.id}-${index}`,
            championName: name,
            isBan: true,
            source: "lcu",
            timestamp: timestamp,
            draftId: draft.id,
          });
        }
      });

      // Pick events from blue side
      draft.blueSide?.pickEvents?.forEach((event, index) => {
        const name = getChampionNameById(event.championId);
        const timestamp = parseTimestamp(event.timestamp);
        if (name && timestamp) {
          events.push({
            id: `lcu-pick-blue-${draft.id}-${index}`,
            championName: name,
            isBan: false,
            source: "lcu",
            timestamp: timestamp,
            draftId: draft.id,
          });
        }
      });

      // Pick events from red side
      draft.redSide?.pickEvents?.forEach((event, index) => {
        const name = getChampionNameById(event.championId);
        const timestamp = parseTimestamp(event.timestamp);
        if (name && timestamp) {
          events.push({
            id: `lcu-pick-red-${draft.id}-${index}`,
            championName: name,
            isBan: false,
            source: "lcu",
            timestamp: timestamp,
            draftId: draft.id,
          });
        }
      });
    } else {
      // LEGACY: Fall back to fake timestamps based on draft updatedAt
      const timestamp = draft.updatedAt || new Date();

      const blueBans = draft.blueSide?.bans || [];
      blueBans.forEach((championId, index) => {
        const name = getChampionNameById(championId);
        if (name) {
          events.push({
            id: `lcu-ban-blue-${draft.id}-${index}`,
            championName: name,
            isBan: true,
            source: "lcu",
            timestamp: new Date(timestamp.getTime() + index * 100),
            draftId: draft.id,
          });
        }
      });

      const redBans = draft.redSide?.bans || [];
      redBans.forEach((championId, index) => {
        const name = getChampionNameById(championId);
        if (name) {
          events.push({
            id: `lcu-ban-red-${draft.id}-${index}`,
            championName: name,
            isBan: true,
            source: "lcu",
            timestamp: new Date(
              timestamp.getTime() + (blueBans.length + index) * 100,
            ),
            draftId: draft.id,
          });
        }
      });

      const bluePicks = draft.blueSide?.picks || [];
      bluePicks.forEach((championId, index) => {
        const name = getChampionNameById(championId);
        if (name) {
          events.push({
            id: `lcu-pick-blue-${draft.id}-${index}`,
            championName: name,
            isBan: false,
            source: "lcu",
            timestamp: new Date(timestamp.getTime() + (index + 10) * 100),
            draftId: draft.id,
          });
        }
      });

      const redPicks = draft.redSide?.picks || [];
      redPicks.forEach((championId, index) => {
        const name = getChampionNameById(championId);
        if (name) {
          events.push({
            id: `lcu-pick-red-${draft.id}-${index}`,
            championName: name,
            isBan: false,
            source: "lcu",
            timestamp: new Date(
              timestamp.getTime() + (bluePicks.length + index + 10) * 100,
            ),
            draftId: draft.id,
          });
        }
      });
    }
  });

  return events;
}

// Group events by time window
function groupEventsByTime(events) {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);

  const batches = [];
  let currentBatch = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = sorted[i - 1];

    if (previous.timestamp - current.timestamp <= TIME_WINDOW) {
      currentBatch.push(current);
    } else {
      batches.push(currentBatch);
      currentBatch = [current];
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

// Create event batches from all data sources
const timeBatchedEvents = computed(() => {
  const manualEvents = extractManualEvents();
  const lcuEvents = extractLcuEvents();

  const allEvents = [...manualEvents, ...lcuEvents];

  return groupEventsByTime(allEvents);
});

// Handle click - remove from pool (only for manual events)
function handleClick(event) {
  if (event.source === "manual") {
    if (event.isBan) {
      draftStore.toggleBan(event.championName);
    } else {
      draftStore.togglePick(event.championName);
    }
  }
}

// Handle right click
function handleRightClick(event) {
  if (event.source === "manual") {
    if (event.isBan) {
      draftStore.toggleBan(event.championName);
    } else {
      draftStore.togglePick(event.championName);
    }
  }
}
</script>

<style scoped>
/* Event History Container */
.event-history-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #1e1e1e;
  border: 1px solid #3a3a3a;
  border-radius: 0.5rem;
  overflow: hidden;
}

/* Header with Tabs */
.event-history-header {
  padding: 6px;
  border-bottom: 1px solid #3a3a3a;
  background-color: #252525;
  flex-shrink: 0;
}

/* Reduce font size for History/Drafts tabs */
.event-history-header :deep([role="tab"]) {
  font-size: 0.75rem;
}

/* History Mode Content */
.event-history-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 4px;
}

.event-history-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
  align-items: center;
}

.event-batch {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
  position: relative;
  padding-bottom: 14px;
  margin-bottom: 14px;
}

/* Vertical line separator between batches - longer */
.event-batch:not(:last-child)::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 10px;
  background-color: #3a3a3a;
}

.event-item {
  width: 32px;
  height: 32px;
  border-radius: 3px;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  transition:
    transform 0.15s ease,
    opacity 0.15s ease;
}

.event-item:hover {
  transform: scale(1.15);
  z-index: 10;
}

.event-champion-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 3px;
  border: 1px solid #3a3a3a;
}

/* Bans are grayscale */
.event-item.is-ban .event-champion-icon {
  filter: grayscale(100%);
}

/* Add a subtle ban indicator overlay */
.event-item.is-ban::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 14px;
  height: 14px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' stroke='%23c4c4c4' stroke-width='2' fill='none'/%3E%3Cline x1='4' y1='4' x2='20' y2='20' stroke='%23c4c4c4' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
  background-size: contain;
  background-repeat: no-repeat;
  opacity: 0.85;
  pointer-events: none;
}

/* LCU items are not clickable (can't remove them) */
.event-item[data-source="lcu"] {
  cursor: not-allowed;
  opacity: 0.7;
}

.event-item[data-source="lcu"]:hover {
  transform: none;
}

/* Drafts Mode Content */
.drafts-view-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.no-drafts-message {
  text-align: center;
  color: #888888;
  font-size: 0.75rem;
  padding: 16px 8px;
}

.drafts-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 16px;
}

.draft-game-section {
  background-color: #252525;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  padding: 4px;
  padding-top: 10px;
  position: relative;
  max-width: 90px;
  margin: 0 auto;
  width: 100%;
}

.draft-game-title {
  font-size: 0.65rem;
  font-weight: 600;
  color: #888888;
  text-align: center;
  position: absolute;
  top: 0;
  left: 50%;
  transform: translate(-50%, -70%);
  background-color: #252525;
  padding: 2px 8px;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  z-index: 5;
  white-space: nowrap;
  min-width: 50px;
}

.draft-game-layout {
  display: flex;
  gap: 6px;
}

.draft-side {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

/* Side indicators as border - blue left, red right */
.draft-game-section {
  position: relative;
  border: none !important;
  background-color: #252525;
  border-radius: 6px;
  padding: 10px 4px 8px 4px;
  max-width: 90px;
  margin: 0 auto;
  width: 100%;
  /* Base border for bottom middle section */
  box-shadow: 
    inset 0 0 0 1px #3a3a3a;
}

.draft-game-section::before,
.draft-game-section::after {
  content: '';
  position: absolute;
  top: 0;
  height: 100%;
  width: 50%;
  pointer-events: none;
}

/* Blue side - left half of top, entire left, left half of bottom */
.draft-game-section::before {
  left: 0;
  border-top: 3px solid #3b82f6;
  border-left: 3px solid #3b82f6;
  border-bottom: 3px solid #3b82f6;
  border-top-left-radius: 6px;
  border-bottom-left-radius: 6px;
}

/* Red side - right half of top, entire right, right half of bottom */
.draft-game-section::after {
  right: 0;
  border-top: 3px solid #ef4444;
  border-right: 3px solid #ef4444;
  border-bottom: 3px solid #ef4444;
  border-top-right-radius: 6px;
  border-bottom-right-radius: 6px;
}

.draft-picks {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
}

.draft-pick-slot {
  width: 32px;
  height: 32px;
  background-color: #1a1a1a;
  border: 1px solid #3a3a3a;
  border-radius: 3px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.draft-pick-slot.filled {
  background-color: #1e1e1e;
  border-color: #444444;
}

.draft-pick-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.draft-pick-placeholder {
  width: 60%;
  height: 60%;
  color: #444444;
  display: flex;
  align-items: center;
  justify-content: center;
}

.draft-pick-placeholder svg {
  width: 100%;
  height: 100%;
}

/* Scrollbar styling */
.event-history-content::-webkit-scrollbar,
.drafts-view-content::-webkit-scrollbar {
  width: 4px;
}

.event-history-content::-webkit-scrollbar-track,
.drafts-view-content::-webkit-scrollbar-track {
  background: transparent;
}

.event-history-content::-webkit-scrollbar-thumb,
.drafts-view-content::-webkit-scrollbar-thumb {
  background-color: #444444;
  border-radius: 2px;
}

.event-history-content::-webkit-scrollbar-thumb:hover,
.drafts-view-content::-webkit-scrollbar-thumb:hover {
  background-color: #555555;
}
</style>

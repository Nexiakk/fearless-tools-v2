<template>
  <div 
    v-if="hasAnyContent" 
    class="event-history-outer-wrapper"
    :class="{ 'is-collapsed': isCollapsed, 'is-expanded-hover': isExpandedHover }"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div class="event-history-container">
      <!-- Header Area with Toggle -->
      <div class="event-history-header">
        <div class="header-top-row">
          <Tabs
            :model-value="viewMode"
            @update:model-value="setViewMode"
            class="w-full"
          >
            <TabsList class="grid w-full grid-cols-2">
              <TabsTrigger value="history" class="tab-trigger">
                <span v-if="!effectiveCompact">Timeline</span>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="tab-icon">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </TabsTrigger>
              <TabsTrigger value="drafts" class="tab-trigger">
                <span v-if="!effectiveCompact">Matches</span>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="tab-icon">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <!-- Collapse Toggle (Pin) - Moved inside header -->
          <button 
            v-if="!effectiveCompact || isExpandedHover"
            class="pin-toggle-btn"
            @click.stop="toggleCollapse"
            :class="{ 'is-pinned': !isCollapsed }"
            :title="isCollapsed ? 'Pin Open' : 'Unpin (Collapse)'"
          >
            <svg 
              viewBox="0 0 24 24" 
              fill="currentColor" 
              class="pin-icon"
            >
              <!-- Pin Icon -->
              <path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16,12Z" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Timeline Mode -->
      <div v-if="viewMode === 'history'" class="event-history-content">
        <HistoryTimeline 
          :batches="timeBatchedEvents" 
          :compact="effectiveCompact"
          @revert="handleRevert"
        />
      </div>

      <!-- Matches Mode -->
      <div v-else class="drafts-view-content">
        <MatchList 
          :drafts="sortedDrafts" 
          :compact="effectiveCompact"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useChampionsStore } from "@/stores/champions";
import { useDraftStore } from "@/stores/draft";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HistoryTimeline from "./HistoryTimeline.vue";
import MatchList from "./MatchList.vue";

const championsStore = useChampionsStore();
const draftStore = useDraftStore();

// View mode state
const viewMode = ref("history"); // 'history' | 'drafts'
const isCollapsed = ref(true); // Default to collapsed
const isExpandedHover = ref(false);

// Effective compact state: true if collapsed AND not currently hovering
const effectiveCompact = computed(() => {
  return isCollapsed.value && !isExpandedHover.value;
});

function setViewMode(mode) {
  viewMode.value = mode || "history";
}

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
  // If we uncollapse (pin), remove hover state to clear any visual ambiguity
  if (!isCollapsed.value) {
    isExpandedHover.value = false;
  }
}

function handleMouseEnter() {
  if (isCollapsed.value) {
    isExpandedHover.value = true;
  }
}

function handleMouseLeave() {
  isExpandedHover.value = false;
}

// Time window for grouping events (in milliseconds) - 4 seconds
const TIME_WINDOW = 4000;

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

// Check if there's any content to display (events or drafts)
const hasAnyContent = computed(() => {
  return timeBatchedEvents.value.length > 0 || sortedDrafts.value.length > 0;
});

// Handle revert (only for manual events)
function handleRevert(event) {
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
/* Outer wrapper to handle layout behavior (positioning) */
.event-history-outer-wrapper {
  height: 100%;
  position: relative;
  z-index: 50;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  width: 200px; /* Default expanded - Reduced from 260px */
  flex-shrink: 0;
}

/* Collapsed State */
.event-history-outer-wrapper.is-collapsed {
  width: 70px;
}

/* Container inside */
.event-history-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #1e1e1e;
  border: 1px solid #3a3a3a;
  border-radius: 0.5rem;
  overflow: hidden;
  width: 100%;
  position: relative;
}

/* Hover Expanded State logic */
/* When wrapper is collapsed but hovered, the internal container expands absolutely over content */
.event-history-outer-wrapper.is-expanded-hover .event-history-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 200px; /* Expand to full width - Reduced from 260px */
  height: 100%;
  z-index: 60;
  box-shadow: 6px 0 16px rgba(0,0,0,0.5); /* Strong shadow for overlay */
  border-right-color: #4a4a4a;
}

/* Header Area */
.event-history-header {
  padding: 6px;
  border-bottom: 1px solid #3a3a3a;
  background-color: #252525;
  flex-shrink: 0;
}

.header-top-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Pin Toggle Button (Inside Header) */
.pin-toggle-btn {
  width: 24px;
  height: 24px;
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  position: absolute;
  top: 6px;
  right: 6px; 
  /* If in compact mode, hide it or style differently? 
     Actually, if compact, the button is hidden by v-if logic in template unless hovered.
  */
}

.pin-toggle-btn:hover {
  background-color: #3a3a3a;
  color: #e0e0e0;
}

.pin-toggle-btn.is-pinned {
  color: #d97706; /* Active/Pinned color */
  background-color: rgba(217, 119, 6, 0.1);
  border-color: rgba(217, 119, 6, 0.2);
}

.pin-toggle-btn.is-pinned:hover {
  background-color: rgba(217, 119, 6, 0.2);
}

.pin-icon {
  width: 14px;
  height: 14px;
}

/* Icon-only Tabs when collapsed */
.tab-icon {
  width: 16px;
  height: 16px;
  opacity: 0.7;
}

.tab-trigger[data-state="active"] .tab-icon {
  opacity: 1;
}

/* Reduce font size for History/Drafts tabs */
.event-history-header :deep([role="tab"]) {
  font-size: 0.75rem;
  padding: 4px;
}

/* History Mode Content */
.event-history-content {
  flex: 1;
  overflow-y: auto;
  padding: 0; 
  display: flex;
  flex-direction: column;
}

/* Drafts Mode Content */
.drafts-view-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  display: flex;
  flex-direction: column;
}

/* Scrollbar styling */
.event-history-content::-webkit-scrollbar,
.drafts-view-content::-webkit-scrollbar {
  width: 4px; /* Thinner for compact */
}

.event-history-content::-webkit-scrollbar-track,
.drafts-view-content::-webkit-scrollbar-track {
  background: #1e1e1e;
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

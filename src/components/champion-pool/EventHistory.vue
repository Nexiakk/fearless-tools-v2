<template>
  <div class="event-history-container">
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
</template>

<script setup>
import { computed } from 'vue'
import { useChampionsStore } from '@/stores/champions'
import { useDraftStore } from '@/stores/draft'

const championsStore = useChampionsStore()
const draftStore = useDraftStore()

// Time window for grouping events (in milliseconds) - 4 seconds
const TIME_WINDOW = 4000

// Get champion icon URL
function getChampionIconUrl(championName) {
  return championsStore.getChampionIconUrl(championName, 'event-history')
}

// Helper to parse timestamp from various formats
function parseTimestamp(timestamp) {
  if (!timestamp) return null
  if (timestamp instanceof Date) return timestamp
  if (typeof timestamp === 'object' && timestamp.toDate) {
    // Firestore Timestamp
    return timestamp.toDate()
  }
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp)
    return isNaN(date.getTime()) ? null : date
  }
  return null
}

// Extract manual events from eventContext
function extractManualEvents() {
  const events = []
  
  draftStore.eventContext.forEach((event, index) => {
    events.push({
      id: `manual-${event.eventType}-${event.championId}-${index}`,
      championName: event.championId,
      isBan: event.eventType === 'BAN',
      source: 'manual',
      timestamp: parseTimestamp(event.timestamp) || new Date()
    })
  })
  
  return events
}

// Extract LCU events from drafts with real timestamps
function extractLcuEvents() {
  const events = []
  const champions = championsStore.allChampions
  
  if (!champions || champions.length === 0) return events
  
  // Helper to get champion name from internal ID
  const getChampionNameById = (id) => {
    const champ = champions.find(c => c.id === id)
    return champ ? champ.name : null
  }
  
  draftStore.lcuDraftsRaw.forEach(draft => {
    const hasEventTimestamps = draft.blueSide?.banEvents?.length > 0 || draft.blueSide?.pickEvents?.length > 0
    
    if (hasEventTimestamps) {
      // Use real timestamps from pickEvents/banEvents
      
      // Ban events from blue side
      draft.blueSide?.banEvents?.forEach((event, index) => {
        const name = getChampionNameById(event.championId)
        const timestamp = parseTimestamp(event.timestamp)
        if (name && timestamp) {
          events.push({
            id: `lcu-ban-blue-${draft.id}-${index}`,
            championName: name,
            isBan: true,
            source: 'lcu',
            timestamp: timestamp,
            draftId: draft.id
          })
        }
      })
      
      // Ban events from red side
      draft.redSide?.banEvents?.forEach((event, index) => {
        const name = getChampionNameById(event.championId)
        const timestamp = parseTimestamp(event.timestamp)
        if (name && timestamp) {
          events.push({
            id: `lcu-ban-red-${draft.id}-${index}`,
            championName: name,
            isBan: true,
            source: 'lcu',
            timestamp: timestamp,
            draftId: draft.id
          })
        }
      })
      
      // Pick events from blue side
      draft.blueSide?.pickEvents?.forEach((event, index) => {
        const name = getChampionNameById(event.championId)
        const timestamp = parseTimestamp(event.timestamp)
        if (name && timestamp) {
          events.push({
            id: `lcu-pick-blue-${draft.id}-${index}`,
            championName: name,
            isBan: false,
            source: 'lcu',
            timestamp: timestamp,
            draftId: draft.id
          })
        }
      })
      
      // Pick events from red side
      draft.redSide?.pickEvents?.forEach((event, index) => {
        const name = getChampionNameById(event.championId)
        const timestamp = parseTimestamp(event.timestamp)
        if (name && timestamp) {
          events.push({
            id: `lcu-pick-red-${draft.id}-${index}`,
            championName: name,
            isBan: false,
            source: 'lcu',
            timestamp: timestamp,
            draftId: draft.id
          })
        }
      })
    } else {
      // LEGACY: Fall back to fake timestamps based on draft updatedAt
      const timestamp = draft.updatedAt || new Date()
      
      const blueBans = draft.blueSide?.bans || []
      blueBans.forEach((championId, index) => {
        const name = getChampionNameById(championId)
        if (name) {
          events.push({
            id: `lcu-ban-blue-${draft.id}-${index}`,
            championName: name,
            isBan: true,
            source: 'lcu',
            timestamp: new Date(timestamp.getTime() + index * 100),
            draftId: draft.id
          })
        }
      })
      
      const redBans = draft.redSide?.bans || []
      redBans.forEach((championId, index) => {
        const name = getChampionNameById(championId)
        if (name) {
          events.push({
            id: `lcu-ban-red-${draft.id}-${index}`,
            championName: name,
            isBan: true,
            source: 'lcu',
            timestamp: new Date(timestamp.getTime() + (blueBans.length + index) * 100),
            draftId: draft.id
          })
        }
      })
      
      const bluePicks = draft.blueSide?.picks || []
      bluePicks.forEach((championId, index) => {
        const name = getChampionNameById(championId)
        if (name) {
          events.push({
            id: `lcu-pick-blue-${draft.id}-${index}`,
            championName: name,
            isBan: false,
            source: 'lcu',
            timestamp: new Date(timestamp.getTime() + (index + 10) * 100),
            draftId: draft.id
          })
        }
      })
      
      const redPicks = draft.redSide?.picks || []
      redPicks.forEach((championId, index) => {
        const name = getChampionNameById(championId)
        if (name) {
          events.push({
            id: `lcu-pick-red-${draft.id}-${index}`,
            championName: name,
            isBan: false,
            source: 'lcu',
            timestamp: new Date(timestamp.getTime() + (bluePicks.length + index + 10) * 100),
            draftId: draft.id
          })
        }
      })
    }
  })
  
  return events
}

// Group events by time window
function groupEventsByTime(events) {
  if (events.length === 0) return []
  
  const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp)
  
  const batches = []
  let currentBatch = [sorted[0]]
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const previous = sorted[i - 1]
    
    if (previous.timestamp - current.timestamp <= TIME_WINDOW) {
      currentBatch.push(current)
    } else {
      batches.push(currentBatch)
      currentBatch = [current]
    }
  }
  
  if (currentBatch.length > 0) {
    batches.push(currentBatch)
  }
  
  return batches
}

// Create event batches from all data sources
const timeBatchedEvents = computed(() => {
  const manualEvents = extractManualEvents()
  const lcuEvents = extractLcuEvents()
  
  const allEvents = [...manualEvents, ...lcuEvents]
  
  return groupEventsByTime(allEvents)
})

// Handle click - remove from pool (only for manual events)
function handleClick(event) {
  if (event.source === 'manual') {
    if (event.isBan) {
      draftStore.toggleBan(event.championName)
    } else {
      draftStore.togglePick(event.championName)
    }
  }
}

// Handle right click
function handleRightClick(event) {
  if (event.source === 'manual') {
    if (event.isBan) {
      draftStore.toggleBan(event.championName)
    } else {
      draftStore.togglePick(event.championName)
    }
  }
}
</script>

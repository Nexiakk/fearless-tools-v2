<template>
  <div 
    class="timeline-item" 
    :class="{ 
      'is-ban': event.isBan, 
      'is-pick': !event.isBan,
      'source-lcu': event.source === 'lcu',
      'source-manual': event.source === 'manual',
      'is-compact': compact
    }"
  >
    <!-- Icon Column -->
    <div class="item-icon-col">
      <div class="item-icon-wrapper">
        <img 
          :src="iconUrl" 
          :alt="event.championName" 
          class="item-icon" 
          draggable="false"
        />
        <div v-if="event.isBan" class="ban-overlay">
          <svg viewBox="0 0 24 24" class="ban-icon">
            <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
        </div>
      </div>
      
      <!-- Connector Line (visual flair for timeline) - Hide in compact -->
      <div v-if="!compact" class="timeline-connector"></div>
    </div>
    
    <!-- Content Column - Hide in compact -->
    <div v-if="!compact" class="item-content-col">
      <div class="item-header">
        <span class="champion-name">{{ event.championName }}</span>
        <span class="action-badge" :class="event.isBan ? 'badge-ban' : 'badge-pick'">
          {{ event.isBan ? 'BAN' : 'PICK' }}
        </span>
      </div>
      
      <div class="item-meta">
        <span class="source-tag">
          {{ event.source === 'lcu' ? 'LCU' : 'Manual' }}
        </span>
        <span class="time-label">{{ formattedTime }}</span>
      </div>
    </div>

    <!-- Actions Column (Hover) -->
    <div v-if="!compact" class="item-actions-col">
      <button 
        v-if="event.source === 'manual'" 
        @click.stop="$emit('revert', event)" 
        class="revert-btn"
        title="Revert this event"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useChampionsStore } from '@/stores/champions'

const props = defineProps({
  event: {
    type: Object,
    required: true
  },
  compact: {
    type: Boolean,
    default: false
  }
})

defineEmits(['revert'])

const championsStore = useChampionsStore()

const iconUrl = computed(() => {
  return championsStore.getChampionIconUrl(props.event.championName, 'event-history')
})

const formattedTime = computed(() => {
  if (!props.event.timestamp) return ''
  const date = new Date(props.event.timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
})
</script>

<style scoped>
.timeline-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 6px;
  background-color: #252525;
  border: 1px solid #3a3a3a;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.timeline-item.is-compact {
  padding: 4px;
  justify-content: center;
  gap: 0;
  background-color: transparent;
  border-color: transparent;
}

.timeline-item:hover {
  background-color: #2a2a2a;
  border-color: #4a4a4a;
}

.timeline-item.is-compact:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

/* Source Manual Indication */
.source-manual {
  border-left: 3px solid #64748b; /* Slate for manual */
}

/* Source LCU Indication */
.source-lcu {
  border-left: 3px solid #10b981; /* Emerald for LCU */
  opacity: 0.85;
}

.timeline-item.is-compact.source-manual,
.timeline-item.is-compact.source-lcu {
  border-left: none; /* Remove left border in compact */
}

/* Add indicator dot for source in compact mode */
.timeline-item.is-compact::after {
  content: '';
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.5);
}

.timeline-item.is-compact.source-manual::after {
  background-color: #64748b;
}

.timeline-item.is-compact.source-lcu::after {
  background-color: #10b981;
}

.timeline-item.is-ban {
  background-color: #251e1e; /* Slight red tint bg */
}

.timeline-item.is-pick {
  background-color: #1e252e; /* Slight blue tint bg */
}


/* Icon Column */
.item-icon-col {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.item-icon-wrapper {
  width: 36px;
  height: 36px;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #444;
}

.item-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.timeline-item.is-ban .item-icon {
  filter: grayscale(100%);
}

.ban-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.4);
}

.ban-icon {
  width: 24px;
  height: 24px;
  color: #ef4444; /* Red */
  filter: drop-shadow(0 0 2px rgba(0,0,0,0.8));
}

/* Content Column */
.item-content-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0; /* Text truncation fix */
}

.item-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.champion-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.action-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge-ban {
  background-color: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.badge-pick {
  background-color: rgba(59, 130, 246, 0.2);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.7rem;
  color: #94a3b8;
}

.source-tag {
  text-transform: capitalize;
}

/* Actions Column */
.item-actions-col {
  display: flex;
  align-items: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.timeline-item:hover .item-actions-col {
  opacity: 1;
}

.revert-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.revert-btn:hover {
  background-color: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.revert-btn svg {
  width: 16px;
  height: 16px;
}

</style>

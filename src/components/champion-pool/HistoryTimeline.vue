<template>
  <div class="history-timeline">
    <div v-if="batches.length === 0" class="empty-state">
      <span class="text-gray-500">No events recorded</span>
    </div>

    <div v-for="(batch, batchIndex) in batches" :key="batchIndex" class="timeline-batch">
      <!-- Batch Time Header (Optional: showing time gap between batches) -->
      <div v-if="shouldShowTimeHeader(batch, batches[batchIndex - 1])" class="time-header">
         <div class="time-divider">
           <span>{{ formatBatchTime(batch[0].timestamp) }}</span>
         </div>
      </div>

      <div class="batch-items">
        <HistoryTimelineItem
          v-for="event in batch"
          :key="event.id"
          :event="event"
          :compact="compact"
          @revert="$emit('revert', event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import HistoryTimelineItem from './HistoryTimelineItem.vue'

const props = defineProps({
  batches: {
    type: Array,
    required: true
  },
  compact: {
    type: Boolean,
    default: false
  }
})

defineEmits(['revert'])

function formatBatchTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  // Check if today
  const isToday = date.toDateString() === new Date().toDateString()
  if (isToday) {
     return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function shouldShowTimeHeader(currentBatch, prevBatch) {
  if (!prevBatch) return true // Always show for first batch
  
  // If time difference > 5 minutes, show header again? 
  // For now, since we batch tightly (4s), every batch is distinct enough to maybe warrant a header or separator.
  // Let's just always show header for every batch to clearly separate "Draft 1" from "Draft 2".
  return true
}

</script>

<style scoped>
.history-timeline {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px;
  padding-right: 8px; /* Space for scrollbar */
}

.empty-state {
  display: flex;
  justify-content: center;
  padding: 20px;
  font-size: 0.9rem;
  font-style: italic;
}

.timeline-batch {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.time-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  gap: 8px;
}

.time-divider {
  font-size: 0.65rem;
  color: #64748b;
  padding: 0 4px;
  background-color: #1e1e1e;
  border-radius: 10px;
  position: relative;
  z-index: 1;
}

/* Lines on sides */
.time-header::before,
.time-header::after {
  content: '';
  flex: 1;
  height: 1px;
  background-color: #333;
}

.batch-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>

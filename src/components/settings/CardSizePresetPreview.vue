<template>
  <div
    class="preset-preview-container"
    :class="{ active: isActive, expanded: isExpanded }"
    @click="handleClick"
  >
    <!-- Standard/Compact Preset Preview -->
    <template v-if="preset !== 'custom'">
      <div class="preset-skeleton-wrapper" :style="skeletonStyles">
        <!-- Champion Grid Preview -->
        <div class="preset-skeleton-grid" :class="preset">
          <!-- Row 1: Normal champions at normal size -->
          <div
            v-for="i in 3"
            :key="`row1-${i}`"
            class="preset-skeleton-card"
          >
            <div class="preset-skeleton-icon"></div>
          </div>

          <!-- Row 2: Normal champions at normal size -->
          <div
            v-for="i in 3"
            :key="`row2-${i}`"
            class="preset-skeleton-card"
          >
            <div class="preset-skeleton-icon"></div>
          </div>

          <!-- Row 3: Mix based on preset -->
          <template v-if="preset === 'standard'">
            <!-- Standard: All same size including unavailable -->
            <div
              v-for="i in 3"
              :key="`row3-${i}`"
              class="preset-skeleton-card"
            >
              <div class="preset-skeleton-icon" :class="{ 'unavailable': i > 1 }"></div>
            </div>
          </template>
          <template v-else>
            <!-- Compact: 4 smaller squares showing unavailable size -->
            <div
              v-for="i in 4"
              :key="`row3-${i}`"
              class="preset-skeleton-card compact-unavailable"
            >
              <div class="preset-skeleton-icon unavailable"></div>
            </div>
          </template>
        </div>
      </div>

      <!-- Preset Label -->
      <div class="preset-label">
        <span class="preset-name">{{ presetName }}</span>
        <span class="preset-value">{{ presetValue }}</span>
      </div>
    </template>

    <!-- Custom Preset -->
    <template v-else>
      <div class="preset-custom-wrapper">
        <div class="preset-custom-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </div>
        <span class="preset-custom-text">CUSTOM</span>
        <div class="preset-expand-icon" :class="{ expanded: isExpanded }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  preset: {
    type: String,
    required: true,
    validator: (value) => ['standard', 'compact', 'custom'].includes(value)
  },
  isActive: {
    type: Boolean,
    default: false
  },
  isExpanded: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['select']);

const presetName = computed(() => {
  const names = {
    standard: 'Standard',
    compact: 'Compact',
    custom: 'Custom'
  };
  return names[props.preset];
});

const presetValue = computed(() => {
  const values = {
    standard: '100%',
    compact: '83%'
  };
  return values[props.preset] || '';
});

const skeletonStyles = computed(() => {
  return {
    '--preview-card-scale': 1,
    '--preview-unavailable-scale': 0.83
  };
});

function handleClick() {
  emit('select', props.preset);
}
</script>

<style scoped>
.preset-preview-container {
  flex: 1;
  min-width: 0;
  background: #1e1e1e;
  border: 2px solid #3a3a3a;
  border-radius: 8px;
  padding: 12px 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.preset-preview-container:hover {
  border-color: #555555;
  background: #252525;
}

.preset-preview-container.active {
  border-color: #d97706;
  background: #2a2008;
  box-shadow: 0 0 8px rgba(217, 119, 6, 0.3);
}

/* Skeleton Preview Styles */
.preset-skeleton-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.preset-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  width: 100%;
  max-width: 90px;
}

/* Compact preset uses 4 columns for the last row */
.preset-skeleton-grid.compact {
  grid-template-columns: repeat(4, 1fr);
  max-width: 100px;
}

.preset-skeleton-card {
  aspect-ratio: 1 / 1;
  background: #2a2a2a;
  border-radius: 3px;
  padding: 1px;
  transition: transform 0.15s ease;
  min-width: 16px;
}

.preset-skeleton-card:hover {
  transform: scale(1.1);
}

/* Compact unavailable cards are smaller */
.preset-skeleton-card.compact-unavailable {
  transform: scale(0.83);
}

.preset-skeleton-icon {
  width: 100%;
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%);
}

.preset-skeleton-icon.unavailable {
  background: linear-gradient(135deg, #252525 0%, #1a1a1a 100%);
  filter: grayscale(100%);
  opacity: 0.6;
}

/* Preset Label */
.preset-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.preset-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: #e0e0e0;
}

.preset-value {
  font-size: 0.65rem;
  color: #888888;
}

.preset-preview-container.active .preset-name {
  color: #fbbf24;
}

/* Custom Preset Styles */
.preset-custom-wrapper {
  width: 100%;
  height: 100%;
  min-height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.preset-custom-icon {
  width: 32px;
  height: 32px;
  color: #888888;
}

.preset-custom-text {
  font-size: 0.8rem;
  font-weight: 700;
  color: #888888;
  letter-spacing: 0.5px;
}

.preset-expand-icon {
  width: 16px;
  height: 16px;
  color: #666666;
  transition: transform 0.2s ease;
}

.preset-expand-icon.expanded {
  transform: rotate(180deg);
}

.preset-preview-container.active .preset-custom-icon,
.preset-preview-container.active .preset-custom-text,
.preset-preview-container.active .preset-expand-icon {
  color: #fbbf24;
}

/* Animation for skeleton cards */
@keyframes preset-pulse {
  0%, 100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}

.preset-skeleton-card {
  animation: preset-pulse 2s ease-in-out infinite;
}

.preset-skeleton-card:nth-child(1) { animation-delay: 0s; }
.preset-skeleton-card:nth-child(2) { animation-delay: 0.1s; }
.preset-skeleton-card:nth-child(3) { animation-delay: 0.2s; }
.preset-skeleton-card:nth-child(4) { animation-delay: 0.3s; }
.preset-skeleton-card:nth-child(5) { animation-delay: 0.4s; }
.preset-skeleton-card:nth-child(6) { animation-delay: 0.5s; }
.preset-skeleton-card:nth-child(7) { animation-delay: 0.6s; }
.preset-skeleton-card:nth-child(8) { animation-delay: 0.7s; }
.preset-skeleton-card:nth-child(9) { animation-delay: 0.8s; }
.preset-skeleton-card:nth-child(10) { animation-delay: 0.9s; }
</style>

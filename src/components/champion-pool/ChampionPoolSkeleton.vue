<template>
  <div class="pool-main-area">
    <div 
      class="compact-view-container skeleton-container" 
      :class="viewClasses"
      :style="cardSizeStyles"
    >
      <div
        v-for="role in roles"
        :key="role"
        class="role-pillar skeleton-pillar"
      >
        <div class="pillar-header-icon skeleton-role-icon"></div>
        
        <div class="pillar-champions-grid skeleton-grid fluid">
          <div
            v-for="i in skeletonCardCount"
            :key="i"
            class="compact-champion-card skeleton-card"
          >
            <div class="compact-champion-icon-wrapper skeleton-icon-wrapper">
              <div class="skeleton-icon"></div>
              <div class="champion-icon-corners"></div>
            </div>
            <span class="compact-champion-name skeleton-name"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']

const viewClasses = computed(() => ({
  'compact-mode': settingsStore.settings.pool.compactMode,
  'no-animations': true, // Disable animations for skeleton
  'center-cards': settingsStore.settings.pool.centerCards
}))

const cardSizeStyles = computed(() => {
  const normalSize = settingsStore.settings.pool.normalCardSize || 100
  const highlightSize = settingsStore.settings.pool.highlightCardSize || 100
  const unavailableSize = settingsStore.settings.pool.unavailableCardSize || 83
  
  return {
    '--normal-card-scale': normalSize / 100,
    '--highlight-card-scale': highlightSize / 100,
    '--unavailable-card-scale': unavailableSize / 100,
    '--normal-font-scale': normalSize / 100,
    '--highlight-font-scale': highlightSize / 100,
    '--unavailable-font-scale': unavailableSize / 100
  }
})

// Show a reasonable number of skeleton cards per role
const skeletonCardCount = computed(() => {
  // League of Legends has ~170 champions, distributed across 5 roles
  // Each role typically has 30-50 champions, so we show 45 to cover most cases
  return 45
})
</script>

<style scoped>
.skeleton-container {
  opacity: 0.8;
}

.skeleton-role-icon {
  width: 24px !important;
  height: 24px !important;
  border-radius: 50% !important;
  background: linear-gradient(
    90deg,
    #2a2a2a 25%,
    #333333 50%,
    #2a2a2a 75%
  ) !important;
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border: 1px solid #3a3a3a !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) !important;
}

.skeleton-grid {
  gap: 4px !important;
}

.skeleton-card {
  pointer-events: none;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-icon {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    #1e1e1e 25%,
    #2a2a2a 50%,
    #1e1e1e 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border: 1px solid #2a2a2a;
}

.skeleton-name {
  display: block !important;
  width: 60px;
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    #1e1e1e 25%,
    #2a2a2a 50%,
    #1e1e1e 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  margin: 0 auto;
}

.champion-icon-corners {
  display: none;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@keyframes skeleton-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* Delay each card's animation slightly for a wave effect */
.skeleton-card:nth-child(1) { animation-delay: 0s; }
.skeleton-card:nth-child(2) { animation-delay: 0.05s; }
.skeleton-card:nth-child(3) { animation-delay: 0.1s; }
.skeleton-card:nth-child(4) { animation-delay: 0.15s; }
.skeleton-card:nth-child(5) { animation-delay: 0.2s; }
.skeleton-card:nth-child(6) { animation-delay: 0.25s; }
.skeleton-card:nth-child(7) { animation-delay: 0.3s; }
.skeleton-card:nth-child(8) { animation-delay: 0.35s; }
.skeleton-card:nth-child(9) { animation-delay: 0.4s; }
.skeleton-card:nth-child(10) { animation-delay: 0.45s; }
.skeleton-card:nth-child(n+11) { animation-delay: 0.5s; }
</style>

<template>
  <div class="series-manager" :class="{ 'is-expanded': isExpanded }">
    <div class="series-manager-content">
      <!-- Skeleton Loading -->
      <div v-if="seriesStore.isLoadingSeries" class="skeleton-loading">
        <div v-for="i in 3" :key="i" class="skeleton-item">
          <div class="skeleton-item-content">
            <div class="skeleton-header">
              <div class="skeleton-title"></div>
              <div class="skeleton-date"></div>
            </div>
            <div class="skeleton-preview">
              <div class="skeleton-game" v-for="j in 3" :key="j"></div>
            </div>
          </div>
          <div class="skeleton-item-actions">
            <div class="skeleton-action-button"></div>
          </div>
        </div>
      </div>
      <p
        v-else-if="
          !seriesStore.isLoadingSeries && seriesStore.savedSeries.length === 0
        "
        class="empty-text"
      >
        No drafts saved.
      </p>
      <div v-else class="series-list">
        <div
          v-for="series in seriesStore.savedSeries"
          :key="series.id"
          class="series-item"
          :class="{
            'active-series': seriesStore.currentSeries?.id === series.id,
          }"
          @click="handleLoadSeries(series.id)"
        >
          <div class="series-item-content">
            <div class="series-item-header">
              <span class="series-item-name">{{
                series.name || "Unnamed Series"
              }}</span>
              <span v-if="series.updatedAt" class="series-item-date">
                {{ formatDate(series.updatedAt) }}
              </span>
            </div>
            <div
              v-if="
                seriesStore.currentSeries?.id === series.id &&
                seriesStore.hasUnsavedChanges()
              "
              class="unsaved-badge"
            ></div>
            <!-- Series Preview -->
            <div
              v-if="series.games && series.games.length > 0"
              class="series-preview"
            >
              <div
                v-for="(game, idx) in series.games.slice(0, 3)"
                :key="game.id"
                class="preview-game"
                :class="{
                  'active-game':
                    seriesStore.currentSeries?.id === series.id &&
                    seriesStore.currentGameNumber === game.gameNumber,
                }"
                @click.stop="handleLoadGame(series.id, game.gameNumber)"
              >
                <span class="preview-game-number">G{{ game.gameNumber }}</span>
                <button class="preview-draft-button">
                  {{ game.drafts?.length || 0 }}
                </button>
              </div>
              <span v-if="series.games.length > 3" class="preview-more">
                +{{ series.games.length - 3 }} more
              </span>
            </div>
          </div>
          <div class="series-item-actions">
            <button
              @click.stop="handleDeleteSeries(series.id, series.name)"
              class="action-button delete-button"
              title="Delete Series"
            >
              <svg><use href="#icon-trash"></use></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Toggle Button -->
    <button 
      class="series-manager-toggle" 
      @click="isExpanded = !isExpanded"
      :class="{ 'is-expanded': isExpanded }"
      title="Toggle Saved Series"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path v-if="isExpanded" d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>
        <path v-else d="M15 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useSeriesStore } from "@/stores/series";
import { useConfirmationStore } from "@/stores/confirmation";

const seriesStore = useSeriesStore();
const confirmationStore = useConfirmationStore();
const isExpanded = ref(false);

function formatDate(date) {
  if (!date) return "Unknown";

  const d =
    date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString("en-US");
}

async function handleLoadSeries(seriesId) {
  try {
    // If series is already loaded, just ensure we're on the first available game
    if (seriesStore.currentSeries?.id === seriesId) {
      const firstGameNumber =
        seriesStore.currentSeries.games?.[0]?.gameNumber || 1;
      if (seriesStore.currentGame?.gameNumber !== firstGameNumber) {
        seriesStore.setCurrentGame(firstGameNumber);
      }
      return;
    }

    // Check for unsaved changes before loading a different series
    if (seriesStore.hasUnsavedChanges()) {
      const confirmed = await new Promise((resolve) => {
        confirmationStore.open({
          message:
            "You have unsaved changes in the current draft. Loading a different series will discard these changes. Continue?",
          confirmAction: () => resolve(true),
          cancelAction: () => resolve(false),
          isDanger: true,
        });
      });

      if (!confirmed) return;
    }

    // Load the series and default to the first available game
    await seriesStore.loadSeries(seriesId);
    const firstGameNumber =
      seriesStore.currentSeries?.games?.[0]?.gameNumber || 1;
    if (seriesStore.currentGame?.gameNumber !== firstGameNumber) {
      seriesStore.setCurrentGame(firstGameNumber);
    }
  } catch (error) {
    console.error("Error loading series:", error);
    alert("Failed to load series. See console for details.");
  }
}

async function handleLoadGame(seriesId, gameNumber) {
  try {
    // If series is not loaded, load it with the specific game number
    if (seriesStore.currentSeries?.id !== seriesId) {
      await seriesStore.loadSeries(seriesId, gameNumber);
    } else {
      // Series already loaded, just switch game
      seriesStore.setCurrentGame(gameNumber);
    }
  } catch (error) {
    console.error("Error loading game:", error);
    alert("Failed to load game. See console for details.");
  }
}

function handleDeleteSeries(seriesId, seriesName) {
  confirmationStore.open({
    message: `Are you sure you want to permanently delete '${seriesName || "this series"}'? This will delete all games, drafts, and notes associated with it. This cannot be undone.`,
    confirmAction: async () => {
      try {
        await seriesStore.deleteSeries(seriesId);
      } catch (error) {
        console.error("Error deleting series:", error);
        alert("Failed to delete series. See console for details.");
      }
    },
    isDanger: true,
  });
}
</script>

<style scoped>
.series-manager {
  @apply bg-card border-l border-border h-full flex relative transition-all duration-300;
  width: 0;
  min-width: 0;
  overflow: visible; /* Need this to show the toggle button outside */
}

.series-manager.is-expanded {
  width: 200px;
  min-width: 200px;
}

.series-manager-toggle {
  @apply absolute top-1/2 -left-6 w-6 h-12 bg-card border border-r-0 border-border rounded-l flex items-center justify-center cursor-pointer hover:bg-accent text-muted-foreground hover:text-foreground transition-colors;
  transform: translateY(-50%);
  z-index: 50; /* Ensure it's above other elements */
}

.series-manager-toggle.is-expanded svg {
  transform: rotate(180deg);
}

.series-manager-content {
  @apply flex-1 overflow-y-auto p-2 w-full h-full;
  /* Prevent content showing when collapsing */
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.2s, visibility 0s linear 0.3s;
}

.series-manager.is-expanded .series-manager-content {
  visibility: visible;
  opacity: 1;
  transition: opacity 0.2s 0.1s;
}

.loading-text,
.empty-text {
  @apply text-center py-12 px-4 text-muted-foreground text-sm flex items-center justify-center h-full;
}

.empty-hint {
  @apply text-xs text-muted-foreground mt-2 block;
}

.series-list {
  @apply flex flex-col gap-2;
}

.series-item {
  @apply bg-secondary border border-border rounded-md p-3 flex justify-between items-start gap-3 transition-colors cursor-pointer hover:bg-secondary/80 relative;
}

.series-item.active-series {
  @apply border-primary bg-primary/5;
}

.series-item-content {
  @apply flex-1 min-w-0;
}

.series-item-header {
  @apply flex flex-col gap-0.5 mb-2;
}

.series-item-name {
  @apply font-semibold text-foreground text-sm overflow-hidden text-ellipsis whitespace-nowrap;
}

.series-item-date {
  @apply text-[11px] text-muted-foreground font-mono;
}

.unsaved-badge {
  @apply absolute -top-2.5 -right-2.5 w-4 h-4 bg-amber-500 rounded-full border-2 border-card;
}

.series-preview {
  @apply flex flex-wrap gap-2 mt-2 pt-2 border-t border-border;
}

.preview-game {
  @apply flex items-center gap-1 text-xs text-muted-foreground bg-card px-2 py-1 rounded cursor-pointer hover:bg-accent transition-colors;
}

.preview-game.active-game {
  @apply border border-primary text-foreground;
}

.preview-game-number {
  @apply font-semibold text-foreground;
}

.preview-draft-button {
  @apply w-4 h-4 p-0 font-medium bg-secondary text-foreground border border-border rounded-full text-xs flex items-center justify-center hover:bg-secondary/80 transition-colors;
}

.preview-more {
  @apply text-xs text-muted-foreground self-center;
}

.series-item-actions {
  @apply flex flex-col gap-1 flex-shrink-0;
}

.action-button {
  @apply bg-transparent border border-border text-muted-foreground p-1.5 rounded cursor-pointer flex items-center justify-center transition-all w-7 h-7 hover:border-accent hover:text-foreground hover:bg-accent;
}

.delete-button {
  @apply text-white hover:border-destructive hover:bg-destructive;
}

.delete-button svg {
  @apply text-white;
}

.action-button svg {
  width: 14px;
  height: 14px;
}

.series-manager-content::-webkit-scrollbar {
  width: 4px;
}

.series-manager-content::-webkit-scrollbar-track {
  @apply bg-card;
}

.series-manager-content::-webkit-scrollbar-thumb {
  @apply bg-border rounded;
}

.series-manager-content::-webkit-scrollbar-thumb:hover {
  @apply bg-muted-foreground;
}

/* Skeleton Loading */
.skeleton-loading {
  @apply flex flex-col gap-2;
}

.skeleton-item {
  @apply bg-secondary border border-border rounded-md p-3 flex justify-between items-start gap-3 animate-pulse relative;
}

.skeleton-item-content {
  @apply flex-1 min-w-0;
}

.skeleton-header {
  @apply flex flex-col gap-0.5 mb-2;
}

.skeleton-title {
  @apply bg-muted-foreground/20 h-4 rounded w-3/4;
}

.skeleton-date {
  @apply bg-muted-foreground/20 h-3 rounded w-1/2;
}

.skeleton-preview {
  @apply flex flex-wrap gap-2 mt-2 pt-2 border-t border-border;
}

.skeleton-game {
  @apply bg-muted-foreground/20 h-6 w-12 rounded;
}

.skeleton-item-actions {
  @apply flex flex-col gap-1 flex-shrink-0;
}

.skeleton-action-button {
  @apply bg-muted-foreground/20 w-7 h-7 rounded animate-pulse;
}
</style>

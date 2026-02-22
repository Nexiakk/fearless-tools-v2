<template>
  <div class="drafting-view-wrapper">
    <!-- Series Navigator removed from top bar -->
    
    <div v-if="workspaceStore.hasWorkspace" class="draft-creator-container">
      <!-- Main Drafting Content -->
      <div class="draft-creator-view">
        <div v-if="!seriesStore.hasSeries" class="no-series-container">
          <p class="no-series-text">Initializing series...</p>
        </div>

        <div v-else-if="!currentDraft" class="no-draft-container">
          <p class="no-draft-text">
            No draft available. Add a draft iteration to the current game.
          </p>
        </div>

        <div v-else class="draft-creator-main-wrapper">
          <!-- Side Indicators -->
          <div class="draft-indicator-container">
            <div class="indicator-rect blue-indicator"></div>
            <div class="indicator-rect red-indicator"></div>
          </div>

          <!-- Bans Header -->
          <div class="draft-creator-bans-header">
            <!-- Blue Bans -->
            <div class="draft-creator-bans blue-bans">
              <DraftSlot
                v-for="i in 3"
                :key="`blue-ban-${i}`"
                side="blue"
                type="bans"
                :index="i - 1"
                :champion="currentDraft.blueBans[i - 1].champion"
                :selected-for-move="
                  draftingStore.selectedChampionSource?.side === 'blue' &&
                  draftingStore.selectedChampionSource?.type === 'bans' &&
                  draftingStore.selectedChampionSource?.index === i - 1"
                :selected-for-targeting="
                  draftingStore.selectedTargetSlot?.side === 'blue' &&
                  draftingStore.selectedTargetSlot?.type === 'bans' &&
                  draftingStore.selectedTargetSlot?.index === i - 1 &&
                  !currentDraft.blueBans[i - 1].champion"
                :icon-context="'ban'"
                @click="handleSlotClick"
                @clear="handleClearSlot"
              />
              <div class="ban-group-separator horizontal"></div>
              <DraftSlot
                v-for="i in 2"
                :key="`blue-ban-${i + 3}`"
                side="blue"
                type="bans"
                :index="i + 2"
                :champion="currentDraft.blueBans[i + 2].champion"
                :selected-for-move="
                  draftingStore.selectedChampionSource?.side === 'blue' &&
                  draftingStore.selectedChampionSource?.type === 'bans' &&
                  draftingStore.selectedChampionSource?.index === i + 2"
                :selected-for-targeting="
                  draftingStore.selectedTargetSlot?.side === 'blue' &&
                  draftingStore.selectedTargetSlot?.type === 'bans' &&
                  draftingStore.selectedTargetSlot?.index === i + 2 &&
                  !currentDraft.blueBans[i + 2].champion"
                :icon-context="'ban'"
                @click="handleSlotClick"
                @clear="handleClearSlot"
              />
            </div>

            <!-- Red Bans -->
            <div class="draft-creator-bans red-bans">
              <DraftSlot
                v-for="i in 2"
                :key="`red-ban-${5 - i}`"
                side="red"
                type="bans"
                :index="5 - i"
                :champion="currentDraft.redBans[5 - i].champion"
                :selected-for-move="
                  draftingStore.selectedChampionSource?.side === 'red' &&
                  draftingStore.selectedChampionSource?.type === 'bans' &&
                  draftingStore.selectedChampionSource?.index === 5 - i"
                :selected-for-targeting="
                  draftingStore.selectedTargetSlot?.side === 'red' &&
                  draftingStore.selectedTargetSlot?.type === 'bans' &&
                  draftingStore.selectedTargetSlot?.index === 5 - i &&
                  !currentDraft.redBans[5 - i].champion"
                :icon-context="'ban'"
                @click="handleSlotClick"
                @clear="handleClearSlot"
              />
              <div class="ban-group-separator horizontal"></div>
              <DraftSlot
                v-for="i in 3"
                :key="`red-ban-${3 - i}`"
                side="red"
                type="bans"
                :index="3 - i"
                :champion="currentDraft.redBans[3 - i].champion"
                :selected-for-move="
                  draftingStore.selectedChampionSource?.side === 'red' &&
                  draftingStore.selectedChampionSource?.type === 'bans' &&
                  draftingStore.selectedChampionSource?.index === 3 - i"
                :selected-for-targeting="
                  draftingStore.selectedTargetSlot?.side === 'red' &&
                  draftingStore.selectedTargetSlot?.type === 'bans' &&
                  draftingStore.selectedTargetSlot?.index === 3 - i &&
                  !currentDraft.redBans[3 - i].champion"
                :icon-context="'ban'"
                @click="handleSlotClick"
                @clear="handleClearSlot"
              />
            </div>
          </div>

          <!-- Main Content -->
          <div class="draft-creator-main-content">
            <div class="draft-creator-layout">
              <!-- Blue Side -->
              <div class="draft-creator-side blue-side">
                <h3 class="side-title">Blue Side</h3>
                <div class="draft-creator-picks">
                  <div
                    v-for="i in 5"
                    :key="`blue-pick-${i}`"
                    class="pick-row blue"
                  >
                    <span class="pick-label">B{{ i }}</span>
                    <DraftSlot
                      side="blue"
                      type="picks"
                      :index="i - 1"
                      :champion="currentDraft.bluePicks[i - 1].champion"
                      :selected-for-move="
                        draftingStore.selectedChampionSource?.side === 'blue' &&
                        draftingStore.selectedChampionSource?.type === 'picks' &&
                        draftingStore.selectedChampionSource?.index === i - 1"
                      :selected-for-targeting="
                        draftingStore.selectedTargetSlot?.side === 'blue' &&
                        draftingStore.selectedTargetSlot?.type === 'picks' &&
                        draftingStore.selectedTargetSlot?.index === i - 1 &&
                        !currentDraft.bluePicks[i - 1].champion"
                      :icon-context="'pick'"
                      @click="handleSlotClick"
                      @clear="handleClearSlot"
                    />
                  </div>
                </div>
              </div>

              <div class="draft-creator-center">
                <!-- Pool Controls -->
                <div class="draft-creator-pool-controls">
                  <!-- Series Navigator moved here -->
                  <div class="series-navigator-wrapper">
                    <SeriesNavigator />
                  </div>
                  
                  <div class="draft-creator-search-container">
                    <svg class="search-icon">
                      <use href="#icon-search"></use>
                    </svg>
                    <input
                      type="text"
                      v-model="draftingStore.draftCreatorSearchTerm"
                      placeholder="Search..."
                      class="draft-creator-search-input"
                    />
                    <button
                      v-if="draftingStore.draftCreatorSearchTerm"
                      @click="draftingStore.draftCreatorSearchTerm = ''"
                      class="clear-search-button"
                      aria-label="Clear search"
                    >
                      &times;
                    </button>
                  </div>
                  
                  <!-- Zoom Controls -->
                  <div class="grid-zoom-controls">
                    <button 
                      class="zoom-button" 
                      @click="draftingStore.zoomOutGrid()" 
                      :disabled="draftingStore.championGridZoomIndex === 0"
                      title="Decrease Grid Size"
                    >
                      <svg viewBox="0 0 24 24" class="zoom-icon"><path fill="currentColor" d="M19 13H5v-2h14v2z"/></svg>
                    </button>
                    <button 
                      class="zoom-button" 
                      @click="draftingStore.zoomInGrid()" 
                      :disabled="draftingStore.championGridZoomIndex === draftingStore.maxGridZoomIndex"
                      title="Increase Grid Size"
                    >
                      <svg viewBox="0 0 24 24" class="zoom-icon"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    </button>
                  </div>
                  
                  <div class="role-filters-container pool-filters">
                    <button
                      v-for="role in roles"
                      :key="role"
                      @click="draftingStore.setDraftCreatorRoleFilter(role)"
                      class="filter-button icon-button"
                      :class="{
                        active: draftingStore.draftCreatorRoleFilter === role,
                      }"
                      :title="`Filter by ${role}`"
                    >
                      <img
                        :src="championsStore.getRoleIconUrl(role)"
                        :alt="role"
                        class="filter-icon"
                        draggable="false"
                      />
                    </button>
                  </div>
                  
                  <!-- Sorting Toggle -->
                  <div class="draft-sort-container">
                    <button
                      class="sort-toggle-button"
                      :class="{ active: draftingStore.draftCreatorSortMode === 'alphabetical' }"
                      @click="draftingStore.draftCreatorSortMode = 'alphabetical'"
                      title="Sort Alphabetical"
                    >
                      A-Z
                    </button>
                    <button
                      class="sort-toggle-button"
                      :class="{ active: draftingStore.draftCreatorSortMode === 'tier' }"
                      @click="draftingStore.draftCreatorSortMode = 'tier'"
                      title="Sort by Tier"
                    >
                      Tier
                    </button>
                  </div>
                </div>

                <!-- Champion Grid -->
                <transition-group 
                  name="grid-anim" 
                  tag="div" 
                  class="draft-creator-champion-grid" 
                  :style="{ '--card-scale': currentZoomScale }"
                >
                  <div
                    v-for="champion in filteredChampions"
                    :key="champion.id"
                    class="draft-creator-champion-card"
                    :class="{
                      'selected-for-placement':
                        draftingStore.selectedChampionForPlacement ===
                        champion.name,
                      'already-placed':
                        isChampionPlacedInCurrentDraft(champion.name),
                      'is-picked': draftingStore.isChampionPickedInCurrentDraft(champion.name),
                      'is-banned': draftingStore.isChampionBannedInCurrentDraft(champion.name),
                      'selected-as-source':
                        draftingStore.selectedChampionSource &&
                        draftingStore.selectedChampionSource.championName ===
                          champion.name,
                      unavailable: !isChampionAvailable(champion.name),
                      'has-tier': getTierHighlightClass(champion) !== ''
                    }"
                    :style="getChampionCardStyle(champion)"
                    @click="handleChampionClick(champion.name)"
                    :title="champion.name"
                  >
                    <div class="champion-image-container">
                      <img
                        class="champion-icon"
                        :src="
                          championsStore.getChampionIconUrl(
                            champion.name,
                            'creator-pool'
                          )
                        "
                        :alt="champion.name"
                        loading="lazy"
                        draggable="false"
                      />
                    </div>

                    <!-- Tier badge -->
                    <div class="draft-tier-badge" v-if="getTierHighlightClass(champion)" :style="{ backgroundColor: getTierColor(champion), color: '#ffffff' }">
                       {{ getTierBadgeText(champion) }}
                    </div>
                    <div class="champion-label">
                      <span class="champion-name-text">{{ champion.name }}</span>
                    </div>
                  </div>
                  <p
                    v-if="filteredChampions.length === 0"
                    key="empty-state"
                    class="text-gray-400 col-span-full text-center py-4"
                  >
                    No champions match filter/search.
                  </p>
                </transition-group>
              </div>

              <!-- Red Side -->
              <div class="draft-creator-side red-side">
                <h3 class="side-title">Red Side</h3>
                <div class="draft-creator-picks">
                  <div
                    v-for="i in 5"
                    :key="`red-pick-${i}`"
                    class="pick-row red"
                  >
                    <DraftSlot
                      side="red"
                      type="picks"
                      :index="i - 1"
                      :champion="currentDraft.redPicks[i - 1].champion"
                      :selected-for-move="
                        draftingStore.selectedChampionSource?.side === 'red' &&
                        draftingStore.selectedChampionSource?.type === 'picks' &&
                        draftingStore.selectedChampionSource?.index === i - 1"
                      :selected-for-targeting="
                        draftingStore.selectedTargetSlot?.side === 'red' &&
                        draftingStore.selectedTargetSlot?.type === 'picks' &&
                        draftingStore.selectedTargetSlot?.index === i - 1 &&
                        !currentDraft.redPicks[i - 1].champion"
                      :icon-context="'pick'"
                      @click="handleSlotClick"
                      @clear="handleClearSlot"
                    />
                    <span class="pick-label">R{{ i }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Saved Series Sidebar -->
        <SeriesManager />
      </div>
    </div>

    <div v-else class="flex items-center justify-center h-screen">
      <p class="text-gray-400">Please join a workspace to continue</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { useWorkspaceStore } from "@/stores/workspace";
import { useDraftingStore } from "@/stores/drafting";
import { useDraftStore } from "@/stores/draft";
import { useSeriesStore } from "@/stores/series";
import { useChampionsStore } from "@/stores/champions";
import { useConfirmationStore } from "@/stores/confirmation";
import { useSettingsStore } from "@/stores/settings";
import SeriesNavigator from "@/components/drafting/SeriesNavigator.vue";
import SeriesManager from "@/components/drafting/SeriesManager.vue";
import DraftSlot from "@/components/drafting/DraftSlot.vue";
import { useWorkspaceTiersStore } from "@/stores/workspaceTiers";

const workspaceStore = useWorkspaceStore();
const draftingStore = useDraftingStore();
const draftStore = useDraftStore();
const seriesStore = useSeriesStore();
const championsStore = useChampionsStore();
const confirmationStore = useConfirmationStore();
const settingsStore = useSettingsStore();
const workspaceTiersStore = useWorkspaceTiersStore();

const zoomScales = [0.57, 0.62, 0.67, 0.73, 0.81, 0.9, 1.0, 1.14];
const currentZoomScale = computed(() => zoomScales[draftingStore.championGridZoomIndex]);

const roles = ["Top", "Jungle", "Mid", "Bot", "Support"];

const roleMap = {
  'Top': 'top',
  'Jungle': 'jungle',
  'Mid': 'middle',
  'Bot': 'bottom',
  'Support': 'support'
};

function getCurrentRoleFilter() {
  if (draftingStore.draftCreatorRoleFilter !== "all" && roleMap[draftingStore.draftCreatorRoleFilter]) {
    return roleMap[draftingStore.draftCreatorRoleFilter];
  }
  return null;
}

// Get current draft from series store
const currentDraft = computed(() => {
  return (
    seriesStore.currentDraft || {
      bluePicks: Array(5)
        .fill(null)
        .map(() => ({ champion: null, notes: "" })),
      blueBans: Array(5)
        .fill(null)
        .map(() => ({ champion: null, notes: "" })),
      redPicks: Array(5)
        .fill(null)
        .map(() => ({ champion: null, notes: "" })),
      redBans: Array(5)
        .fill(null)
        .map(() => ({ champion: null, notes: "" })),
      generalNotes: "",
    }
  );
});

// Get unavailable champions for current game
const unavailableChampions = computed(() => {
  if (
    !settingsStore.settings.drafting?.integrateUnavailableChampions
  ) {
    return new Set();
  }
  
  const unavailable = new Set();
  
  // Add champions from previous games in the series
  if (seriesStore.currentGame) {
    const gameUnavailable = seriesStore.getUnavailableChampionsForGame(
      seriesStore.currentGame.gameNumber
    );
    gameUnavailable.forEach(champ => unavailable.add(champ));
  }
  
  // Add champions from the Fearless Pool (only unavailable/picked champions, not banned)
  if (draftStore.unavailableChampions) {
    draftStore.unavailableChampions.forEach(champ => unavailable.add(champ));
  }
  
  return unavailable;
});

// Filter champions with unavailable check
const filteredChampions = computed(() => {
  if (!championsStore.allChampions || championsStore.allChampions.length === 0)
    return [];

  const normalizeString = (str) => str.toLowerCase().replace(/[^a-z0-9]/gi, "");
  let champs = [...championsStore.allChampions];

  // Filter by role
  const filterRole = getCurrentRoleFilter();
  if (filterRole) {
    champs = champs.filter(
      (c) =>
        Array.isArray(c.roles) &&
        c.roles.includes(filterRole)
    );
  }

  // Filter by search term
  if (draftingStore.draftCreatorSearchTerm.trim() !== "") {
    const normalizedSearch = normalizeString(
      draftingStore.draftCreatorSearchTerm.trim()
    );
    champs = champs.filter((c) =>
      normalizeString(c.name).includes(normalizedSearch)
    );
  }

  // Add tier and availability states to objects
  champs = champs.map(c => {
    const isAvail = isChampionAvailable(c.name);
    // Is it placed in the *current* draft specifically?
    const isPlaced = isChampionPlacedInCurrentDraft(c.name);
    return {
      ...c,
      isAvailable: isAvail,
      isPlaced: isPlaced,
      isHidden: (!isAvail && settingsStore.settings.drafting?.pickedMode === 'hidden') || (isPlaced && settingsStore.settings.drafting?.pickedMode === 'hidden'),
      sortTierScore: getChampionTierScore(c.name),
      isUnavailableOrPlaced: !isAvail || isPlaced
    }
  });

  // Sort logic
  champs.sort((a, b) => {
    // 1. Picked mode sorting grouping
    const pickedMode = settingsStore.settings.drafting?.pickedMode || 'default';
    if (pickedMode === 'bottom') {
      if (!a.isAvailable && b.isAvailable) return 1;
      if (a.isAvailable && !b.isAvailable) return -1;
    }

    // 2. Main sort selection
    if (draftingStore.draftCreatorSortMode === 'tier') {
      // Primary: Tier score (higher is better so sort descending)
      if (a.sortTierScore !== b.sortTierScore) return b.sortTierScore - a.sortTierScore;
    }
    
    // Fallback: Alphabetical
    return a.name.localeCompare(b.name);
  });

  return champs.filter(c => !c.isHidden);
});

function getChampionTierScore(championName) {
  const filterRole = getCurrentRoleFilter();
  const tier = workspaceTiersStore.getTierForChampion(championName, filterRole);
  if (!tier) return 0;
  
  // Highest ID weight based on `workspaceTiersStore.sortedTiers`
  const reversedTiers = [...workspaceTiersStore.sortedTiers].reverse();
  const idx = reversedTiers.findIndex(rt => rt.id === tier.id);
  
  return idx + 1; // +1 to ensure untiered is 0
}

function getTierHighlightClass(champion) {
   const mode = settingsStore.settings.drafting?.tierHighlightMode || 'sort';
   if (mode === 'none') return '';
   if (mode === 'sort' && draftingStore.draftCreatorSortMode !== 'tier') return '';
   
   const filterRole = getCurrentRoleFilter();
   const tier = workspaceTiersStore.getTierForChampion(champion.name, filterRole);
   if (!tier) return '';
   
   return tier.id.toLowerCase();
}

function getTierBadgeText(champion) {
   const filterRole = getCurrentRoleFilter();
   const tier = workspaceTiersStore.getTierForChampion(champion.name, filterRole);
   if (!tier) return '';
   
   return tier.name.charAt(0).toUpperCase();
}

function getTierColor(champion) {
   const mode = settingsStore.settings.drafting?.tierHighlightMode || 'sort';
   if (mode === 'none') return '';
   if (mode === 'sort' && draftingStore.draftCreatorSortMode !== 'tier') return '';
   
   const filterRole = getCurrentRoleFilter();
   const tier = workspaceTiersStore.getTierForChampion(champion.name, filterRole);
   return tier ? tier.color : '';
}

function getChampionCardStyle(champion) {
  const color = getTierColor(champion);
  if (!color) return {};
  
  const filterRole = getCurrentRoleFilter();
  const tier = workspaceTiersStore.getTierForChampion(champion.name, filterRole);
  if (!tier) return {};

  if (tier.style === 'border') {
    return { border: `1px solid ${color}` };
  } else if (tier.style === 'highlight') {
    return {
      border: `1px solid ${color}CC`,
      boxShadow: `0 0 4px 1px ${color}99`
    };
  } else {
    // Default to shadow style
    return {
      border: `1px solid ${color}CC`,
      boxShadow: `0 0 4px 1px ${color}99`
    };
  }
}

// Check if champion is available. Now just returns actual boolean since logic is extracted
const isChampionAvailable = (championName) => {
  if (!settingsStore.settings.drafting?.integrateUnavailableChampions) {
    return true;
  }
  return !unavailableChampions.value.has(championName);
};

// Returns false if placed OR unavailable to prevent selection
const isChampionAvailableForPlacement = (championName) => {
  return isChampionAvailable(championName) && !isChampionPlacedInCurrentDraft(championName);
};

const handleImageError = (e) => {
  e.target.style.opacity = "0.5";
};

// Slot click handler
function handleSlotClick(slotData) {
  const { side, type, index } = slotData;
  if (!currentDraft.value) return;

  const slotKey = `${side}${type.charAt(0).toUpperCase() + type.slice(1)}`;
  const slot = currentDraft.value[slotKey]?.[index];

  // Check if clicking the same slot that's already selected for source - deselect it
  if (
    draftingStore.selectedChampionSource &&
    draftingStore.selectedChampionSource.side === side &&
    draftingStore.selectedChampionSource.type === type &&
    draftingStore.selectedChampionSource.index === index
  ) {
    draftingStore.selectedChampionSource = null;
    return;
  }

  // Check if clicking the same slot that's already selected for targeting - deselect it
  if (
    draftingStore.selectedTargetSlot &&
    draftingStore.selectedTargetSlot.side === side &&
    draftingStore.selectedTargetSlot.type === type &&
    draftingStore.selectedTargetSlot.index === index
  ) {
    draftingStore.selectedTargetSlot = null;
    return;
  }

  if (draftingStore.selectedChampionForPlacement) {
    // Place champion from grid
    if (
      slot &&
      !slot.champion && 
      isChampionAvailableForPlacement(draftingStore.selectedChampionForPlacement)
    ) {
      seriesStore.updateCurrentDraftSlot(
        side,
        type,
        index,
        draftingStore.selectedChampionForPlacement
      );
      draftingStore.selectedChampionForPlacement = null;
    }
  } else if (draftingStore.selectedChampionSource) {
    // Move champion from source slot
    const sourceKey = `${draftingStore.selectedChampionSource.side}${draftingStore.selectedChampionSource.type.charAt(0).toUpperCase() + draftingStore.selectedChampionSource.type.slice(1)}`;
    const sourceSlot =
      currentDraft.value[sourceKey]?.[
        draftingStore.selectedChampionSource.index
      ];

    if (slot && sourceSlot) {
      const tempChamp = sourceSlot.champion;
      const tempNotes = sourceSlot.notes;

      sourceSlot.champion = slot.champion;
      sourceSlot.notes = slot.notes;

      slot.champion = tempChamp;
      slot.notes = tempNotes;

      draftingStore.selectedChampionSource = null;
      seriesStore.queueSave();
    }
  } else if (draftingStore.selectedTargetSlot && slot?.champion) {
    // Move champion directly to targeted empty slot
    // We already moved it to target slot, clear source
    // Ensure we don't accidentally duplicate
    const targetKey = `${draftingStore.selectedTargetSlot.side}${draftingStore.selectedTargetSlot.type.charAt(0).toUpperCase() + draftingStore.selectedTargetSlot.type.slice(1)}`;
    const targetSlot =
      currentDraft.value[targetKey]?.[
        draftingStore.selectedTargetSlot.index
      ];

    if (targetSlot && !targetSlot.champion) {
      targetSlot.champion = slot.champion;
      targetSlot.notes = slot.notes;

      slot.champion = null;
      slot.notes = '';

      draftingStore.selectedTargetSlot = null;
      seriesStore.queueSave();
    }
  } else if (slot?.champion) {
    // Select for move
    draftingStore.selectedChampionSource = {
      side,
      type,
      index,
      championName: slot.champion,
    };
  } else {
    // Select for targeting
    draftingStore.selectedTargetSlot = { side, type, index };
  }
}

// Clear slot handler
function handleClearSlot(slotData) {
  const { side, type, index } = slotData;
  if (!currentDraft.value) return;
  seriesStore.updateCurrentDraftSlot(side, type, index, null);
  if (
    draftingStore.selectedChampionSource &&
    draftingStore.selectedChampionSource.side === side &&
    draftingStore.selectedChampionSource.type === type &&
    draftingStore.selectedChampionSource.index === index
  ) {
    draftingStore.selectedChampionSource = null;
  }
  if (
    draftingStore.selectedTargetSlot &&
    draftingStore.selectedTargetSlot.side === side &&
    draftingStore.selectedTargetSlot.type === type &&
    draftingStore.selectedTargetSlot.index === index
  ) {
    draftingStore.selectedTargetSlot = null;
  }
}

// Champion click handler
function handleChampionClick(championName) {
  if (!isChampionAvailableForPlacement(championName)) {
    return; // Don't allow interaction with unavailable champions
  }

  // If targeting an empty slot, place the champion directly there
  if (draftingStore.selectedTargetSlot) {
    const targetKey = `${draftingStore.selectedTargetSlot.side}${draftingStore.selectedTargetSlot.type.charAt(0).toUpperCase() + draftingStore.selectedTargetSlot.type.slice(1)}`;
    const targetSlot = currentDraft.value[targetKey]?.[draftingStore.selectedTargetSlot.index];

    if (targetSlot && !targetSlot.champion) {
      seriesStore.updateCurrentDraftSlot(
        draftingStore.selectedTargetSlot.side,
        draftingStore.selectedTargetSlot.type,
        draftingStore.selectedTargetSlot.index,
        championName
      );
      draftingStore.selectedTargetSlot = null;
      return;
    }
  }

  draftingStore.selectChampionForPlacement(championName);
}

// Check if champion is placed in current draft
function isChampionPlacedInCurrentDraft(championName) {
  if (!currentDraft.value || !championName) return false;

  const allSlots = [
    ...currentDraft.value.bluePicks,
    ...currentDraft.value.blueBans,
    ...currentDraft.value.redPicks,
    ...currentDraft.value.redBans,
  ];

  return allSlots.some((slot) => slot.champion === championName);
}

onMounted(async () => {
  // Initialize default series if none exists
  if (!seriesStore.hasSeries) {
    seriesStore.initializeDefaultSeries();
  }

  // Always try to refresh saved series (will handle local workspace internally)
  if (workspaceStore.hasWorkspace) {
    await seriesStore.refreshSavedSeries();
  }
});
</script>

<style scoped>
/* Import the drafting tool CSS */
@import "../../css/drafting-tool.css";

.drafting-view-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
}

.draft-creator-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  max-height: 100%;
  overflow: visible; /* Changed from hidden so the toggle button can be seen */
  gap: 1rem;
}

.no-series-container,
.no-draft-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50vh;
  padding: 2rem;
}

.no-series-text,
.no-draft-text {
  color: #9ca3af;
  font-size: 1.125rem;
  text-align: center;
}

.draft-sort-container {
  display: flex;
  background-color: #1a1a1a;
  border-radius: 6px;
  padding: 3px;
  border: 1px solid #333;
}

.sort-toggle-button {
  flex: 1;
  background: transparent;
  border: none;
  color: #a0a0a0;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 4px;
  transition: all 0.2s;
}

.sort-toggle-button:hover {
  color: #fff;
}

.sort-toggle-button.active {
  background-color: #3b3b3b;
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.5);
}

/* Animations for grid filtering/sorting */
.grid-anim-move,
.grid-anim-enter-active {
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s ease !important;
}

.grid-anim-enter-from {
  opacity: 0 !important;
  transform: scale(0.6) !important;
}

/* Ensure leaving elements disappear instantly so moving elements can slide seamlessly without jumping to the top container */
.grid-anim-leave-active,
.grid-anim-leave-to {
  display: none !important;
}

.draft-creator-champion-card {
  position: relative;
}

.draft-tier-badge {
  position: absolute;
  top: -4px;
  left: -4px;
  font-size: 0.55rem;
  line-height: 0.75rem;
  font-weight: 700;
  padding: 1px 3px;
  border-radius: 3px;
  z-index: 5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}



/* Tier borders are now handled dynamically via inline styles */

.draft-creator-champion-card.tier-S .champion-icon { border: 1px solid #f87171 !important; }
.draft-creator-champion-card.tier-S .draft-tier-badge { background-color: #f87171; color: #4c0519; }

.draft-creator-champion-card.tier-A .champion-icon { border: 1px solid #facc15 !important; }
.draft-creator-champion-card.tier-A .draft-tier-badge { background-color: #facc15; color: #5a4503; }

.draft-creator-champion-card.tier-B .champion-icon { border: 1px solid #4ade80 !important; }
.draft-creator-champion-card.tier-B .draft-tier-badge { background-color: #4ade80; color: #064e3b; }

.draft-creator-champion-card.tier-C .champion-icon { border: 1px solid #60a5fa !important; }
.draft-creator-champion-card.tier-C .draft-tier-badge { background-color: #60a5fa; color: #1e3a8a; }

/* In drafting, we make the unavailable completely grey and hidden */
.draft-creator-champion-card.unavailable .champion-icon,
.draft-creator-champion-card.already-placed .champion-icon {
  filter: grayscale(100%);
  border-color: transparent !important;
  opacity: 0.4;
}
.draft-creator-champion-card.unavailable .champion-name-text,
.draft-creator-champion-card.already-placed .champion-name-text {
  opacity: 0.3;
}
.draft-creator-champion-card.unavailable .draft-tier-badge,
.draft-creator-champion-card.already-placed .draft-tier-badge {
  display: none;
}
</style>

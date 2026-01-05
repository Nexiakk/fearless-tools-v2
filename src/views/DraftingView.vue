<template>
  <div class="drafting-view-wrapper">
    <div v-if="workspaceStore.hasWorkspace" class="draft-creator-container">
      <!-- Series Navigator - Left Sidebar -->
      <SeriesNavigator v-if="workspaceStore.hasWorkspace" />
      
      <!-- Main Drafting Content -->
      <div class="draft-creator-view">
        <div v-if="!seriesStore.hasSeries" class="no-series-container">
          <p class="no-series-text">Initializing series...</p>
        </div>
        
        <div v-else-if="!currentDraft" class="no-draft-container">
          <p class="no-draft-text">No draft available. Add a draft iteration to the current game.</p>
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
          <div
            v-for="i in 3"
            :key="`blue-ban-${i}`"
            class="draft-creator-slot ban-slot"
            :class="{
              'filled': currentDraft.blueBans[i-1].champion,
              'has-notes': currentDraft.blueBans[i-1].notes,
              'selected-for-move': draftingStore.selectedChampionSource?.side === 'blue' && draftingStore.selectedChampionSource?.type === 'bans' && draftingStore.selectedChampionSource?.index === (i-1),
              'selected-for-targeting': draftingStore.selectedTargetSlot?.side === 'blue' && draftingStore.selectedTargetSlot?.type === 'bans' && draftingStore.selectedTargetSlot?.index === (i-1) && !currentDraft.blueBans[i-1].champion
            }"
            @click="handleSlotClick('blue', 'bans', i-1)"
            @contextmenu.prevent="handleClearSlot('blue', 'bans', i-1)"
            title="Click to place/move/target, Right-click to clear"
          >
            <img
              v-if="currentDraft.blueBans[i-1].champion"
              :src="championsStore.getChampionIconUrl(currentDraft.blueBans[i-1].champion, 'ban')"
              :alt="currentDraft.blueBans[i-1].champion"
              draggable="false"
              @error="handleImageError"
            />
            <button
              class="notes-toggle-button"
              @click.stop="handleToggleNotes('blue', 'bans', i-1)"
              title="Edit Notes"
            >
              <svg><use href="#icon-note"></use></svg>
            </button>
          </div>
          <div class="ban-group-separator horizontal"></div>
          <div
            v-for="i in 2"
            :key="`blue-ban-${i+3}`"
            class="draft-creator-slot ban-slot"
            :class="{
              'filled': currentDraft.blueBans[i+2].champion,
              'has-notes': currentDraft.blueBans[i+2].notes,
              'selected-for-move': draftingStore.selectedChampionSource?.side === 'blue' && draftingStore.selectedChampionSource?.type === 'bans' && draftingStore.selectedChampionSource?.index === (i+2),
              'selected-for-targeting': draftingStore.selectedTargetSlot?.side === 'blue' && draftingStore.selectedTargetSlot?.type === 'bans' && draftingStore.selectedTargetSlot?.index === (i+2) && !currentDraft.blueBans[i+2].champion
            }"
            @click="handleSlotClick('blue', 'bans', i+2)"
            @contextmenu.prevent="handleClearSlot('blue', 'bans', i+2)"
            title="Click to place/move/target, Right-click to clear"
          >
            <img
              v-if="currentDraft.blueBans[i+2].champion"
              :src="championsStore.getChampionIconUrl(currentDraft.blueBans[i+2].champion, 'ban')"
              :alt="currentDraft.blueBans[i+2].champion"
              draggable="false"
              @error="handleImageError"
            />
            <button
              class="notes-toggle-button"
              @click.stop="handleToggleNotes('blue', 'bans', i+2)"
              title="Edit Notes"
            >
              <svg><use href="#icon-note"></use></svg>
            </button>
          </div>
        </div>

        <!-- Red Bans -->
        <div class="draft-creator-bans red-bans">
          <div
            v-for="i in 2"
            :key="`red-ban-${5-i}`"
            class="draft-creator-slot ban-slot"
            :class="{
              'filled': currentDraft.redBans[5-i].champion,
              'has-notes': currentDraft.redBans[5-i].notes,
              'selected-for-move': draftingStore.selectedChampionSource?.side === 'red' && draftingStore.selectedChampionSource?.type === 'bans' && draftingStore.selectedChampionSource?.index === (5-i),
              'selected-for-targeting': draftingStore.selectedTargetSlot?.side === 'red' && draftingStore.selectedTargetSlot?.type === 'bans' && draftingStore.selectedTargetSlot?.index === (5-i) && !currentDraft.redBans[5-i].champion
            }"
            @click="handleSlotClick('red', 'bans', 5-i)"
            @contextmenu.prevent="handleClearSlot('red', 'bans', 5-i)"
            title="Click to place/move/target, Right-click to clear"
          >
            <img
              v-if="currentDraft.redBans[5-i].champion"
              :src="championsStore.getChampionIconUrl(currentDraft.redBans[5-i].champion, 'ban')"
              :alt="currentDraft.redBans[5-i].champion"
              draggable="false"
              @error="handleImageError"
            />
            <button
              class="notes-toggle-button"
              @click.stop="handleToggleNotes('red', 'bans', 5-i)"
              title="Edit Notes"
            >
              <svg><use href="#icon-note"></use></svg>
            </button>
          </div>
          <div class="ban-group-separator horizontal"></div>
          <div
            v-for="i in 3"
            :key="`red-ban-${3-i}`"
            class="draft-creator-slot ban-slot"
            :class="{
              'filled': currentDraft.redBans[3-i].champion,
              'has-notes': currentDraft.redBans[3-i].notes,
              'selected-for-move': draftingStore.selectedChampionSource?.side === 'red' && draftingStore.selectedChampionSource?.type === 'bans' && draftingStore.selectedChampionSource?.index === (3-i),
              'selected-for-targeting': draftingStore.selectedTargetSlot?.side === 'red' && draftingStore.selectedTargetSlot?.type === 'bans' && draftingStore.selectedTargetSlot?.index === (3-i) && !currentDraft.redBans[3-i].champion
            }"
            @click="handleSlotClick('red', 'bans', 3-i)"
            @contextmenu.prevent="handleClearSlot('red', 'bans', 3-i)"
            title="Click to place/move/target, Right-click to clear"
          >
            <img
              v-if="currentDraft.redBans[3-i].champion"
              :src="championsStore.getChampionIconUrl(currentDraft.redBans[3-i].champion, 'ban')"
              :alt="currentDraft.redBans[3-i].champion"
              draggable="false"
              @error="handleImageError"
            />
            <button
              class="notes-toggle-button"
              @click.stop="handleToggleNotes('red', 'bans', 3-i)"
              title="Edit Notes"
            >
              <svg><use href="#icon-note"></use></svg>
            </button>
          </div>
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
                <div
                  class="draft-creator-slot pick-slot"
                  :data-pick-order="`B${i}`"
                  :class="{
              'filled': currentDraft.bluePicks[i-1].champion,
              'has-notes': currentDraft.bluePicks[i-1].notes,
                    'selected-for-move': draftingStore.selectedChampionSource?.side === 'blue' && draftingStore.selectedChampionSource?.type === 'picks' && draftingStore.selectedChampionSource?.index === (i-1),
                    'selected-for-targeting': draftingStore.selectedTargetSlot?.side === 'blue' && draftingStore.selectedTargetSlot?.type === 'picks' && draftingStore.selectedTargetSlot?.index === (i-1) && !currentDraft.bluePicks[i-1].champion
                  }"
                  @click="handleSlotClick('blue', 'picks', i-1)"
                  @contextmenu.prevent="handleClearSlot('blue', 'picks', i-1)"
                  title="Click to place/move/target, Right-click to clear"
                >
                  <img
                    v-if="currentDraft.bluePicks[i-1].champion"
              :src="championsStore.getChampionIconUrl(currentDraft.bluePicks[i-1].champion, 'pick')"
              :alt="currentDraft.bluePicks[i-1].champion"
                    draggable="false"
                    @error="handleImageError"
                  />
                </div>
                <span class="pick-label">B{{ i }}</span>

                <!-- Sticky Note for all pick slots -->
                <StickyNote
                  :side="'blue'"
                  :type="'picks'"
                  :index="i-1"
                  :isGrouped="isSlotGrouped('blue', 'picks', i-1)"
                  :groupSlots="getSlotGroup('blue', 'picks', i-1)?.slots || []"
                  @group-toggle="handleGroupToggle"
                  @ungroup="handleUngroup"
                />
              </div>
            </div>
          </div>

          <!-- Center Column -->
          <div class="draft-creator-center">
            <!-- Pool Controls -->
            <div class="draft-creator-pool-controls">
              <div class="draft-creator-search-container">
                <svg class="search-icon"><use href="#icon-search"></use></svg>
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
              <div class="role-filters-container pool-filters">
                <button
                  v-for="role in roles"
                  :key="role"
                  @click="draftingStore.setDraftCreatorRoleFilter(role)"
                  class="filter-button icon-button"
                  :class="{ 'active': draftingStore.draftCreatorRoleFilter === role }"
                  :title="`Filter by ${role}`"
                >
                  <img :src="championsStore.getRoleIconUrl(role)" :alt="role" class="filter-icon" draggable="false" />
                </button>
              </div>
            </div>

            <!-- Champion Grid -->
            <div class="draft-creator-champion-grid">
              <div
                v-for="champion in filteredChampions"
                :key="champion.id"
                class="draft-creator-champion-card"
                :class="{
                  'selected-for-placement': draftingStore.selectedChampionForPlacement === champion.name,
                  'already-placed': isChampionPlacedInCurrentDraft(champion.name) && !(draftingStore.selectedChampionSource && draftingStore.selectedChampionSource.championName === champion.name),
                  'unavailable': !isChampionAvailable(champion.name)
                }"
                @click="handleChampionClick(champion.name)"
                @contextmenu.prevent="handleChampionNotes(champion.name)"
                :title="getChampionTooltip(champion.name)"
              >
                <img
                  class="champion-icon"
                  :src="championsStore.getChampionIconUrl(champion.name, 'creator-pool')"
                  :alt="champion.name"
                  loading="lazy"
                  draggable="false"
                />
                <span class="champion-name-text">{{ champion.name }}</span>
                <button
                  v-if="hasChampionNote(champion.name)"
                  @click.stop="handleChampionNotes(champion.name)"
                  class="champion-notes-indicator"
                  title="View/Edit Champion Notes"
                >
                  <svg><use href="#icon-note"></use></svg>
                </button>
              </div>
              <p v-if="filteredChampions.length === 0" class="text-gray-400 col-span-full text-center py-4">
                No champions match filter/search.
              </p>
            </div>

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
                <span class="pick-label">R{{ i }}</span>
                <div
                  class="draft-creator-slot pick-slot"
                  :data-pick-order="`R${i}`"
                  :class="{
              'filled': currentDraft.redPicks[i-1].champion,
              'has-notes': currentDraft.redPicks[i-1].notes,
                    'selected-for-move': draftingStore.selectedChampionSource?.side === 'red' && draftingStore.selectedChampionSource?.type === 'picks' && draftingStore.selectedChampionSource?.index === (i-1),
                    'selected-for-targeting': draftingStore.selectedTargetSlot?.side === 'red' && draftingStore.selectedTargetSlot?.type === 'picks' && draftingStore.selectedTargetSlot?.index === (i-1) && !currentDraft.redPicks[i-1].champion
                  }"
                  @click="handleSlotClick('red', 'picks', i-1)"
                  @contextmenu.prevent="handleClearSlot('red', 'picks', i-1)"
                  title="Click to place/move/target, Right-click to clear"
                >
                  <img
                    v-if="currentDraft.redPicks[i-1].champion"
                    :src="championsStore.getChampionIconUrl(currentDraft.redPicks[i-1].champion, 'pick')"
                    :alt="currentDraft.redPicks[i-1].champion"
                    draggable="false"
                    @error="handleImageError"
                  />
                </div>

                <!-- Sticky Note for all pick slots -->
                <StickyNote
                  :side="'red'"
                  :type="'picks'"
                  :index="i-1"
                  :isGrouped="isSlotGrouped('red', 'picks', i-1)"
                  :groupSlots="getSlotGroup('red', 'picks', i-1)?.slots || []"
                  @group-toggle="handleGroupToggle"
                  @ungroup="handleUngroup"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    </div>
    </div>
    
    <div v-else class="flex items-center justify-center h-screen">
      <p class="text-gray-400">Please join a workspace to continue</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed, watch, ref } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useDraftingStore } from '@/stores/drafting'
import { useSeriesStore } from '@/stores/series'
import { useChampionsStore } from '@/stores/champions'
import { useConfirmationStore } from '@/stores/confirmation'
import { useNotesStore } from '@/stores/notes'
import { useSettingsStore } from '@/stores/settings'
import { notesService } from '@/services/notes'
import SeriesNavigator from '@/components/drafting/SeriesNavigator.vue'
import StickyNote from '@/components/drafting/StickyNote.vue'

const workspaceStore = useWorkspaceStore()
const draftingStore = useDraftingStore()
const seriesStore = useSeriesStore()
const championsStore = useChampionsStore()
const confirmationStore = useConfirmationStore()
const settingsStore = useSettingsStore()

const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']

// Drafting mode computed property
const draftingMode = computed(() => settingsStore.settings.drafting?.mode || 'sandbox')
const isFearlessSyncMode = computed(() => draftingMode.value === 'fearless-sync')

// Grouped notes state management
const groupedNotes = ref(new Map()) // Map of groupKey -> group data

// Helper function to get group key
const getGroupKey = (side, type, index) => `${side}-${type}-${index}`

// Check if a slot is part of a group
const isSlotGrouped = (side, type, index) => {
  const groupKey = getGroupKey(side, type, index)
  return groupedNotes.value.has(groupKey)
}

// Get group data for a slot
const getSlotGroup = (side, type, index) => {
  const groupKey = getGroupKey(side, type, index)
  return groupedNotes.value.get(groupKey)
}

// Handle group toggle event
const handleGroupToggle = (toggleData) => {
  const { primary, partner } = toggleData

  // Create group key for the primary slot
  const primaryKey = getGroupKey(primary.side, primary.type, primary.index)
  const partnerKey = getGroupKey(partner.side, partner.type, partner.index)

  // Check if either slot is already in a group
  if (groupedNotes.value.has(primaryKey) || groupedNotes.value.has(partnerKey)) {
    return // Already grouped
  }

  // Create new group
  const groupSlots = [primary, partner]
  const groupData = {
    slots: groupSlots,
    key: `${primaryKey}+${partnerKey}`
  }

  // Add to grouped notes map
  groupedNotes.value.set(primaryKey, groupData)
  groupedNotes.value.set(partnerKey, groupData)
}

// Handle ungroup event
const handleUngroup = (groupSlots) => {
  groupSlots.forEach(slot => {
    const key = getGroupKey(slot.side, slot.type, slot.index)
    groupedNotes.value.delete(key)
  })
}

// Get current draft from series store
const currentDraft = computed(() => {
  return seriesStore.currentDraft || {
    bluePicks: Array(5).fill(null).map(() => ({ champion: null, notes: '' })),
    blueBans: Array(5).fill(null).map(() => ({ champion: null, notes: '' })),
    redPicks: Array(5).fill(null).map(() => ({ champion: null, notes: '' })),
    redBans: Array(5).fill(null).map(() => ({ champion: null, notes: '' })),
    generalNotes: ''
  }
})

// Get unavailable champions for current game
const unavailableChampions = computed(() => {
  if (!seriesStore.currentGame || !settingsStore.settings.drafting?.integrateUnavailableChampions) {
    return new Set()
  }
  return seriesStore.getUnavailableChampionsForGame(seriesStore.currentGame.gameNumber)
})

// Filter champions with unavailable check
const filteredChampions = computed(() => {
  if (!championsStore.allChampions || championsStore.allChampions.length === 0) return []
  
  const normalizeString = (str) => str.toLowerCase().replace(/[^a-z0-9]/gi, '')
  let champs = [...championsStore.allChampions]
  
  // Filter by role
  if (draftingStore.draftCreatorRoleFilter !== 'all') {
    champs = champs.filter((c) => Array.isArray(c.roles) && c.roles.includes(draftingStore.draftCreatorRoleFilter))
  }
  
  // Filter by search term
  if (draftingStore.draftCreatorSearchTerm.trim() !== '') {
    const normalizedSearch = normalizeString(draftingStore.draftCreatorSearchTerm.trim())
    champs = champs.filter((c) => normalizeString(c.name).includes(normalizedSearch))
  }
  
  return champs.sort((a, b) => a.name.localeCompare(b.name))
})

// Check if champion is available
const isChampionAvailable = (championName) => {
  if (!settingsStore.settings.drafting?.integrateUnavailableChampions) {
    return true
  }
  return !unavailableChampions.value.has(championName)
}

const handleImageError = (e) => {
  e.target.style.opacity = '0.5'
}

// Check if a slot is occupied by LCU data (cannot be edited in Fearless Sync mode)
const isSlotOccupiedByLcu = (side, type, index) => {
  if (!isFearlessSyncMode.value) return false

  // Check if this slot has a champion from LCU data
  // This would be determined by checking against LCU draft data
  // For now, we'll use a placeholder - in real implementation,
  // this would check the LCU drafts collection
  return false // TODO: Implement actual LCU slot checking
}

// Slot click handler
function handleSlotClick(side, type, index) {
  if (!currentDraft.value) return

  const slotKey = `${side}${type.charAt(0).toUpperCase() + type.slice(1)}`
  const slot = currentDraft.value[slotKey]?.[index]

  // In Fearless Sync mode, prevent editing of occupied slots
  if (isFearlessSyncMode.value && isSlotOccupiedByLcu(side, type, index)) {
    return // Cannot edit LCU-occupied slots
  }

  if (draftingStore.selectedChampionForPlacement) {
    // Place champion
    if (slot && isChampionAvailable(draftingStore.selectedChampionForPlacement)) {
      seriesStore.updateCurrentDraftSlot(side, type, index, draftingStore.selectedChampionForPlacement)
      draftingStore.selectedChampionForPlacement = null
    }
  } else if (draftingStore.selectedChampionSource) {
    // Move champion
    const sourceKey = `${draftingStore.selectedChampionSource.side}${draftingStore.selectedChampionSource.type.charAt(0).toUpperCase() + draftingStore.selectedChampionSource.type.slice(1)}`
    const sourceSlot = currentDraft.value[sourceKey]?.[draftingStore.selectedChampionSource.index]

    // Prevent moving from/to LCU-occupied slots in Fearless Sync mode
    if (isFearlessSyncMode.value) {
      const sourceOccupied = isSlotOccupiedByLcu(draftingStore.selectedChampionSource.side, draftingStore.selectedChampionSource.type, draftingStore.selectedChampionSource.index)
      const targetOccupied = isSlotOccupiedByLcu(side, type, index)
      if (sourceOccupied || targetOccupied) return
    }

    if (slot && sourceSlot) {
      const tempChamp = sourceSlot.champion
      const tempNotes = sourceSlot.notes

      sourceSlot.champion = slot.champion
      sourceSlot.notes = slot.notes

      slot.champion = tempChamp
      slot.notes = tempNotes

      draftingStore.selectedChampionSource = null
      seriesStore.queueSave()
    }
  } else if (slot?.champion) {
    // Select for move (prevent selecting LCU-occupied slots in Fearless Sync mode)
    if (!isFearlessSyncMode.value || !isSlotOccupiedByLcu(side, type, index)) {
      draftingStore.selectedChampionSource = { side, type, index, championName: slot.champion }
    }
  } else {
    // Select for targeting
    draftingStore.selectedTargetSlot = { side, type, index }
  }
}

// Clear slot handler
function handleClearSlot(side, type, index) {
  if (!currentDraft.value) return
  seriesStore.updateCurrentDraftSlot(side, type, index, null)
  if (draftingStore.selectedChampionSource && 
      draftingStore.selectedChampionSource.side === side && 
      draftingStore.selectedChampionSource.type === type && 
      draftingStore.selectedChampionSource.index === index) {
    draftingStore.selectedChampionSource = null
  }
  if (draftingStore.selectedTargetSlot && 
      draftingStore.selectedTargetSlot.side === side && 
      draftingStore.selectedTargetSlot.type === type && 
      draftingStore.selectedTargetSlot.index === index) {
    draftingStore.selectedTargetSlot = null
  }
}

// Champion click handler
function handleChampionClick(championName) {
  if (!isChampionAvailable(championName)) {
    return // Don't allow interaction with unavailable champions
  }
  draftingStore.selectChampionForPlacement(championName)
}

// Check if champion is placed in current draft
function isChampionPlacedInCurrentDraft(championName) {
  if (!currentDraft.value || !championName) return false
  
  const allSlots = [
    ...currentDraft.value.bluePicks,
    ...currentDraft.value.blueBans,
    ...currentDraft.value.redPicks,
    ...currentDraft.value.redBans
  ]
  
  return allSlots.some(slot => slot.champion === championName)
}

// Toggle notes visibility (slot-based notes)
function handleToggleNotes(side, type, index) {
  if (!currentDraft.value) return
  
  const notesStore = useNotesStore()
  const slotKey = `${side}${type.charAt(0).toUpperCase() + type.slice(1)}`
  const slot = currentDraft.value[slotKey]?.[index]
  
  if (!slot) return
  
  // Get note from notes service (checks both local and global)
  const note = notesService.getSlotNote(side, type, index, seriesStore.currentGame?.id)
  const noteSource = note?.notes || slot.notes || ''
  
  const champName = slot.champion ? ` for ${slot.champion}` : ''
  const slotLabel = `${side.charAt(0).toUpperCase()}${type.charAt(0).toUpperCase()}${index + 1}`
  
  notesStore.open({
    noteType: 'slot',
    side,
    type,
    index,
    currentNote: noteSource,
    title: `Edit Slot Notes${champName} (${slotLabel})`,
    scope: note?.gameId ? 'local' : 'global'
  })
}

// Handle champion notes
function handleChampionNotes(championName) {
  const notesStore = useNotesStore()
  
  // Get note from notes service (checks both local and global)
  const note = notesService.getChampionNote(championName, seriesStore.currentGame?.id)
  const noteSource = note?.notes || ''
  
  notesStore.open({
    noteType: 'champion',
    side: null,
    type: null,
    index: null,
    championName,
    currentNote: noteSource,
    title: `Edit Notes for ${championName}`,
    scope: note?.gameId ? 'local' : 'global'
  })
}

// Check if champion has notes
function hasChampionNote(championName) {
  return !!notesService.getChampionNote(championName, seriesStore.currentGame?.id)
}

// Get champion tooltip with notes preview
function getChampionTooltip(championName) {
  const note = notesService.getChampionNote(championName, seriesStore.currentGame?.id)
  if (note?.notes) {
    const preview = note.notes.length > 50 ? note.notes.substring(0, 50) + '...' : note.notes
    return `${championName}\n\nNotes: ${preview}\n\nRight-click to edit notes`
  }
  return `${championName}\n\nRight-click to add notes`
}



const handleEditGeneralNotes = () => {
  if (!currentDraft.value) return
  
  const notesStore = useNotesStore()
  notesStore.open({
    noteType: 'general',
    side: 'general',
    type: null,
    index: null,
    currentNote: currentDraft.value.generalNotes || '',
    title: 'Edit General Draft Notes',
    scope: 'local' // General notes are always local to the draft
  })
}

onMounted(async () => {
  // Initialize default series if none exists
  if (!seriesStore.hasSeries) {
    seriesStore.initializeDefaultSeries()
  }
  
  if (workspaceStore.hasWorkspace && !workspaceStore.isLocalWorkspace) {
    await seriesStore.refreshSavedSeries()
    
    // Load notes if series is loaded
    if (seriesStore.currentSeries?.id) {
      await notesService.loadNotesForSeries(
        workspaceStore.currentWorkspaceId,
        seriesStore.currentSeries.id
      )
      notesService.setupRealtimeSync(
        workspaceStore.currentWorkspaceId,
        seriesStore.currentSeries.id
      )
    }
  }
})

// Watch for series changes to load notes
watch(() => seriesStore.currentSeries?.id, async (seriesId) => {
  if (seriesId && workspaceStore.hasWorkspace && !workspaceStore.isLocalWorkspace) {
    await notesService.loadNotesForSeries(
      workspaceStore.currentWorkspaceId,
      seriesId
    )
    notesService.setupRealtimeSync(
      workspaceStore.currentWorkspaceId,
      seriesId
    )
  } else {
    notesService.cleanup()
  }
})
</script>

<style scoped>
/* Import the drafting tool CSS */
@import '../../css/drafting-tool.css';

.drafting-view-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
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
</style>

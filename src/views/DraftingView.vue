<template>
  <div v-if="workspaceStore.hasWorkspace" class="draft-creator-view">
    <div class="draft-creator-main-wrapper">
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
              'filled': draftingStore.currentDraft.blueBans[i-1].champion,
              'has-notes': draftingStore.currentDraft.blueBans[i-1].notes,
              'selected-for-move': draftingStore.selectedChampionSource?.side === 'blue' && draftingStore.selectedChampionSource?.type === 'bans' && draftingStore.selectedChampionSource?.index === (i-1),
              'selected-for-targeting': draftingStore.selectedTargetSlot?.side === 'blue' && draftingStore.selectedTargetSlot?.type === 'bans' && draftingStore.selectedTargetSlot?.index === (i-1) && !draftingStore.currentDraft.blueBans[i-1].champion
            }"
            @click="draftingStore.handleSlotClick('blue', 'bans', i-1)"
            @contextmenu.prevent="draftingStore.clearCreatorSlot('blue', 'bans', i-1)"
            title="Click to place/move/target, Right-click to clear"
          >
            <img
              v-if="draftingStore.currentDraft.blueBans[i-1].champion"
              :src="championsStore.getChampionIconUrl(draftingStore.currentDraft.blueBans[i-1].champion, 'ban')"
              :alt="draftingStore.currentDraft.blueBans[i-1].champion"
              draggable="false"
              @error="handleImageError"
            />
            <button
              class="notes-toggle-button"
              @click.stop="draftingStore.toggleNotesVisibility('blue', 'bans', i-1)"
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
              'filled': draftingStore.currentDraft.blueBans[i+2].champion,
              'has-notes': draftingStore.currentDraft.blueBans[i+2].notes,
              'selected-for-move': draftingStore.selectedChampionSource?.side === 'blue' && draftingStore.selectedChampionSource?.type === 'bans' && draftingStore.selectedChampionSource?.index === (i+2),
              'selected-for-targeting': draftingStore.selectedTargetSlot?.side === 'blue' && draftingStore.selectedTargetSlot?.type === 'bans' && draftingStore.selectedTargetSlot?.index === (i+2) && !draftingStore.currentDraft.blueBans[i+2].champion
            }"
            @click="draftingStore.handleSlotClick('blue', 'bans', i+2)"
            @contextmenu.prevent="draftingStore.clearCreatorSlot('blue', 'bans', i+2)"
            title="Click to place/move/target, Right-click to clear"
          >
            <img
              v-if="draftingStore.currentDraft.blueBans[i+2].champion"
              :src="championsStore.getChampionIconUrl(draftingStore.currentDraft.blueBans[i+2].champion, 'ban')"
              :alt="draftingStore.currentDraft.blueBans[i+2].champion"
              draggable="false"
              @error="handleImageError"
            />
            <button
              class="notes-toggle-button"
              @click.stop="draftingStore.toggleNotesVisibility('blue', 'bans', i+2)"
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
              'filled': draftingStore.currentDraft.redBans[5-i].champion,
              'has-notes': draftingStore.currentDraft.redBans[5-i].notes,
              'selected-for-move': draftingStore.selectedChampionSource?.side === 'red' && draftingStore.selectedChampionSource?.type === 'bans' && draftingStore.selectedChampionSource?.index === (5-i),
              'selected-for-targeting': draftingStore.selectedTargetSlot?.side === 'red' && draftingStore.selectedTargetSlot?.type === 'bans' && draftingStore.selectedTargetSlot?.index === (5-i) && !draftingStore.currentDraft.redBans[5-i].champion
            }"
            @click="draftingStore.handleSlotClick('red', 'bans', 5-i)"
            @contextmenu.prevent="draftingStore.clearCreatorSlot('red', 'bans', 5-i)"
            title="Click to place/move/target, Right-click to clear"
          >
            <img
              v-if="draftingStore.currentDraft.redBans[5-i].champion"
              :src="championsStore.getChampionIconUrl(draftingStore.currentDraft.redBans[5-i].champion, 'ban')"
              :alt="draftingStore.currentDraft.redBans[5-i].champion"
              draggable="false"
              @error="handleImageError"
            />
            <button
              class="notes-toggle-button"
              @click.stop="draftingStore.toggleNotesVisibility('red', 'bans', 5-i)"
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
              'filled': draftingStore.currentDraft.redBans[3-i].champion,
              'has-notes': draftingStore.currentDraft.redBans[3-i].notes,
              'selected-for-move': draftingStore.selectedChampionSource?.side === 'red' && draftingStore.selectedChampionSource?.type === 'bans' && draftingStore.selectedChampionSource?.index === (3-i),
              'selected-for-targeting': draftingStore.selectedTargetSlot?.side === 'red' && draftingStore.selectedTargetSlot?.type === 'bans' && draftingStore.selectedTargetSlot?.index === (3-i) && !draftingStore.currentDraft.redBans[3-i].champion
            }"
            @click="draftingStore.handleSlotClick('red', 'bans', 3-i)"
            @contextmenu.prevent="draftingStore.clearCreatorSlot('red', 'bans', 3-i)"
            title="Click to place/move/target, Right-click to clear"
          >
            <img
              v-if="draftingStore.currentDraft.redBans[3-i].champion"
              :src="championsStore.getChampionIconUrl(draftingStore.currentDraft.redBans[3-i].champion, 'ban')"
              :alt="draftingStore.currentDraft.redBans[3-i].champion"
              draggable="false"
              @error="handleImageError"
            />
            <button
              class="notes-toggle-button"
              @click.stop="draftingStore.toggleNotesVisibility('red', 'bans', 3-i)"
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
                <span class="pick-label">B{{ i }}</span>
                <div
                  class="draft-creator-slot pick-slot"
                  :data-pick-order="`B${i}`"
                  :class="{
                    'filled': draftingStore.currentDraft.bluePicks[i-1].champion,
                    'has-notes': draftingStore.currentDraft.bluePicks[i-1].notes,
                    'selected-for-move': draftingStore.selectedChampionSource?.side === 'blue' && draftingStore.selectedChampionSource?.type === 'picks' && draftingStore.selectedChampionSource?.index === (i-1),
                    'selected-for-targeting': draftingStore.selectedTargetSlot?.side === 'blue' && draftingStore.selectedTargetSlot?.type === 'picks' && draftingStore.selectedTargetSlot?.index === (i-1) && !draftingStore.currentDraft.bluePicks[i-1].champion
                  }"
                  @click="draftingStore.handleSlotClick('blue', 'picks', i-1)"
                  @contextmenu.prevent="draftingStore.clearCreatorSlot('blue', 'picks', i-1)"
                  title="Click to place/move/target, Right-click to clear"
                >
                  <img
                    v-if="draftingStore.currentDraft.bluePicks[i-1].champion"
                    :src="championsStore.getChampionIconUrl(draftingStore.currentDraft.bluePicks[i-1].champion, 'pick')"
                    :alt="draftingStore.currentDraft.bluePicks[i-1].champion"
                    draggable="false"
                    @error="handleImageError"
                  />
                  <button
                    class="notes-toggle-button"
                    @click.stop="draftingStore.toggleNotesVisibility('blue', 'picks', i-1)"
                    title="Edit Notes"
                  >
                    <svg><use href="#icon-note"></use></svg>
                  </button>
                </div>
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
                v-for="champion in draftingStore.filteredChampions"
                :key="champion.id"
                class="draft-creator-champion-card"
                :class="{
                  'selected-for-placement': draftingStore.selectedChampionForPlacement === champion.name,
                  'already-placed': draftingStore.isChampionPlacedInCurrentDraft(champion.name) && !(draftingStore.selectedChampionSource && draftingStore.selectedChampionSource.championName === champion.name)
                }"
                @click="draftingStore.selectChampionForPlacement(champion.name)"
                :title="champion.name"
              >
                <img
                  class="champion-icon"
                  :src="championsStore.getChampionIconUrl(champion.name, 'creator-pool')"
                  :alt="champion.name"
                  loading="lazy"
                  draggable="false"
                />
                <span class="champion-name-text">{{ champion.name }}</span>
              </div>
              <p v-if="draftingStore.filteredChampions.length === 0" class="text-gray-400 col-span-full text-center py-4">
                No champions match filter/search.
              </p>
            </div>

            <!-- Controls -->
            <div class="draft-creator-controls">
              <button
                @click="handleEditGeneralNotes"
                class="control-button"
                style="background-color: #6b7280; color: white;"
                title="Edit General Notes"
              >
                <svg><use href="#icon-note"></use></svg> General Notes
              </button>
              <button
                @click="handleSaveDraft"
                class="control-button save-button"
                title="Save Current Draft"
              >
                <svg><use href="#icon-check"></use></svg> Save Draft
              </button>
              <button
                @click="handleResetDraft"
                class="control-button reset-button"
                title="Reset Current Draft"
              >
                <svg><use href="#icon-trash"></use></svg> Reset
              </button>
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
                <div
                  class="draft-creator-slot pick-slot"
                  :data-pick-order="`R${i}`"
                  :class="{
                    'filled': draftingStore.currentDraft.redPicks[i-1].champion,
                    'has-notes': draftingStore.currentDraft.redPicks[i-1].notes,
                    'selected-for-move': draftingStore.selectedChampionSource?.side === 'red' && draftingStore.selectedChampionSource?.type === 'picks' && draftingStore.selectedChampionSource?.index === (i-1),
                    'selected-for-targeting': draftingStore.selectedTargetSlot?.side === 'red' && draftingStore.selectedTargetSlot?.type === 'picks' && draftingStore.selectedTargetSlot?.index === (i-1) && !draftingStore.currentDraft.redPicks[i-1].champion
                  }"
                  @click="draftingStore.handleSlotClick('red', 'picks', i-1)"
                  @contextmenu.prevent="draftingStore.clearCreatorSlot('red', 'picks', i-1)"
                  title="Click to place/move/target, Right-click to clear"
                >
                  <img
                    v-if="draftingStore.currentDraft.redPicks[i-1].champion"
                    :src="championsStore.getChampionIconUrl(draftingStore.currentDraft.redPicks[i-1].champion, 'pick')"
                    :alt="draftingStore.currentDraft.redPicks[i-1].champion"
                    draggable="false"
                    @error="handleImageError"
                  />
                  <button
                    class="notes-toggle-button"
                    @click.stop="draftingStore.toggleNotesVisibility('red', 'picks', i-1)"
                    title="Edit Notes"
                  >
                    <svg><use href="#icon-note"></use></svg>
                  </button>
                </div>
                <span class="pick-label">R{{ i }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Saved Drafts Sidebar -->
    <div class="draft-creator-saved">
      <h3 class="saved-title">Saved Drafts ({{ draftingStore.savedDrafts.length }})</h3>
      <div class="saved-drafts-list">
        <p v-if="draftingStore.isLoadingSavedDrafts" class="text-gray-400 text-center p-4">
          Loading saved drafts...
        </p>
        <p v-else-if="draftingStore.savedDrafts.length === 0" class="text-gray-400 text-center p-4">
          No drafts saved yet.
        </p>
        <div
          v-for="draft in draftingStore.savedDrafts"
          :key="draft.id"
          class="saved-draft-item"
          :class="{ 'active-saved-draft': draftingStore.currentDraft.id === draft.id }"
        >
          <span
            class="saved-draft-name"
            @click="draftingStore.loadSavedDraft(draft.id)"
          >
            {{ draft.name || 'Unnamed Draft' }}
          </span>
          <div class="saved-draft-actions">
            <button
              @click="handleDeleteDraft(draft.id, draft.name)"
              title="Delete Draft"
            >
              <svg><use href="#icon-trash"></use></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <div v-else class="flex items-center justify-center h-screen">
    <p class="text-gray-400">Please join a workspace to continue</p>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useDraftingStore } from '@/stores/drafting'
import { useChampionsStore } from '@/stores/champions'
import { useConfirmationStore } from '@/stores/confirmation'
import { useNotesStore } from '@/stores/notes'

const workspaceStore = useWorkspaceStore()
const draftingStore = useDraftingStore()
const championsStore = useChampionsStore()
const confirmationStore = useConfirmationStore()

const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']

const handleImageError = (e) => {
  e.target.style.opacity = '0.5'
}

const handleSaveDraft = async () => {
  try {
    await draftingStore.saveCurrentDraft()
    await draftingStore.refreshSavedDrafts()
    alert('Draft saved successfully!')
  } catch (error) {
    console.error('Error saving draft:', error)
    alert('Failed to save draft. See console for details.')
  }
}

const handleResetDraft = () => {
  confirmationStore.open({
    message: 'Are you sure you want to reset the current draft? This cannot be undone.',
    confirmAction: () => {
      draftingStore.resetCurrentDraft()
    },
    isDanger: true
  })
}

const handleDeleteDraft = (draftId, draftName) => {
  confirmationStore.open({
    message: `Are you sure you want to permanently delete '${draftName || 'this draft'}'? This cannot be undone.`,
    confirmAction: async () => {
      try {
        await draftingStore.deleteSavedDraft(draftId)
      } catch (error) {
        console.error('Error deleting draft:', error)
        alert('Failed to delete draft. See console for details.')
      }
    },
    isDanger: true
  })
}

const handleEditGeneralNotes = () => {
  const notesStore = useNotesStore()
  notesStore.open({
    side: 'general',
    type: null,
    index: null,
    currentNote: draftingStore.currentDraft.generalNotes || '',
    title: 'Edit General Draft Notes'
  })
}

onMounted(async () => {
  if (workspaceStore.hasWorkspace && !workspaceStore.isLocalWorkspace) {
    await draftingStore.refreshSavedDrafts()
  }
})
</script>

<style scoped>
/* Import the drafting tool CSS */
@import '../../css/drafting-tool.css';
</style>

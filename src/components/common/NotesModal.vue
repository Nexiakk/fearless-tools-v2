<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="notesStore.isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="handleClose"
        @keydown.escape="handleClose"
      >
        <div class="fixed inset-0 bg-black/60" @click="handleClose"></div>
        <div
          class="relative w-full max-w-md rounded-lg bg-[#1a1a1a] p-6 shadow-lg"
          @click.stop
        >
          <h3 class="text-xl font-semibold text-white mb-4">{{ notesStore.title }}</h3>
          
          <!-- Note Type Indicator -->
          <div v-if="notesStore.noteType !== 'general'" class="mb-3 flex items-center gap-2 text-sm text-gray-400">
            <span class="px-2 py-1 rounded bg-gray-700">
              {{ notesStore.noteType === 'champion' ? 'Champion Note' : 'Slot Note' }}
            </span>
          </div>
          
          <!-- Scope Selector (only for slot and champion notes, not general) -->
          <div v-if="notesStore.noteType !== 'general' && seriesStore.hasSeries" class="mb-3">
            <label class="block text-sm font-medium text-gray-300 mb-2">Scope:</label>
            <div class="flex gap-2">
              <button
                @click="notesStore.setScope('local')"
                :class="[
                  'px-4 py-2 rounded text-sm font-medium transition-colors',
                  notesStore.scope === 'local'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                ]"
              >
                This Game Only
              </button>
              <button
                @click="notesStore.setScope('global')"
                :class="[
                  'px-4 py-2 rounded text-sm font-medium transition-colors',
                  notesStore.scope === 'global'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                ]"
              >
                All Games (Global)
              </button>
            </div>
            <p class="mt-1 text-xs text-gray-500">
              {{ notesStore.scope === 'global' 
                ? 'This note will be visible across all games in the series' 
                : 'This note will only be visible in the current game' }}
            </p>
          </div>
          
          <textarea
            ref="textareaRef"
            v-model="notesStore.currentNote"
            class="w-full min-h-[150px] px-3 py-2 rounded border border-gray-700 bg-[#1a1a1a] text-white placeholder-gray-400 resize-y focus:outline-none focus:border-amber-500"
            placeholder="Enter notes here..."
            @keydown.ctrl.enter="handleSave"
            @keydown.meta.enter="handleSave"
          ></textarea>
          
          <div class="mt-4 flex justify-end gap-3">
            <button
              @click="handleClose"
              class="modal-button modal-button-cancel"
            >
              Cancel
            </button>
            <button
              @click="handleSave"
              class="modal-button modal-button-confirm"
            >
              Save & Close
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useNotesStore } from '@/stores/notes'
import { useSeriesStore } from '@/stores/series'
import { notesService } from '@/services/notes'

const notesStore = useNotesStore()
const seriesStore = useSeriesStore()
const textareaRef = ref(null)

// Auto-focus textarea when modal opens
watch(() => notesStore.isOpen, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      textareaRef.value?.focus()
    })
  }
})

const handleClose = () => {
  notesStore.close()
}

const handleSave = async () => {
  const { noteType, side, type, index, championName, currentNote, scope } = notesStore
  
  try {
    if (noteType === 'general') {
      // General draft notes (stored in draft, not separate notes system)
      seriesStore.updateCurrentDraftGeneralNotes(currentNote)
    } else if (noteType === 'slot' && side && type && index !== null) {
      // Slot-based note
      await notesService.saveSlotNote(
        side,
        type,
        index,
        currentNote,
        scope,
        seriesStore.currentGame?.id
      )
    } else if (noteType === 'champion' && championName) {
      // Champion-based note
      await notesService.saveChampionNote(
        championName,
        currentNote,
        scope,
        seriesStore.currentGame?.id
      )
    }
  } catch (error) {
    console.error('Failed to save notes:', error)
    alert('Failed to save notes.')
  } finally {
    notesStore.close()
  }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

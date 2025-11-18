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
          class="relative w-full max-w-md rounded-lg bg-gray-800 border border-gray-700 p-6 shadow-lg"
          @click.stop
        >
          <h3 class="text-xl font-semibold text-white mb-4">{{ notesStore.title }}</h3>
          
          <textarea
            ref="textareaRef"
            v-model="notesStore.currentNote"
            class="w-full min-h-[150px] px-3 py-2 rounded border border-gray-600 bg-gray-700 text-white placeholder-gray-400 resize-y focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
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
import { useDraftingStore } from '@/stores/drafting'

const notesStore = useNotesStore()
const draftingStore = useDraftingStore()
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

const handleSave = () => {
  const { side, type, index, currentNote } = notesStore
  
  try {
    if (side === 'general') {
      draftingStore.updateGeneralNotes(currentNote)
    } else if (side && type && index !== null) {
      draftingStore.updateSlotNotes(side, type, index, currentNote)
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

<template>
  <Dialog :open="notesStore.isOpen" @update:open="handleOpenChange">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ notesStore.title }}</DialogTitle>
      </DialogHeader>

      <!-- Note Type Indicator -->
      <div v-if="notesStore.noteType !== 'general'" class="flex items-center gap-2 text-sm text-muted-foreground">
        <span class="px-2 py-1 rounded bg-muted">
          {{ notesStore.noteType === 'champion' ? 'Champion Note' : 'Slot Note' }}
        </span>
      </div>

      <!-- Scope Selector (only for slot and champion notes, not general) -->
      <div v-if="notesStore.noteType !== 'general' && seriesStore.hasSeries" class="space-y-2">
        <label class="text-sm font-medium">Scope:</label>
        <div class="flex gap-2">
          <Button
            @click="notesStore.setScope('local')"
            :variant="notesStore.scope === 'local' ? 'default' : 'outline'"
            size="sm"
          >
            This Game Only
          </Button>
          <Button
            @click="notesStore.setScope('global')"
            :variant="notesStore.scope === 'global' ? 'default' : 'outline'"
            size="sm"
          >
            All Games (Global)
          </Button>
        </div>
        <p class="text-xs text-muted-foreground">
          {{ notesStore.scope === 'global'
            ? 'This note will be visible across all games in the series'
            : 'This note will only be visible in the current game' }}
        </p>
      </div>

      <Textarea
        ref="textareaRef"
        v-model="notesStore.currentNote"
        class="min-h-[150px] resize-y"
        placeholder="Enter notes here..."
        @keydown.ctrl.enter="handleSave"
        @keydown.meta.enter="handleSave"
      />

      <DialogFooter>
        <Button @click="handleClose" variant="outline">
          Cancel
        </Button>
        <Button @click="handleSave">
          Save & Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useNotesStore } from '@/stores/notes'
import { useSeriesStore } from '@/stores/series'
import { notesService } from '@/services/notes'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const notesStore = useNotesStore()
const seriesStore = useSeriesStore()
const textareaRef = ref(null)

const handleOpenChange = (open) => {
  if (!open) {
    notesStore.close()
  }
}

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
/* No custom styles needed - using shadcn components */
</style>

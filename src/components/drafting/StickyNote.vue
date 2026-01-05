<template>
  <div
    class="sticky-note"
    :class="{
      'grouped': isGrouped,
      'editing': isEditing,
      'has-content': hasContent,
      'left-side': side === 'blue',
      'right-side': side === 'red'
    }"
    @click="handleClick"
  >
    <!-- Group Toggle Button (only for individual notes that can be grouped) -->
    <button
      v-if="!isGrouped && canGroup"
      class="group-toggle"
      @click.stop="toggleGroup"
      :title="`Group with ${getGroupPartnerLabel()}`"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    </button>

    <!-- Ungroup Button (only for grouped notes) -->
    <button
      v-if="isGrouped"
      class="ungroup-toggle"
      @click.stop="ungroup"
      :title="`Separate notes`"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <line x1="22" y1="2" x2="16" y2="8"/>
        <line x1="16" y1="2" x2="22" y2="8"/>
      </svg>
    </button>

    <!-- Note Content -->
    <div class="note-content" v-if="!isEditing">
      <div class="note-text" v-if="displayText">{{ displayText }}</div>
      <div class="note-placeholder" v-else>Add note...</div>
    </div>

    <!-- Inline Editor -->
    <textarea
      v-else
      ref="editorRef"
      v-model="editText"
      class="note-editor"
      :placeholder="isGrouped ? `Notes for ${getGroupLabel()}...` : `Note for ${getSlotLabel()}...`"
      @blur="handleSave"
      @keydown.enter.exact.prevent="handleSave"
      @keydown.escape="handleCancel"
      @click.stop
    ></textarea>

    <!-- Slot Label (for individual notes) -->
    <div v-if="!isGrouped" class="slot-label">{{ getSlotLabel() }}</div>

    <!-- Group Label (for grouped notes) -->
    <div v-else class="group-label">{{ getGroupLabel() }}</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useNotesStore } from '@/stores/notes'
import { notesService } from '@/services/notes'
import { useSeriesStore } from '@/stores/series'

const props = defineProps({
  side: {
    type: String,
    required: true,
    validator: (value) => ['blue', 'red'].includes(value)
  },
  type: {
    type: String,
    required: true,
    validator: (value) => ['picks', 'bans'].includes(value)
  },
  index: {
    type: Number,
    required: true
  },
  isGrouped: {
    type: Boolean,
    default: false
  },
  groupSlots: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['group-toggle', 'ungroup'])

const notesStore = useNotesStore()
const seriesStore = useSeriesStore()

const isEditing = ref(false)
const editText = ref('')
const editorRef = ref(null)

// Get current note content
const currentNote = computed(() => {
  if (props.isGrouped) {
    // For grouped notes, combine content from all slots in the group
    return props.groupSlots.map(slot => {
      const note = notesService.getSlotNote(props.side, props.type, slot.index, seriesStore.currentGame?.id)
      return note?.notes || ''
    }).filter(text => text.trim()).join('\n\n---\n\n')
  } else {
    // For individual notes
    const note = notesService.getSlotNote(props.side, props.type, props.index, seriesStore.currentGame?.id)
    return note?.notes || ''
  }
})

// Check if note has content
const hasContent = computed(() => {
  return currentNote.value.trim().length > 0
})

// Display text (truncated for preview)
const displayText = computed(() => {
  const text = currentNote.value.trim()
  if (!text) return ''
  return text.length > 100 ? text.substring(0, 100) + '...' : text
})

// Check if this slot can be grouped
const canGroup = computed(() => {
  if (props.isGrouped) return false

  // Define groupable slot combinations
  const groupable = [
    // R1 + R2
    { side: 'red', type: 'picks', indices: [0, 1] },
    // B2 + B3
    { side: 'blue', type: 'picks', indices: [1, 2] },
    // B4 + B5
    { side: 'blue', type: 'picks', indices: [3, 4] }
  ]

  return groupable.some(group =>
    group.side === props.side &&
    group.type === props.type &&
    group.indices.includes(props.index)
  )
})

// Get partner slot for grouping
const getGroupPartner = () => {
  const partners = {
    // R1 partners with R2
    'red-picks-0': { side: 'red', type: 'picks', index: 1 },
    'red-picks-1': { side: 'red', type: 'picks', index: 0 },
    // B2 partners with B3
    'blue-picks-1': { side: 'blue', type: 'picks', index: 2 },
    'blue-picks-2': { side: 'blue', type: 'picks', index: 1 },
    // B4 partners with B5
    'blue-picks-3': { side: 'blue', type: 'picks', index: 4 },
    'blue-picks-4': { side: 'blue', type: 'picks', index: 3 }
  }

  const key = `${props.side}-${props.type}-${props.index}`
  return partners[key]
}

// Get slot label
const getSlotLabel = () => {
  const sideLetter = props.side === 'blue' ? 'B' : 'R'
  const typeLetter = props.type === 'picks' ? '' : 'B'
  return `${sideLetter}${typeLetter}${props.index + 1}`
}

// Get group label
const getGroupLabel = () => {
  if (!props.isGrouped || props.groupSlots.length === 0) return ''

  const labels = props.groupSlots.map(slot => getSlotLabelFor(slot.side, slot.type, slot.index))
  return labels.join(' + ')
}

// Get slot label for specific slot
const getSlotLabelFor = (side, type, index) => {
  const sideLetter = side === 'blue' ? 'B' : 'R'
  const typeLetter = type === 'picks' ? '' : 'B'
  return `${sideLetter}${typeLetter}${index + 1}`
}

// Get partner label for group toggle
const getGroupPartnerLabel = () => {
  const partner = getGroupPartner()
  if (!partner) return ''
  return getSlotLabelFor(partner.side, partner.type, partner.index)
}

// Handle click to edit
const handleClick = () => {
  if (isEditing.value) return

  isEditing.value = true
  editText.value = currentNote.value

  nextTick(() => {
    editorRef.value?.focus()
    editorRef.value?.select()
  })
}

// Handle save
const handleSave = async () => {
  try {
    if (props.isGrouped) {
      // For grouped notes, we need to distribute the content back to individual slots
      // This is a simplified approach - in practice, you might want a more sophisticated UI
      const sections = editText.value.split(/\n\s*---\s*\n/)
      props.groupSlots.forEach((slot, i) => {
        const content = sections[i]?.trim() || ''
        notesService.saveSlotNote(slot.side, slot.type, slot.index, content, 'local', seriesStore.currentGame?.id)
      })
    } else {
      // Save individual note
      await notesService.saveSlotNote(props.side, props.type, props.index, editText.value, 'local', seriesStore.currentGame?.id)
    }
  } catch (error) {
    console.error('Failed to save note:', error)
  }

  isEditing.value = false
}

// Handle cancel
const handleCancel = () => {
  isEditing.value = false
  editText.value = ''
}

// Toggle group
const toggleGroup = () => {
  const partner = getGroupPartner()
  if (partner) {
    emit('group-toggle', {
      primary: { side: props.side, type: props.type, index: props.index },
      partner: partner
    })
  }
}

// Ungroup
const ungroup = () => {
  emit('ungroup', props.groupSlots)
}
</script>

<style scoped>
.sticky-note {
  position: absolute;
  width: 120px;
  min-height: 80px;
  background: linear-gradient(135deg, #fef08a 0%, #fde047 100%);
  border: 2px solid #f59e0b;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
  font-size: 0.75rem;
  line-height: 1.2;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sticky-note:hover {
  transform: scale(1.02);
  box-shadow: 3px 3px 12px rgba(0, 0, 0, 0.3);
}

.sticky-note.left-side {
  left: -110px;
  top: 50%;
  transform: translateY(-50%);
}

.sticky-note.right-side {
  right: -110px;
  top: 50%;
  transform: translateY(-50%);
}

.sticky-note.grouped {
  width: 140px;
  min-height: 100px;
}

.sticky-note.editing {
  z-index: 20;
  box-shadow: 0 0 0 2px #3b82f6, 3px 3px 12px rgba(0, 0, 0, 0.3);
}

.sticky-note.has-content {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border-color: #3b82f6;
}

.note-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.note-text {
  flex: 1;
  word-wrap: break-word;
  white-space: pre-wrap;
  color: #1f2937;
  font-weight: 500;
}

.note-placeholder {
  color: #9ca3af;
  font-style: italic;
  flex: 1;
}

.note-editor {
  width: 100%;
  height: 100%;
  min-height: 60px;
  border: none;
  background: transparent;
  resize: none;
  outline: none;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  color: #1f2937;
  font-weight: 500;
}

.slot-label,
.group-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: #92400e;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: auto;
  padding-top: 4px;
  border-top: 1px solid #d97706;
}

.group-toggle,
.ungroup-toggle {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: rgba(245, 158, 11, 0.9);
  color: #92400e;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 5;
}

.group-toggle:hover,
.ungroup-toggle:hover {
  background: #f59e0b;
  transform: scale(1.1);
}

.group-toggle svg,
.ungroup-toggle svg {
  width: 10px;
  height: 10px;
}
</style>

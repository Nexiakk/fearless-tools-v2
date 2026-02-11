<template>
  <Dialog :open="isOpen" @update:open="handleOpenChange">
    <DialogContent class="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          Tier Manager
        </DialogTitle>
        <DialogDescription>
          Create and manage champion tiers. Drag tiers to reorder them in the hierarchy.
        </DialogDescription>
      </DialogHeader>

      <!-- Error/Success Messages -->
      <div v-if="workspaceTiersStore.error" class="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
        {{ workspaceTiersStore.error }}
      </div>

      <div v-if="successMessage" class="p-3 bg-green-900/50 border border-green-700 rounded text-green-200 text-sm">
        {{ successMessage }}
      </div>

      <!-- Tiers List -->
      <div class="flex-1 overflow-y-auto space-y-3">
        <div
          v-for="tier in workspaceTiersStore.sortedTiers"
          :key="tier.id"
          class="tier-item group relative"
          :class="getTierItemClasses(tier)"
          draggable="true"
          @dragstart="handleDragStart($event, tier)"
          @dragover.prevent
          @drop="handleDrop($event, tier)"
        >
          <!-- Drag Handle -->
          <div class="drag-handle cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
            <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
            </svg>
          </div>

          <!-- Tier Content -->
          <div class="flex-1 flex items-center gap-3">
            <!-- Style Preview -->
            <div class="tier-preview" :style="getTierPreviewStyles(tier)">
              <div class="w-6 h-6 bg-gray-600 rounded"></div>
            </div>

            <!-- Tier Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h4 class="font-medium text-white truncate">{{ tier.name }}</h4>
                <span v-if="tier.isDefault" class="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">Default</span>
                <span class="text-xs text-gray-400">({{ Object.keys(tier.champions || {}).length }} champions)</span>
              </div>
              <p class="text-sm text-gray-400 capitalize">{{ tier.style }} • {{ tier.color }}</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              @click="editTier(tier)"
              class="p-1 text-gray-400 hover:text-white transition-colors"
              title="Edit tier"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              v-if="!tier.isDefault"
              @click="deleteTier(tier.id)"
              class="p-1 text-gray-400 hover:text-red-400 transition-colors"
              title="Delete tier"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Create New Tier Form -->
      <div v-if="showCreateForm" class="border-t border-gray-700 pt-4 space-y-4">
        <h4 class="text-lg font-semibold text-white">Create New Tier</h4>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Tier Name</label>
            <input
              v-model="newTier.name"
              type="text"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
              placeholder="e.g., Meta, Situational"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Style</label>
            <select
              v-model="newTier.style"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
            >
              <option value="border">Border</option>
              <option value="shadow">Shadow</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Color</label>
          <input
            v-model="newTier.color"
            type="color"
            class="color-picker-input"
          />
        </div>

        <div class="flex justify-end gap-2">
          <button
            @click="cancelCreate"
            class="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            @click="createNewTier"
            :disabled="!newTier.name.trim()"
            class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Tier
          </button>
        </div>
      </div>

      <!-- Edit Tier Form -->
      <div v-else-if="editingTier" class="border-t border-gray-700 pt-4 space-y-4">
        <h4 class="text-lg font-semibold text-white">Edit Tier: {{ editingTier.name }}</h4>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Tier Name</label>
            <input
              v-model="editingTier.name"
              type="text"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Style</label>
            <select
              v-model="editingTier.style"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
            >
              <option value="border">Border</option>
              <option value="shadow">Shadow</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Color</label>
          <input
            v-model="editingTier.color"
            type="color"
            class="color-picker-input"
          />
        </div>

        <div class="flex justify-end gap-2">
          <button
            @click="cancelEdit"
            class="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            @click="saveTierEdit"
            class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>

      <!-- Footer Actions -->
      <DialogFooter class="border-t border-gray-700 pt-4">
        <div class="flex gap-2">
          <button
            v-if="!showCreateForm && !editingTier"
            @click="showCreateForm = true"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            <svg class="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Tier
          </button>

          <button
            v-if="workspaceTiersStore.hasWorkspaceTiers && !showCreateForm && !editingTier"
            @click="resetToDefaults"
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Reset to Defaults
          </button>

          <button
            v-if="!showCreateForm && !editingTier"
            @click="fullReset"
            class="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors"
          >
            Full Reset
          </button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useWorkspaceTiersStore } from '@/stores/workspaceTiers'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['close'])

const workspaceTiersStore = useWorkspaceTiersStore()

// Form state
const showCreateForm = ref(false)
const editingTier = ref(null)
const successMessage = ref('')

// New tier form
const newTier = ref({
  name: '',
  style: 'border',
  color: '#6b7280'
})

// Computed
const getTierItemClasses = (tier) => ({
  'bg-gray-800 border border-gray-700 rounded-lg p-3 flex items-center gap-3 hover:bg-gray-750 transition-colors': true,
  'border-amber-500 bg-amber-900/20': workspaceTiersStore.selectedTierId === tier.id,
  'cursor-not-allowed opacity-50': tier.isDefault && workspaceTiersStore.hasWorkspaceTiers
})

const getTierPreviewStyles = (tier) => {
  const baseStyles = {
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }

  if (tier.style === 'border') {
    return {
      ...baseStyles,
      border: `2px solid ${tier.color}`
    }
  } else {
    // Shadow style - same as highlight: border + glow shadow
    return {
      ...baseStyles,
      border: `2px solid ${tier.color}CC`,
      boxShadow: `0 0 4px 1px ${tier.color}99`
    }
  }
}

// Methods
function handleOpenChange(open) {
  if (!open) {
    close()
  }
}

function close() {
  showCreateForm.value = false
  editingTier.value = null
  successMessage.value = ''
  workspaceTiersStore.error = ''
  emit('close')
}



async function createNewTier() {
  if (!newTier.value.name.trim()) return

  const result = await workspaceTiersStore.createTier(newTier.value)
  if (result) {
    successMessage.value = `Tier "${result.name}" created successfully`
    newTier.value = { name: '', style: 'border', color: '#6b7280' }
    showCreateForm.value = false
    setTimeout(() => successMessage.value = '', 3000)
  }
}

function cancelCreate() {
  newTier.value = { name: '', style: 'border', color: '#6b7280' }
  showCreateForm.value = false
}

function editTier(tier) {
  editingTier.value = { ...tier }
  showCreateForm.value = false
}

async function saveTierEdit() {
  const success = await workspaceTiersStore.updateTier(editingTier.value.id, {
    name: editingTier.value.name,
    style: editingTier.value.style,
    color: editingTier.value.color
  })

  if (success) {
    successMessage.value = `Tier "${editingTier.value.name}" updated successfully`
    editingTier.value = null
    setTimeout(() => successMessage.value = '', 3000)
  }
}

function cancelEdit() {
  editingTier.value = null
}

async function deleteTier(tierId) {
  const tier = workspaceTiersStore.sortedTiers.find(t => t.id === tierId)
  if (!tier) return

  if (confirm(`Are you sure you want to delete the "${tier.name}" tier? This will remove all champion assignments from this tier.`)) {
    const success = await workspaceTiersStore.deleteTier(tierId)
    if (success) {
      successMessage.value = `Tier "${tier.name}" deleted successfully`
      setTimeout(() => successMessage.value = '', 3000)
    }
  }
}

async function resetToDefaults() {
  if (confirm('Are you sure you want to reset all tiers to defaults? This will delete all custom tiers and champion assignments.')) {
    const success = await workspaceTiersStore.resetToDefaults()
    if (success) {
      successMessage.value = 'Tiers reset to defaults successfully'
      setTimeout(() => successMessage.value = '', 3000)
    }
  }
}

async function fullReset() {
  if (confirm('Are you sure you want to do a full reset? This will create workspace tiers with default structure but 0 champions.')) {
    const success = await workspaceTiersStore.fullReset()
    if (success) {
      successMessage.value = 'Full reset completed successfully - tiers created with 0 champions'
      setTimeout(() => successMessage.value = '', 3000)
    }
  }
}

// Drag and drop functionality
function handleDragStart(event, tier) {
  event.dataTransfer.setData('text/plain', tier.id)
  event.dataTransfer.effectAllowed = 'move'
}

async function handleDrop(event, targetTier) {
  event.preventDefault()

  const draggedTierId = event.dataTransfer.getData('text/plain')
  if (!draggedTierId || draggedTierId === targetTier.id) return

  // Get current sorted tiers
  const currentTiers = workspaceTiersStore.sortedTiers
  const draggedTier = currentTiers.find(t => t.id === draggedTierId)

  // If dragging a default tier and we don't have workspace tiers yet, copy all tiers to workspace
  if (draggedTier?.isDefault && !workspaceTiersStore.hasWorkspaceTiers) {
    // Copy all current tiers to workspace tiers
    workspaceTiersStore.tiers = [...currentTiers.map(t => ({ ...t, isDefault: false }))]
  }

  const draggedIndex = currentTiers.findIndex(t => t.id === draggedTierId)
  const targetIndex = currentTiers.findIndex(t => t.id === targetTier.id)

  if (draggedIndex === -1 || targetIndex === -1) return

  // Create new order array
  const newOrder = currentTiers.map(tier => tier.id)

  // Remove dragged item and insert at new position
  newOrder.splice(draggedIndex, 1)
  newOrder.splice(targetIndex, 0, draggedTierId)

  // Reorder tiers
  const success = await workspaceTiersStore.reorderTiers(newOrder)
  if (success) {
    successMessage.value = 'Tier order updated successfully'
    setTimeout(() => successMessage.value = '', 2000)
  }
}

// Watch for modal opening
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    showCreateForm.value = false
    editingTier.value = null
    successMessage.value = ''
    workspaceTiersStore.error = ''
  }
})
</script>

<style scoped>
.tier-item {
  transition: all 0.2s ease;
}

.tier-preview {
  flex-shrink: 0;
}



.color-picker-input {
  width: 60px;
  height: 40px;
  border: 1px solid #4b5563;
  border-radius: 6px;
  background-color: #374151;
  cursor: pointer;
  transition: border-color 0.2s;
}

.color-picker-input:hover {
  border-color: #6b7280;
}

.color-picker-input:focus {
  outline: none;
  border-color: #d97706;
  box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.3);
}
</style>

<!-- FINAL - REMOVED SOLID + GRADIENT, ADDED PICKER ICON -->
<template>
  <Dialog :open="isOpen" @update:open="handleOpenChange">
    <DialogContent
      class="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col modal-glass"
    >
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <svg
            class="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-3.138 3.138"
            />
          </svg>
          Tier Manager
        </DialogTitle>
        <DialogDescription>
          Create and manage champion tiers. Drag tiers to reorder them in the
          hierarchy.
        </DialogDescription>
      </DialogHeader>

      <!-- Error/Success Messages -->
      <div
        v-if="workspaceTiersStore.error"
        class="mx-4 p-3 bg-red-900/40 border border-red-700/60 rounded-lg text-red-200 text-sm"
      >
        {{ workspaceTiersStore.error }}
      </div>

      <div
        v-if="successMessage"
        class="mx-4 p-3 bg-green-900/40 border border-green-700/60 rounded-lg text-green-200 text-sm"
      >
        {{ successMessage }}
      </div>

      <!-- Tiers List -->
      <div
        class="flex-1 overflow-y-auto space-y-3 px-4 py-2 tier-list-container"
      >
        <div
          v-for="tier in workspaceTiersStore.sortedTiers"
          :key="tier.id"
          class="tier-item group relative"
          :class="getTierItemClasses(tier)"
          draggable="true"
          @dragstart="handleDragStart($event, tier)"
          @dragover.prevent="handleDragOver($event, tier)"
          @dragleave="handleDragLeave($event, tier)"
          @drop="handleDrop($event, tier)"
        >
          <!-- Drag Handle -->
          <div
            class="drag-handle cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <svg
              class="w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 8h16M4 16h16"
              />
            </svg>
          </div>

          <!-- Tier Content -->
          <div class="flex-1 flex items-center gap-3">
            <!-- Style Preview -->
            <div class="tier-preview-wrapper">
              <div
                class="tier-preview"
                :class="{ 'glow-pulse': tier.style === 'glow-pulse' }"
                :style="getTierPreviewStyles(tier)"
              >
                <div class="w-6 h-6 bg-gray-600 rounded"></div>
              </div>
            </div>

            <!-- Tier Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h4 class="font-medium text-white truncate">{{ tier.name }}</h4>
                <span
                  v-if="tier.isDefault"
                  class="text-xs bg-blue-600/80 text-white px-1.5 py-0.5 rounded"
                  >Default</span
                >
                <span class="text-xs text-gray-400"
                  >({{
                    Object.keys(tier.champions || {}).length
                  }}
                  champions)</span
                >
              </div>
              <p class="text-sm text-gray-400 capitalize">
                {{ tier.style }} • {{ tier.color }}
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div
            class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <button
              @click="editTier(tier)"
              class="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/80 rounded-md transition-all"
              title="Edit tier"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
            <button
              v-if="!tier.isDefault"
              @click="deleteTier(tier.id)"
              class="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded-md transition-all"
              title="Delete tier"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 0 00-1-1h-4a1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>

          <!-- Drag indicator line -->
          <div
            class="drag-indicator absolute left-0 right-0 h-0.5 bg-amber-500 transform scale-x-0 transition-transform duration-150 origin-left"
          ></div>
        </div>
      </div>

      <!-- Create New Tier Form -->
      <div
        v-if="showCreateForm"
        class="border-t border-gray-700/50 pt-4 space-y-4 mx-4 pb-4"
      >
        <h4 class="text-lg font-semibold text-white">Create New Tier</h4>

        <div class="grid grid-cols-12 gap-4">
          <div class="col-span-5">
            <label class="block text-sm font-medium text-gray-300 mb-2"
              >Tier Name</label
            >
            <input
              v-model="newTier.name"
              type="text"
              class="w-full px-3 py-2.5 bg-gray-800/60 border border-gray-600/60 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="e.g., Meta, Situational"
            />
          </div>

          <div class="col-span-7">
            <label class="block text-sm font-medium text-gray-300 mb-2"
              >Style</label
            >
            <div class="style-picker-grid">
              <button
                v-for="style in availableStyles"
                :key="style.value"
                @click="newTier.style = style.value"
                class="style-option-button"
                :class="{
                  active: newTier.style === style.value,
                }"
                :title="style.label"
              >
                <div
                  class="style-preview"
                  :style="getStylePreview(style.value, newTier.color)"
                ></div>
                <span class="style-label">{{ style.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-12 gap-4">
          <div class="col-span-5">
            <label class="block text-sm font-medium text-gray-300 mb-2"
              >Color</label
            >
            <div class="color-picker-row edit-mode">
              <div class="color-picker-wrapper relative">
                <input
                  v-model="newTier.color"
                  type="color"
                  class="color-picker-input"
                />
                <svg
                  class="color-picker-icon absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none w-4 h-4 text-white/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
              </div>
              <div class="color-presets">
                <button
                  v-for="color in suggestedColors"
                  :key="color"
                  @click="newTier.color = color"
                  class="color-preset"
                  :style="{ backgroundColor: color }"
                ></button>
              </div>
            </div>
          </div>

          <div class="col-span-7">
            <label class="block text-sm font-medium text-gray-300 mb-2"
              >Preview</label
            >
            <div class="live-preview-card">
              <div
                class="preview-champion-icon"
                :class="{ 'glow-pulse': newTier.style === 'glow-pulse' }"
                :style="getChampionPreviewStyle(newTier)"
              ></div>
              <span class="preview-champion-name">Champion Example</span>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button
            @click="cancelCreate"
            class="px-4 py-2.5 text-gray-300 hover:text-white bg-gray-700/40 hover:bg-gray-700/60 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            @click="createNewTier"
            :disabled="!newTier.name.trim()"
            class="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Tier
          </button>
        </div>
      </div>

      <!-- Edit Tier Form -->
      <div
        v-else-if="editingTier"
        class="border-t border-gray-700/50 pt-4 space-y-4 mx-4 pb-4"
      >
        <h4 class="text-lg font-semibold text-white">
          Edit Tier: {{ editingTier.name }}
        </h4>

        <div class="grid grid-cols-12 gap-4">
          <div class="col-span-5">
            <label class="block text-sm font-medium text-gray-300 mb-2"
              >Tier Name</label
            >
            <input
              v-model="editingTier.name"
              type="text"
              class="w-full px-3 py-2.5 bg-gray-800/60 border border-gray-600/60 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div class="col-span-7">
            <label class="block text-sm font-medium text-gray-300 mb-2"
              >Style</label
            >
            <div class="style-picker-grid">
              <button
                v-for="style in availableStyles"
                :key="style.value"
                @click="editingTier.style = style.value"
                class="style-option-button"
                :class="{
                  active: editingTier.style === style.value,
                }"
                :title="style.label"
              >
                <div
                  class="style-preview"
                  :style="getStylePreview(style.value, editingTier.color)"
                ></div>
                <span class="style-label">{{ style.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-12 gap-4">
          <div class="col-span-5">
            <label class="block text-sm font-medium text-gray-300 mb-2"
              >Color</label
            >
            <div class="color-picker-row">
              <div class="color-picker-wrapper relative">
                <input
                  v-model="editingTier.color"
                  type="color"
                  class="color-picker-input"
                />
                <svg
                  class="color-picker-icon absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none w-4 h-4 text-white/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
              </div>
              <div class="color-presets">
                <button
                  v-for="color in suggestedColors"
                  :key="color"
                  @click="editingTier.color = color"
                  class="color-preset"
                  :style="{ backgroundColor: color }"
                ></button>
              </div>
            </div>
          </div>

          <div class="col-span-7">
            <label class="block text-sm font-medium text-gray-300 mb-2"
              >Preview</label
            >
            <div class="live-preview-card">
              <div
                class="preview-champion-icon"
                :class="{ 'glow-pulse': editingTier.style === 'glow-pulse' }"
                :style="getChampionPreviewStyle(editingTier)"
              ></div>
              <span class="preview-champion-name">Champion Example</span>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button
            @click="cancelEdit"
            class="px-4 py-2.5 text-gray-300 hover:text-white bg-gray-700/40 hover:bg-gray-700/60 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            @click="saveTierEdit"
            class="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>

      <!-- Footer Actions -->
      <DialogFooter class="border-t border-gray-700/50 pt-4 mx-4 pb-4">
        <div class="flex gap-2">
          <button
            v-if="!showCreateForm && !editingTier"
            @click="showCreateForm = true"
            class="px-4 py-2.5 bg-gray-700/60 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            <svg
              class="w-4 h-4 inline mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            New Tier
          </button>

          <button
            v-if="
              workspaceTiersStore.hasWorkspaceTiers &&
              !showCreateForm &&
              !editingTier
            "
            @click="resetToDefaults"
            class="px-4 py-2.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            Reset to Defaults
          </button>

          <button
            v-if="!showCreateForm && !editingTier"
            @click="fullReset"
            class="px-4 py-2.5 bg-orange-600/80 hover:bg-orange-600 text-white rounded-lg transition-colors"
          >
            Full Reset
          </button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useWorkspaceTiersStore } from "@/stores/workspaceTiers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(["close"]);

const workspaceTiersStore = useWorkspaceTiersStore();

// Form state
const showCreateForm = ref(false);
const editingTier = ref(null);
const successMessage = ref("");
const dragOverTierId = ref(null);

// New tier form
const newTier = ref({
  name: "",
  style: "border",
  color: "#6b7280",
});

const availableStyles = [
  { value: 'border', label: 'Border' },
  { value: 'shadow', label: 'Glow' },
  { value: 'underlined', label: 'Underline' },
  { value: 'left-bar', label: 'Left Bar' },
  { value: 'corner-ribbon', label: 'Corner' },
  { value: 'glow-pulse', label: 'Pulse' }
];

const activeColorValue = computed(() => {
  return editingTier.value?.color ?? newTier.value.color;
});

const suggestedColors = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#6b7280",
];

// Computed
const getTierItemClasses = (tier) => ({
  "bg-gray-800/60 border border-gray-700/50 rounded-xl p-3.5 flex items-center gap-3 hover:bg-gray-750/60 transition-all duration-200": true,
  "border-amber-500/60 bg-amber-900/20":
    workspaceTiersStore.selectedTierId === tier.id,
  "cursor-not-allowed opacity-50":
    tier.isDefault && workspaceTiersStore.hasWorkspaceTiers,
  "dragover-top": dragOverTierId.value === tier.id,
});

const getTierPreviewStyles = (tier) => {
  const baseStyles = {
    width: "32px",
    height: "32px",
    borderRadius: "5px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  switch (tier.style) {
    case "border":
      return {
        ...baseStyles,
        border: `2px solid ${tier.color}`,
        backgroundColor: "transparent",
      };

    case "shadow":
    case "highlight":
      return {
        ...baseStyles,
        border: `1px solid ${tier.color}CC`,
        boxShadow: `0 0 6px 2px ${tier.color}99, inset 0 0 4px ${tier.color}40`,
      };

    case "underlined":
      return {
        ...baseStyles,
        borderBottom: `3px solid ${tier.color}`,
        boxShadow: `0 3px 6px -3px ${tier.color}40`,
      };

    case "left-bar":
      return {
        ...baseStyles,
        borderLeft: `4px solid ${tier.color}`,
        backgroundColor: `${tier.color}15`,
      };

    case "corner-ribbon":
      return {
        ...baseStyles,
        borderTop: `2px solid ${tier.color}`,
        borderRight: `2px solid ${tier.color}`,
        borderTopRightRadius: "6px",
        background: `linear-gradient(135deg, ${tier.color}25 0%, transparent 50%)`,
      };

    case "glow-pulse":
      return {
        ...baseStyles,
        border: `2px solid ${tier.color}`,
        boxShadow: `0 0 8px ${tier.color}80, 0 0 16px ${tier.color}40`,
        backgroundColor: `${tier.color}20`,
        "--pulse-color": tier.color,
      };

    default:
      return {
        ...baseStyles,
        border: `2px solid ${tier.color}`,
      };
  }
};

function getStylePreview(style, color) {
  const base = {
    width: "100%",
    height: "24px",
    borderRadius: "4px",
  };

  switch (style) {
    case "border":
      return {
        ...base,
        border: `2px solid ${color}`,
        backgroundColor: "transparent",
      };
    case "shadow":
      return {
        ...base,
        border: `1px solid ${color}CC`,
        boxShadow: `0 0 6px ${color}80`,
      };
    case "underlined":
      return { ...base, borderBottom: `3px solid ${color}` };
    case "left-bar":
      return {
        ...base,
        borderLeft: `4px solid ${color}`,
        backgroundColor: `${color}15`,
      };
    case "corner-ribbon":
      return {
        ...base,
        borderTop: `2px solid ${color}`,
        borderRight: `2px solid ${color}`,
        background: `linear-gradient(135deg, ${color}20 0%, transparent 50%)`,
      };
    case "glow-pulse":
      return {
        ...base,
        border: `2px solid ${color}`,
        boxShadow: `0 0 8px ${color}70`,
        backgroundColor: `${color}20`,
      };
    default:
      return { ...base, border: `2px solid ${color}` };
  }
}

function getChampionPreviewStyle(tier) {
  const base = {
    width: '36px',
    height: '36px',
    borderRadius: '6px',
    backgroundImage: 'url("https://ddragon.leagueoflegends.com/cdn/15.7.1/img/champion/Ambessa.png")',
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  };

  switch (tier.style) {
    case "border":
      return { ...base, border: `2px solid ${tier.color}` };
    case "shadow":
    case "highlight":
      return {
        ...base,
        border: `1px solid ${tier.color}CC`,
        boxShadow: `0 0 6px 2px ${tier.color}99`,
      };
    case "underlined":
      return { ...base, borderBottom: `3px solid ${tier.color}` };
    case "left-bar":
      return {
        ...base,
        borderLeft: `4px solid ${tier.color}`,
        backgroundColor: `${tier.color}15`,
      };
    case "corner-ribbon":
      return {
        ...base,
        borderTop: `2px solid ${tier.color}`,
        borderRight: `2px solid ${tier.color}`,
        borderTopRightRadius: "8px",
        background: `linear-gradient(135deg, ${tier.color}25 0%, transparent 50%), url("https://ddragon.leagueoflegends.com/cdn/15.7.1/img/champion/Ambessa.png") center/cover`,
        backgroundBlendMode: 'overlay',
      };
    case "glow-pulse":
      return {
        ...base,
        border: `2px solid ${tier.color}`,
        boxShadow: `0 0 8px ${tier.color}80, 0 0 16px ${tier.color}40`,
        "--pulse-color": tier.color,
      };
    default:
      return { ...base, border: `2px solid ${tier.color}` };
  }
}

// Methods
function handleOpenChange(open) {
  if (!open) {
    close();
  }
}

function close() {
  showCreateForm.value = false;
  editingTier.value = null;
  successMessage.value = "";
  workspaceTiersStore.error = "";
  dragOverTierId.value = null;
  emit("close");
}

async function createNewTier() {
  if (!newTier.value.name.trim()) return;

  const result = await workspaceTiersStore.createTier(newTier.value);
  if (result) {
    successMessage.value = `Tier "${result.name}" created successfully`;
    newTier.value = { name: "", style: "border", color: "#6b7280" };
    showCreateForm.value = false;
    setTimeout(() => (successMessage.value = ""), 3000);
  }
}

function cancelCreate() {
  newTier.value = { name: "", style: "border", color: "#6b7280" };
  showCreateForm.value = false;
}

function editTier(tier) {
  editingTier.value = { ...tier };
  showCreateForm.value = false;
}

async function saveTierEdit() {
  const success = await workspaceTiersStore.updateTier(editingTier.value.id, {
    name: editingTier.value.name,
    style: editingTier.value.style,
    color: editingTier.value.color,
  });

  if (success) {
    successMessage.value = `Tier "${editingTier.value.name}" updated successfully`;
    editingTier.value = null;
    setTimeout(() => (successMessage.value = ""), 3000);
  }
}

function cancelEdit() {
  editingTier.value = null;
}

async function deleteTier(tierId) {
  const tier = workspaceTiersStore.sortedTiers.find((t) => t.id === tierId);
  if (!tier) return;

  if (
    confirm(
      `Are you sure you want to delete the "${tier.name}" tier? This will remove all champion assignments from this tier.`,
    )
  ) {
    const success = await workspaceTiersStore.deleteTier(tierId);
    if (success) {
      successMessage.value = `Tier "${tier.name}" deleted successfully`;
      setTimeout(() => (successMessage.value = ""), 3000);
    }
  }
}

async function resetToDefaults() {
  if (
    confirm(
      "Are you sure you want to reset all tiers to defaults? This will delete all custom tiers and champion assignments.",
    )
  ) {
    const success = await workspaceTiersStore.resetToDefaults();
    if (success) {
      successMessage.value = "Tiers reset to defaults successfully";
      setTimeout(() => (successMessage.value = ""), 3000);
    }
  }
}

async function fullReset() {
  if (
    confirm(
      "Are you sure you want to do a full reset? This will create workspace tiers with default structure but 0 champions.",
    )
  ) {
    const success = await workspaceTiersStore.fullReset();
    if (success) {
      successMessage.value =
        "Full reset completed successfully - tiers created with 0 champions";
      setTimeout(() => (successMessage.value = ""), 3000);
    }
  }
}

// Drag and drop functionality
function handleDragStart(event, tier) {
  event.dataTransfer.setData("text/plain", tier.id);
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.dropEffect = "move";

  // Set custom drag image
  const target = event.target.closest(".tier-item");
  if (target) {
    event.dataTransfer.setDragImage(target, 20, 20);
  }
}

function handleDragOver(event, tier) {
  event.preventDefault();
  dragOverTierId.value = tier.id;
  event.dataTransfer.dropEffect = "move";
}

function handleDragLeave(event, tier) {
  if (dragOverTierId.value === tier.id) {
    dragOverTierId.value = null;
  }
}

async function handleDrop(event, targetTier) {
  event.preventDefault();
  dragOverTierId.value = null;

  const draggedTierId = event.dataTransfer.getData("text/plain");
  if (!draggedTierId || draggedTierId === targetTier.id) return;

  // Get current sorted tiers
  const currentTiers = workspaceTiersStore.sortedTiers;
  const draggedTier = currentTiers.find((t) => t.id === draggedTierId);

  // If dragging a default tier and we don't have workspace tiers yet, copy all tiers to workspace
  if (draggedTier?.isDefault && !workspaceTiersStore.hasWorkspaceTiers) {
    // Copy all current tiers to workspace tiers
    workspaceTiersStore.tiers = [
      ...currentTiers.map((t) => ({ ...t, isDefault: false })),
    ];
  }

  const draggedIndex = currentTiers.findIndex((t) => t.id === draggedTierId);
  const targetIndex = currentTiers.findIndex((t) => t.id === targetTier.id);

  if (draggedIndex === -1 || targetIndex === -1) return;

  // Create new order array
  const newOrder = currentTiers.map((tier) => tier.id);

  // Remove dragged item and insert at new position
  newOrder.splice(draggedIndex, 1);
  newOrder.splice(targetIndex, 0, draggedTierId);

  // Reorder tiers
  const success = await workspaceTiersStore.reorderTiers(newOrder);
  if (success) {
    successMessage.value = "Tier order updated successfully";
    setTimeout(() => (successMessage.value = ""), 2000);
  }
}

// Watch for modal opening
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      showCreateForm.value = false;
      editingTier.value = null;
      successMessage.value = "";
      workspaceTiersStore.error = "";
      dragOverTierId.value = null;
    }
  },
);
</script>

<style scoped>
.modal-glass {
  background: linear-gradient(
    135deg,
    rgba(22, 22, 22, 0.98) 0%,
    rgba(18, 18, 18, 0.99) 100%
  ) !important;
  backdrop-filter: blur(20px) !important;
  border: 1px solid rgba(65, 65, 65, 0.5) !important;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
}

.title-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  box-shadow: 0 0 10px #f59e0b70;
}

.tier-list-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(85, 85, 85, 0.6) transparent;
}

.tier-list-container::-webkit-scrollbar {
  width: 5px;
}

.tier-list-container::-webkit-scrollbar-track {
  background: transparent;
}

.tier-list-container::-webkit-scrollbar-thumb {
  background: rgba(85, 85, 85, 0.6);
  border-radius: 3px;
}

.tier-item {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: visible;
}

.tier-item::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.02) 0%,
    transparent 50%
  );
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  border-radius: 12px;
}

.tier-item:hover::before {
  opacity: 1;
}

.tier-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  border-color: rgba(107, 114, 128, 0.5);
}

.tier-preview-wrapper {
  position: relative;
}

.style-picker-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}

.style-option-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 4px;
  background: rgba(55, 55, 55, 0.5);
  border: 1px solid rgba(75, 75, 75, 0.4);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.style-option-button:hover {
  background: rgba(75, 75, 75, 0.7);
  border-color: rgba(107, 114, 128, 0.6);
  transform: translateY(-1px);
}

.style-option-button.active {
  background: rgba(245, 158, 11, 0.15);
  border-color: #f59e0b80;
  box-shadow: 0 0 0 1px #f59e0b40;
}

.style-label {
  font-size: 9px;
  color: rgba(209, 213, 219, 0.8);
  text-align: center;
}

.color-picker-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-presets {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.color-preset {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid rgba(75, 75, 75, 0.4);
  cursor: pointer;
  transition: all 0.15s ease;
}

.color-preset:hover {
  transform: scale(1.15);
  border-color: rgba(156, 163, 175, 0.5);
}

.live-preview-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(45, 45, 45, 0.6);
  border-radius: 8px;
  border: 1px solid rgba(75, 75, 75, 0.4);
}

.preview-champion-name {
  font-size: 12px;
  color: rgba(229, 231, 235, 0.9);
  font-weight: 500;
}

.tier-preview {
  position: relative;
}

/* Pulse animation */
@keyframes tierPulse {
  0%,
  100% {
    filter: brightness(1);
    box-shadow: 0 0 8px var(--pulse-color, currentColor);
  }
  50% {
    filter: brightness(1.15);
    box-shadow:
      0 0 14px var(--pulse-color, currentColor),
      0 0 22px var(--pulse-color, currentColor) 50%;
  }
}

.glow-pulse {
  animation: tierPulse 2s infinite ease-in-out;
}

.color-picker-input {
  width: 60px;
  height: 40px;
  cursor: pointer;
  position: relative;
  z-index: 3;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  border: none;
}

.color-picker-input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker-input::-webkit-color-swatch {
  border: none;
  border-radius: 7px;
}

.color-picker-input::-moz-color-swatch {
  border: none;
  border-radius: 7px;
}

.color-picker-wrapper {
  position: relative;
  width: 60px;
  height: 40px;
  border: 1px solid rgba(75, 85, 99, 0.6);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.color-picker-wrapper::before {
  content: '';
  position: absolute;
  inset: 0;
  background-color: v-bind('activeColorValue');
  border-radius: 7px;
  z-index: 1;
}

.color-picker-wrapper:hover {
  border-color: rgba(107, 114, 128, 0.8);
}

.color-picker-wrapper:focus-within {
  outline: none;
  border-color: #d97706;
  box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.3);
}

.drag-handle {
  padding: 4px;
  border-radius: 4px;
}

.drag-handle:hover {
  background: rgba(75, 85, 99, 0.5);
}

/* Drag indicators */
.drag-indicator {
  bottom: -4px;
}

.tier-item.dragover-top .drag-indicator {
  transform: scaleX(1);
}
</style>

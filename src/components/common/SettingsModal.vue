<template>
  <Dialog :open="settingsStore.isSettingsOpen" @update:open="handleOpenChange">
    <DialogContent class="w-[28rem] h-[800px] flex flex-col p-0">
      <DialogHeader class="px-6 pt-6 pb-2 shrink-0">
        <DialogTitle>Settings</DialogTitle>
      </DialogHeader>

      <Tabs :model-value="settingsStore.settingsTab" @update:model-value="settingsStore.settingsTab = $event" class="w-full flex-1 flex flex-col min-h-0 px-6">
        <TabsList class="grid w-full grid-cols-3">
          <TabsTrigger value="pool">Fearless Pool</TabsTrigger>
          <TabsTrigger value="drafting">Drafting</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="pool" class="space-y-4 mt-4 overflow-y-auto pr-2">
          <!-- NEW: Page Content Scale -->
          <div class="page-content-scale-section">
            <div class="flex items-center justify-between mb-2">
              <label class="font-medium flex items-center gap-2">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 3H3v18h18V3zM9 9h6v6H9V9z"/>
                </svg>
                Page Content Scale
              </label>
              <span class="text-sm text-muted-foreground">{{ pageContentScale[0] }}%</span>
            </div>
            <Slider
              v-model="pageContentScale"
              :min="50"
              :max="150"
              :step="1"
              class="w-full"
            />
            <p class="text-xs text-muted-foreground mt-1">
              Adjust the overall size of all page content
            </p>
          </div>

          <!-- NEW: Card Size Presets -->
          <div class="space-y-3">
            <label class="font-medium block">Champions Size Presets</label>
            <div class="preset-previews-row">
              <CardSizePresetPreview
                preset="standard"
                :is-active="currentPreset === 'standard'"
                @select="handlePresetSelect"
              />
              <CardSizePresetPreview
                preset="compact"
                :is-active="currentPreset === 'compact'"
                @select="handlePresetSelect"
              />
              <CardSizePresetPreview
                preset="custom"
                :is-active="currentPreset === 'custom'"
                :is-expanded="isCustomExpanded"
                @select="handlePresetSelect"
              />
            </div>

            <!-- Custom Settings Panel (Expandable) -->
            <div v-if="isCustomExpanded" class="custom-settings-panel">
              <div class="space-y-4">
                <!-- Normal Cards -->
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <label class="text-sm">Normal Cards</label>
                    <span class="text-sm text-muted-foreground">{{ settingsStore.settings.pool.normalCardSize }}%</span>
                  </div>
                  <Slider
                    v-model="normalCardSize"
                    :min="50"
                    :max="200"
                    :step="1"
                    class="w-full"
                  />
                </div>

                <!-- Unavailable Cards -->
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <label class="text-sm">Unavailable Cards</label>
                    <span class="text-sm text-muted-foreground">{{ settingsStore.settings.pool.unavailableCardSize }}%</span>
                  </div>
                  <Slider
                    v-model="unavailableCardSize"
                    :min="50"
                    :max="200"
                    :step="1"
                    class="w-full"
                  />
                </div>

                <!-- Tier Cards Section (PUBG-like) -->
                <TierCardSizeSettings />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between">

            <label class="font-medium">Disable UI Animations</label>
            <Switch
              :model-value="settingsStore.settings.pool.disableAnimations"
              @update:model-value="settingsStore.updatePoolSetting('disableAnimations', $event)"
            />
          </div>

          <div class="flex items-center justify-between">
            <label class="font-medium">Center Cards in Rows</label>
            <Switch
              :model-value="settingsStore.settings.pool.centerCards"
              @update:model-value="settingsStore.updatePoolSetting('centerCards', $event)"
            />
          </div>

          <div class="flex items-center justify-between">
            <label class="font-medium">Enable Champion Search</label>
            <Switch
              :model-value="settingsStore.settings.pool.enableSearch"
              @update:model-value="settingsStore.updatePoolSetting('enableSearch', $event)"
            />
          </div>

          <div class="flex items-center justify-between">
            <label class="font-medium">Show Event History</label>
            <Switch
              :model-value="settingsStore.settings.pool.showEventHistory"
              @update:model-value="settingsStore.updatePoolSetting('showEventHistory', $event)"
            />
          </div>

          <!-- Picked Champions Grouping -->
          <div class="flex items-center justify-between">
            <label class="font-medium">Picked Champions Display</label>
            <select
              :value="settingsStore.settings.pool.unavailableChampionsGrouping"
              @change="handleUnavailableGroupingChange"
              class="unavailable-grouping-select"
            >
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
        </TabsContent>

        <TabsContent value="drafting" class="space-y-4 mt-4 overflow-y-auto pr-2">
          <!-- Grid Size Setting -->
          <div class="flex items-center justify-between mt-2">
            <label class="font-medium whitespace-nowrap">Grid Size</label>
            <div class="flex flex-col items-end gap-1 flex-1 ml-4" style="max-width: 140px;">
              <Slider
                v-model="gridSizeIndex"
                :min="0"
                :max="7"
                :step="1"
                class="w-full mt-1"
              />
              <span class="text-xs text-muted-foreground">{{ GRID_SIZE_LABELS[settingsStore.settings.drafting.championGridZoomIndex] }}</span>
            </div>
          </div>

          <!-- Tier Highlighting Setting -->
          <div class="flex items-center justify-between">
            <label class="font-medium">Tier Highlighting</label>
            <select
              :value="settingsStore.settings.drafting.tierHighlightMode"
              @change="handleDraftingSettingChange('tierHighlightMode', $event)"
              class="unavailable-grouping-select"
            >
              <option value="none">None</option>
              <option value="sort">Only when Tier sorting</option>
              <option value="always">Always</option>
            </select>
          </div>

          <!-- Picked Champions Display Setting -->
          <div class="flex items-center justify-between">
            <label class="font-medium">Picked Champions Display</label>
            <select
              :value="settingsStore.settings.drafting.pickedMode"
              @change="handleDraftingSettingChange('pickedMode', $event)"
              class="unavailable-grouping-select"
            >
              <option value="default">Default</option>
              <option value="bottom">Bottom</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
        </TabsContent>

        <TabsContent value="admin" class="space-y-4 mt-4 overflow-y-auto pr-2">
          <div v-if="authStore.isAuthenticated && !authStore.isAnonymous">
            <h4 class="font-semibold mb-2">Authentication</h4>
            <p class="text-sm text-muted-foreground mb-3">
              Signed in as: <span>{{ authStore.userEmail || "Unknown" }}</span>
            </p>
            <Button @click="handleSignOut" variant="outline">
              Sign Out
            </Button>
          </div>

          <div v-else>
            <h4 class="font-semibold mb-2">Admin Access</h4>
            <p class="text-sm text-muted-foreground mb-4">
              Sign in with an admin account to access admin features.
            </p>

            <div class="space-y-4">
              <div class="space-y-2">
                <label class="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  v-model="adminEmail"
                  @keyup.enter="handleAdminSignIn"
                  placeholder="admin@example.com"
                />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  v-model="adminPassword"
                  @keyup.enter="handleAdminSignIn"
                  placeholder="Enter password"
                />
              </div>
              <p v-if="adminError" class="text-sm text-destructive">{{ adminError }}</p>
              <Button @click="handleAdminSignIn" :disabled="adminLoading" class="w-full">
                <span v-if="!adminLoading">Sign In</span>
                <span v-else>Signing in...</span>
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter class="px-6 py-4 shrink-0 border-t border-border">
        <Button @click="handleReset" variant="outline">
          Reset
        </Button>
        <Button @click="settingsStore.closeSettings()">
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useSettingsStore } from "@/stores/settings";
import { useAuthStore } from "@/stores/auth";
import { useConfirmationStore } from "@/stores/confirmation";
import { useAuth } from "@/composables/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CardSizePresetPreview from "@/components/settings/CardSizePresetPreview.vue";
import TierCardSizeSettings from "@/components/settings/TierCardSizeSettings.vue";

const settingsStore = useSettingsStore();
const authStore = useAuthStore();
const confirmationStore = useConfirmationStore();
const { signOut } = useAuth();

// Admin login form state
const adminEmail = ref('');
const adminPassword = ref('');
const adminError = ref('');
const adminLoading = ref(false);

// Custom preset expansion state
const isCustomExpanded = ref(false);

// Current preset tracking
const currentPreset = computed({
  get: () => settingsStore.settings.pool.cardSizePreset,
  set: (value) => { settingsStore.applyCardSizePreset(value); }
});

// Watch for preset changes to auto-expand custom
watch(() => settingsStore.settings.pool.cardSizePreset, (newPreset) => {
  if (newPreset === 'custom') {
    isCustomExpanded.value = true;
  }
});

// Handle preset selection
function handlePresetSelect(preset) {
  if (preset === 'custom') {
    // Toggle expansion when clicking custom
    if (currentPreset.value === 'custom') {
      isCustomExpanded.value = !isCustomExpanded.value;
    } else {
      currentPreset.value = 'custom';
      isCustomExpanded.value = true;
    }
  } else {
    currentPreset.value = preset;
    isCustomExpanded.value = false;
  }
}

// Computed properties for sliders (Slider component expects arrays)
const normalCardSize = computed({
  get: () => [settingsStore.settings.pool.normalCardSize],
  set: (value) => {
    settingsStore.updatePoolSetting('normalCardSize', value[0]);
    // If manually adjusting, switch to custom preset
    if (currentPreset.value !== 'custom') {
      settingsStore.applyCardSizePreset('custom');
    }
  }
});

const unavailableCardSize = computed({
  get: () => [settingsStore.settings.pool.unavailableCardSize],
  set: (value) => {
    settingsStore.updatePoolSetting('unavailableCardSize', value[0]);
    // If manually adjusting, switch to custom preset
    if (currentPreset.value !== 'custom') {
      settingsStore.applyCardSizePreset('custom');
    }
  }
});

// Page Content Scale slider
// Grid Size setup
const GRID_SIZE_LABELS = [
  'Extremely Small (57%)',
  'Tiny (62%)',
  'Very Small (67%)',
  'Small (73%)',
  'Normal (81%)',
  'Large (90%)',
  'Very Large (100%)',
  'Huge (114%)'
];

const gridSizeIndex = computed({
  get: () => [settingsStore.settings.drafting.championGridZoomIndex],
  set: (value) => {
    settingsStore.updateDraftingSetting('championGridZoomIndex', value[0]);
  }
});

const pageContentScale = computed({
  get: () => [settingsStore.settings.pool.pageContentScale],
  set: (value) => {
    settingsStore.updatePoolSetting('pageContentScale', value[0]);
  }
});

const handleOpenChange = (open) => {
  if (!open) {
    settingsStore.closeSettings();
  }
};

const handleSignOut = async () => {
  await signOut();
  settingsStore.closeSettings();
};

const handleReset = () => {
  confirmationStore.open({
    message:
      "Are you sure you want to reset all settings to their default values?",
    confirmAction: () => {
      settingsStore.resetSettings();
    },
  });
};

const handleAdminSignIn = async () => {
  if (!adminEmail.value || !adminPassword.value) {
    adminError.value = 'Please enter email and password';
    return;
  }

  adminLoading.value = true;
  adminError.value = '';

  const result = await authStore.signIn(adminEmail.value, adminPassword.value);

  if (result.success) {
    // Successfully signed in, form will automatically hide due to v-if condition
    adminEmail.value = '';
    adminPassword.value = '';
  } else {
    adminError.value = result.error || 'Sign in failed';
  }

  adminLoading.value = false;
};

// Handle unavailable champions grouping change
function handleUnavailableGroupingChange(event) {
  settingsStore.updatePoolSetting('unavailableChampionsGrouping', event.target.value);
}

// Handle drafting settings changes
function handleDraftingSettingChange(settingKey, event) {
  settingsStore.updateDraftingSetting(settingKey, event.target.value);
}
</script>

<style scoped>
/* Preset Previews Row */
.preset-previews-row {
  display: flex;
  gap: 8px;
}

/* Custom Settings Panel */
.custom-settings-panel {
  background: #1a1a1a;
  border: 1px solid #374151;
  border-radius: 8px;
  padding: 16px;
  margin-top: 8px;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Page Content Scale Section */
.page-content-scale-section {
  background: #1a1a1a;
  border: 1px solid #374151;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
}

.unavailable-grouping-select {
  width: auto;
  min-width: 140px;
  padding: 6px 28px 6px 12px;
  background: #1a1a1a;
  border: 1px solid #374151;
  border-radius: 6px;
  color: #e5e7eb;
  font-size: 14px;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}

.unavailable-grouping-select:hover {
  border-color: #4b5563;
}

.unavailable-grouping-select:focus {
  outline: none;
  border-color: #f59e0b;
}

.unavailable-grouping-select option {
  background: #1a1a1a;
  color: #e5e7eb;
}

/* Custom Scrollbar Styles */
:deep([data-state="active"]) {
  scrollbar-width: thin;
  scrollbar-color: #3a3a3a #1a1a1a;
}

:deep([data-state="active"])::-webkit-scrollbar {
  width: 8px;
}

:deep([data-state="active"])::-webkit-scrollbar-track {
  background: #1a1a1a;
  border-radius: 4px;
}

:deep([data-state="active"])::-webkit-scrollbar-thumb {
  background: #3a3a3a;
  border-radius: 4px;
}

:deep([data-state="active"])::-webkit-scrollbar-thumb:hover {
  background: #4a4a4a;
}
</style>

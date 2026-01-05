<template>
  <Dialog :open="settingsStore.isSettingsOpen" @update:open="handleOpenChange">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Settings</DialogTitle>
      </DialogHeader>

      <Tabs :model-value="settingsStore.settingsTab" @update:model-value="settingsStore.settingsTab = $event" class="w-full">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="pool">Fearless Pool</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="pool" class="space-y-4 mt-4">
          <div class="flex items-center justify-between">
            <label class="font-medium">Frozen OP/Highlighted Cards</label>
            <Switch
              :model-value="settingsStore.settings.pool.frozenChampions"
              @update:model-value="settingsStore.updatePoolSetting('frozenChampions', $event)"
            />
          </div>

          <div class="space-y-4">
            <label class="font-medium block">Card Size Adjustments</label>

            <div class="space-y-4">
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

              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="text-sm">OP/Highlight Cards</label>
                  <span class="text-sm text-muted-foreground">{{ settingsStore.settings.pool.highlightCardSize }}%</span>
                </div>
                <Slider
                  v-model="highlightCardSize"
                  :min="50"
                  :max="200"
                  :step="1"
                  class="w-full"
                />
              </div>

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
            <label class="font-medium">Show Banned Champions</label>
            <Switch
              :model-value="settingsStore.settings.pool.showBannedChampions"
              @update:model-value="settingsStore.updatePoolSetting('showBannedChampions', $event)"
            />
          </div>
        </TabsContent>

        <TabsContent value="admin" class="space-y-4 mt-4">
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
            <p class="text-sm text-muted-foreground mb-3">
              Sign in with an admin account to access admin features.
            </p>
            <Button @click="openAuthModal">
              Sign In
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button @click="handleReset" variant="outline">
          Reset
        </Button>
        <Button @click="settingsStore.closeSettings()">
          Close
        </Button>
      </DialogFooter>

      <!-- Auth Modal -->
      <AuthModal v-model="isAuthModalOpen" />
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed } from "vue";
import { useSettingsStore } from "@/stores/settings";
import { useAuthStore } from "@/stores/auth";
import { useConfirmationStore } from "@/stores/confirmation";
import { useAuth } from "@/composables/useAuth";
import AuthModal from "./AuthModal.vue";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

const settingsStore = useSettingsStore();
const authStore = useAuthStore();
const confirmationStore = useConfirmationStore();
const { signOut } = useAuth();

// Computed properties for sliders (Slider component expects arrays)
const normalCardSize = computed({
  get: () => [settingsStore.settings.pool.normalCardSize],
  set: (value) => { settingsStore.updatePoolSetting('normalCardSize', value[0]) }
});

const highlightCardSize = computed({
  get: () => [settingsStore.settings.pool.highlightCardSize],
  set: (value) => { settingsStore.updatePoolSetting('highlightCardSize', value[0]) }
});

const unavailableCardSize = computed({
  get: () => [settingsStore.settings.pool.unavailableCardSize],
  set: (value) => { settingsStore.updatePoolSetting('unavailableCardSize', value[0]) }
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

const isAuthModalOpen = ref(false);

const openAuthModal = () => {
  settingsStore.closeSettings();
  isAuthModalOpen.value = true;
};
</script>

<style scoped>
/* No custom styles needed - using shadcn components */
</style>

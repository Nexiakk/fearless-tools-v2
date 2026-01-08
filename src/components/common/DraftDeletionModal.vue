<template>
  <Dialog :open="isOpen" @update:open="handleOpenChange">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Remove Draft Iteration</DialogTitle>
        <DialogDescription>
          Are you sure you want to remove this draft iteration? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>

      <div class="flex items-center space-x-2">
        <input
          type="checkbox"
          id="disable-warning"
          v-model="disableWarning"
          class="rounded"
        />
        <label for="disable-warning" class="text-sm text-muted-foreground">
          Don't show this warning again
        </label>
      </div>

      <DialogFooter>
        <Button @click="cancel" variant="outline">
          Cancel
        </Button>
        <Button @click="confirm" variant="destructive">
          Remove
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref } from "vue";
import { useSettingsStore } from "@/stores/settings";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const settingsStore = useSettingsStore();

const isOpen = ref(false);
const draftIndex = ref(null);
const disableWarning = ref(false);
let resolvePromise = null;

function open(index) {
  if (settingsStore.settings.drafting?.disableDraftDeletionWarning) {
    // If warning is disabled, resolve immediately
    return Promise.resolve({ confirmed: true, draftIndex: index });
  }

  draftIndex.value = index;
  disableWarning.value = false;
  isOpen.value = true;

  return new Promise((resolve) => {
    resolvePromise = resolve;
  });
}

function confirm() {
  if (disableWarning.value) {
    settingsStore.updateDraftingSetting('disableDraftDeletionWarning', true);
  }

  isOpen.value = false;
  if (resolvePromise) {
    resolvePromise({ confirmed: true, draftIndex: draftIndex.value });
    resolvePromise = null;
  }
}

function cancel() {
  isOpen.value = false;
  if (resolvePromise) {
    resolvePromise({ confirmed: false, draftIndex: draftIndex.value });
    resolvePromise = null;
  }
}

function handleOpenChange(open) {
  if (!open) {
    cancel();
  }
}

// Expose the open function
defineExpose({ open });
</script>

<style scoped>
/* No custom styles needed - using shadcn components */
</style>
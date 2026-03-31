<template>
  <Dialog :open="isOpen" @update:open="handleOpenChange">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Reset Draft</DialogTitle>
        <DialogDescription>
          Choose how you want to reset your drafts.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-2">
        <!-- Reset Mode Selection -->
        <div class="space-y-3">
          <label class="flex items-start space-x-3 cursor-pointer">
            <input
              type="radio"
              v-model="resetMode"
              value="current"
              class="mt-1"
            />
            <div>
              <div class="font-medium">Reset current iteration only</div>
              <div class="text-sm text-muted-foreground">
                Clears picks, bans, and notes from the currently selected draft. Other iterations remain unchanged.
              </div>
            </div>
          </label>

          <label class="flex items-start space-x-3 cursor-pointer">
            <div class="flex-1 border border-border rounded-lg p-3 bg-destructive/5">
              <div class="flex items-start space-x-3">
                <input
                  type="radio"
                  v-model="resetMode"
                  value="all"
                  class="mt-1"
                />
                <div>
                  <div class="font-medium text-destructive">Reset all games</div>
                  <div class="text-sm text-muted-foreground">
                    Resets all iterations in all games. Only user-created drafts are affected - LCU and Fearless Pool data remain unchanged.
                  </div>
                </div>
              </div>
            </div>
          </label>
        </div>
      </div>

      <DialogFooter>
        <Button @click="cancel" variant="outline">
          Cancel
        </Button>
        <Button @click="confirm" :variant="resetMode === 'all' ? 'destructive' : 'default'">
          {{ resetMode === 'all' ? 'Reset All Games' : 'Reset' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref } from "vue";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const isOpen = ref(false);
const resetMode = ref("current"); // "current" or "all"
let resolvePromise = null;

function open() {
  resetMode.value = "current";
  isOpen.value = true;

  return new Promise((resolve) => {
    resolvePromise = resolve;
  });
}

function confirm() {
  const result = {
    confirmed: true,
    mode: resetMode.value
  };

  isOpen.value = false;
  if (resolvePromise) {
    resolvePromise(result);
    resolvePromise = null;
  }
}

function cancel() {
  isOpen.value = false;
  if (resolvePromise) {
    resolvePromise({ confirmed: false });
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
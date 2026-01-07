<template>
  <Dialog :open="confirmationStore.isOpen" @update:open="handleOpenChange">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Confirm Action</DialogTitle>
      </DialogHeader>

      <p class="text-muted-foreground">{{ confirmationStore.message }}</p>

      <DialogFooter>
        <Button @click="confirmationStore.close()" variant="outline">
          Cancel
        </Button>
        <Button
          @click="confirmationStore.confirm()"
          :variant="confirmationStore.isDanger ? 'destructive' : 'default'"
        >
          Confirm
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { useConfirmationStore } from '@/stores/confirmation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const confirmationStore = useConfirmationStore()

const handleOpenChange = (open) => {
  if (!open) {
    confirmationStore.close()
  }
}
</script>

<style scoped>
/* No custom styles needed - using shadcn components */
</style>

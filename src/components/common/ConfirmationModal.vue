<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="confirmationStore.isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="confirmationStore.close()"
      >
        <div class="fixed inset-0 bg-black/60" @click="confirmationStore.close()"></div>
        <div
          class="relative w-full max-w-md rounded-lg bg-gray-800 border border-gray-700 p-6 shadow-lg"
          @click.stop
        >
          <h3 class="text-xl font-semibold text-white mb-2">Confirm Action</h3>
          <p class="mt-2 text-gray-300">{{ confirmationStore.message }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              @click="confirmationStore.close()"
              class="modal-button modal-button-cancel"
            >
              Cancel
            </button>
            <button
              @click="confirmationStore.confirm()"
              :class="confirmationStore.isDanger ? 'modal-button-danger' : 'modal-button-confirm'"
              class="modal-button"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useConfirmationStore } from '@/stores/confirmation'

const confirmationStore = useConfirmationStore()
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

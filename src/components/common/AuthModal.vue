<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="close"
      >
        <div class="fixed inset-0 bg-black/60" @click="close"></div>
        <div
          class="relative w-full max-w-md rounded-lg bg-[#1a1a1a] p-6 shadow-lg"
          @click.stop
        >
          <h3 class="text-xl font-semibold text-white mb-4">Admin Login</h3>
          
          <p class="text-sm text-gray-400 mb-4">
            Admin accounts must be created manually. Contact the administrator for access.
          </p>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                v-model="email"
                @keyup.enter="handleSignIn"
                placeholder="admin@example.com"
                class="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <input
                type="password"
                v-model="password"
                @keyup.enter="handleSignIn"
                placeholder="Enter password"
                class="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
              />
            </div>
            <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
            <div class="flex justify-end gap-3">
              <button @click="close" class="modal-button modal-button-cancel">Cancel</button>
              <button
                @click="handleSignIn"
                :disabled="isLoading"
                class="modal-button modal-button-confirm"
              >
                <span v-if="!isLoading">Sign In</span>
                <span v-else>Signing in...</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const { signIn } = useAuth()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)

const isOpen = computed(() => props.modelValue)

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    email.value = ''
    password.value = ''
    error.value = ''
  }
})

const close = () => {
  emit('update:modelValue', false)
}

const handleSignIn = async () => {
  if (!email.value || !password.value) {
    error.value = 'Please enter email and password'
    return
  }

  isLoading.value = true
  error.value = ''

  const result = await signIn(email.value, password.value)
  
  if (result.success) {
    close()
  } else {
    error.value = result.error || 'Sign in failed'
  }
  
  isLoading.value = false
}
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

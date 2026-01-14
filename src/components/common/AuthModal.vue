<template>
  <Dialog :open="authStore.isAuthModalOpen" @update:open="handleOpenChange">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Admin Login</DialogTitle>
        <DialogDescription>
          Admin accounts must be created manually. Contact the administrator for access.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Email</label>
          <Input
            type="email"
            v-model="email"
            @keyup.enter="handleSignIn"
            placeholder="admin@example.com"
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Password</label>
          <Input
            type="password"
            v-model="password"
            @keyup.enter="handleSignIn"
            placeholder="Enter password"
          />
        </div>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      </div>

      <DialogFooter>
        <Button @click="close" variant="outline">
          Cancel
        </Button>
        <Button @click="handleSignIn" :disabled="isLoading">
          <span v-if="!isLoading">Sign In</span>
          <span v-else>Signing in...</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useAuthStore } from '@/stores/auth'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const { signIn } = useAuth()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)

const handleOpenChange = (open) => {
  if (!open) {
    close()
  }
}

watch(() => authStore.isAuthModalOpen, (newVal) => {
  if (newVal) {
    email.value = ''
    password.value = ''
    error.value = ''
  }
})

const close = () => {
  authStore.closeAuthModal()
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
/* No custom styles needed - using shadcn components */
</style>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="settingsStore.isSettingsOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="settingsStore.closeSettings()"
      >
        <div class="fixed inset-0 bg-black/60" @click="settingsStore.closeSettings()"></div>
        <div
          class="relative w-full max-w-lg rounded-lg bg-[#1a1a1a] p-6 shadow-lg"
          @click.stop
        >
          <h3 class="text-xl font-semibold text-white mb-4">Settings</h3>

          <div class="settings-tabs mb-4">
            <button
              @click="settingsStore.settingsTab = 'pool'"
              class="settings-tab-button"
              :class="{ active: settingsStore.settingsTab === 'pool' }"
            >
              Fearless Pool
            </button>
            <button
              @click="settingsStore.settingsTab = 'admin'"
              class="settings-tab-button"
              :class="{ active: settingsStore.settingsTab === 'admin' }"
            >
              Admin
            </button>
          </div>

          <!-- Pool Settings Tab -->
          <div v-if="settingsStore.settingsTab === 'pool'" class="space-y-2 text-gray-300">
            <div class="flex items-center justify-between py-3 border-b border-gray-700">
              <label for="toggle-frozen-champions" class="font-medium">Frozen OP/Highlighted Cards</label>
              <div class="relative inline-block w-12 mr-2 align-middle select-none">
                <input
                  type="checkbox"
                  v-model="settingsStore.settings.pool.frozenChampions"
                  name="toggle-frozen-champions"
                  id="toggle-frozen-champions"
                  class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                />
                <label
                  for="toggle-frozen-champions"
                  class="toggle-label block overflow-hidden h-6 rounded-full bg-gray-600 cursor-pointer"
                ></label>
              </div>
            </div>
            <div class="py-3 border-b border-gray-700">
              <label class="font-medium block mb-3">Card Size Adjustments</label>
              
              <div class="space-y-4">
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <label for="normal-card-size" class="text-sm">Normal Cards</label>
                    <span class="text-sm text-gray-400">{{ settingsStore.settings.pool.normalCardSize }}%</span>
                  </div>
                  <input
                    type="range"
                    id="normal-card-size"
                    v-model.number="settingsStore.settings.pool.normalCardSize"
                    min="50"
                    max="200"
                    step="1"
                    class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>
                
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <label for="highlight-card-size" class="text-sm">OP/Highlight Cards</label>
                    <span class="text-sm text-gray-400">{{ settingsStore.settings.pool.highlightCardSize }}%</span>
                  </div>
                  <input
                    type="range"
                    id="highlight-card-size"
                    v-model.number="settingsStore.settings.pool.highlightCardSize"
                    min="50"
                    max="200"
                    step="1"
                    class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>
                
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <label for="unavailable-card-size" class="text-sm">Unavailable Cards</label>
                    <span class="text-sm text-gray-400">{{ settingsStore.settings.pool.unavailableCardSize }}%</span>
                  </div>
                  <input
                    type="range"
                    id="unavailable-card-size"
                    v-model.number="settingsStore.settings.pool.unavailableCardSize"
                    min="50"
                    max="200"
                    step="1"
                    class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between py-3 border-b border-gray-700">
              <label for="toggle-disable-animations" class="font-medium">Disable UI Animations</label>
              <div class="relative inline-block w-12 mr-2 align-middle select-none">
                <input
                  type="checkbox"
                  v-model="settingsStore.settings.pool.disableAnimations"
                  name="toggle-disable-animations"
                  id="toggle-disable-animations"
                  class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                />
                <label
                  for="toggle-disable-animations"
                  class="toggle-label block overflow-hidden h-6 rounded-full bg-gray-600 cursor-pointer"
                ></label>
              </div>
            </div>
            <div class="flex items-center justify-between py-3 border-b border-gray-700">
              <label for="toggle-center-cards" class="font-medium">Center Cards in Rows</label>
              <div class="relative inline-block w-12 mr-2 align-middle select-none">
                <input
                  type="checkbox"
                  v-model="settingsStore.settings.pool.centerCards"
                  name="toggle-center-cards"
                  id="toggle-center-cards"
                  class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                />
                <label
                  for="toggle-center-cards"
                  class="toggle-label block overflow-hidden h-6 rounded-full bg-gray-600 cursor-pointer"
                ></label>
              </div>
            </div>
            <div class="flex items-center justify-between py-3 border-b border-gray-700">
              <label for="toggle-enable-search" class="font-medium">Enable Champion Search</label>
              <div class="relative inline-block w-12 mr-2 align-middle select-none">
                <input
                  type="checkbox"
                  v-model="settingsStore.settings.pool.enableSearch"
                  name="toggle-enable-search"
                  id="toggle-enable-search"
                  class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                />
                <label
                  for="toggle-enable-search"
                  class="toggle-label block overflow-hidden h-6 rounded-full bg-gray-600 cursor-pointer"
                ></label>
              </div>
            </div>
          </div>

          <!-- Admin Tab -->
          <div v-if="settingsStore.settingsTab === 'admin'" class="space-y-4 text-gray-300">
            <div v-if="authStore.isAuthenticated && !authStore.isAnonymous" class="border-b border-gray-700 pb-4">
              <h4 class="font-semibold text-white mb-2">Authentication</h4>
              <p class="text-sm text-gray-400 mb-3">
                Signed in as: <span>{{ authStore.userEmail || 'Unknown' }}</span>
              </p>
              <button @click="handleSignOut" class="modal-button modal-button-cancel">Sign Out</button>
            </div>

            <div v-if="!authStore.isAuthenticated || authStore.isAnonymous">
              <div class="border-b border-gray-700 pb-4">
                <h4 class="font-semibold text-white mb-2">Admin Access</h4>
                <p class="text-sm text-gray-400 mb-3">
                  Sign in with an admin account to access admin features. Admin accounts must be created manually in Firebase Console.
                </p>
                <button
                  @click="openAuthModal"
                  class="modal-button modal-button-confirm"
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>

          <div class="mt-6 flex justify-between items-center">
            <button 
              @click="handleReset" 
              class="modal-button modal-button-cancel"
            >
              Reset
            </button>
            <div class="flex gap-3">
              <button @click="settingsStore.closeSettings()" class="modal-button modal-button-confirm">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    
    <!-- Auth Modal -->
    <AuthModal v-model="isAuthModalOpen" />
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { useConfirmationStore } from '@/stores/confirmation'
import { useAuth } from '@/composables/useAuth'
import AuthModal from './AuthModal.vue'

const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const confirmationStore = useConfirmationStore()
const { signOut } = useAuth()

const handleSignOut = async () => {
  await signOut()
  settingsStore.closeSettings()
}

const handleReset = () => {
  confirmationStore.open({
    message: 'Are you sure you want to reset all settings to their default values?',
    confirmAction: () => {
      settingsStore.resetSettings()
    }
  })
}

const isAuthModalOpen = ref(false)

const openAuthModal = () => {
  settingsStore.closeSettings()
  isAuthModalOpen.value = true
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

.settings-tabs {
  display: flex;
  border-bottom: 1px solid #374151;
}

.settings-tab-button {
  padding: 0.75rem 1rem;
  font-weight: 500;
  color: #9ca3af;
  transition: colors 0.2s;
  border-bottom: 2px solid transparent;
}

.settings-tab-button:hover {
  color: white;
}

.settings-tab-button.active {
  color: #f59e0b;
  border-bottom-color: #f59e0b;
}

.toggle-checkbox:checked + .toggle-label {
  background-color: #f59e0b;
}

.toggle-checkbox:checked {
  transform: translateX(0.5rem);
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #f59e0b;
  cursor: pointer;
  transition: background 0.2s;
}

.slider::-webkit-slider-thumb:hover {
  background: #d97706;
}

.slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #f59e0b;
  cursor: pointer;
  border: none;
  transition: background 0.2s;
}

.slider::-moz-range-thumb:hover {
  background: #d97706;
}
</style>

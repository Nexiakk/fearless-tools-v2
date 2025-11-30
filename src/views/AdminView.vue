<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="adminStore.isOpen && authStore.isAdmin && authStore.isAuthenticated && !authStore.isAnonymous"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="adminStore.close()"
        @keydown.escape="adminStore.close()"
      >
        <div class="fixed inset-0 bg-black/60" @click="adminStore.close()"></div>
        <div
          class="relative w-full max-w-6xl max-h-[90vh] rounded-lg bg-gray-800 border border-gray-700 shadow-lg flex flex-col"
          @click.stop
        >
            <!-- Header -->
            <div class="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 class="text-2xl font-semibold text-white">Admin Panel</h3>
              <button
                @click="adminStore.close()"
                class="text-gray-400 hover:text-white transition-colors"
              >
                <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
            
            <!-- Tabs -->
            <div class="flex border-b border-gray-700 px-6">
              <button
                @click="adminStore.activeTab = 'champions'"
                class="px-4 py-3 font-medium transition-colors relative"
                :class="{
                  'border-b-2 border-amber-500 text-amber-500': adminStore.activeTab === 'champions',
                  'text-gray-400 hover:text-white': adminStore.activeTab !== 'champions'
                }"
              >
                Champion Editor
                <span
                  v-if="adminStore.newChampionsCount > 0"
                  class="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
                >
                  {{ adminStore.newChampionsCount }}
                </span>
              </button>
              <button
                @click="adminStore.activeTab = 'opTier'"
                class="px-4 py-3 font-medium transition-colors"
                :class="{
                  'border-b-2 border-amber-500 text-amber-500': adminStore.activeTab === 'opTier',
                  'text-gray-400 hover:text-white': adminStore.activeTab !== 'opTier'
                }"
              >
                OP Tier Editor
              </button>
              <!-- Migration tab hidden - no longer needed as data is in cloud, but kept for potential future use -->
              <!--
              <button
                @click="adminStore.activeTab = 'migration'"
                class="px-4 py-3 font-medium transition-colors"
                :class="{
                  'border-b-2 border-amber-500 text-amber-500': adminStore.activeTab === 'migration',
                  'text-gray-400 hover:text-white': adminStore.activeTab !== 'migration'
                }"
              >
                Migration
              </button>
              -->
              <button
                @click="adminStore.activeTab = 'settings'"
                class="px-4 py-3 font-medium transition-colors"
                :class="{
                  'border-b-2 border-amber-500 text-amber-500': adminStore.activeTab === 'settings',
                  'text-gray-400 hover:text-white': adminStore.activeTab !== 'settings'
                }"
              >
                Settings
              </button>
              <button
                @click="adminStore.activeTab = 'workspaceSettings'"
                class="px-4 py-3 font-medium transition-colors"
                :class="{
                  'border-b-2 border-amber-500 text-amber-500': adminStore.activeTab === 'workspaceSettings',
                  'text-gray-400 hover:text-white': adminStore.activeTab !== 'workspaceSettings'
                }"
              >
                Workspace Settings
              </button>
            </div>
            
            <!-- Messages -->
            <div v-if="adminStore.error" class="mx-6 mt-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
              {{ adminStore.error }}
            </div>
            <div v-if="adminStore.success" class="mx-6 mt-4 p-3 bg-green-900/50 border border-green-700 rounded text-green-200 text-sm">
              {{ adminStore.success }}
            </div>
            
            <!-- Champion Editor Tab -->
            <div v-if="adminStore.activeTab === 'champions'" class="flex-1 overflow-auto p-6">
              <div class="mb-4 flex gap-4 items-center">
                <div class="flex-1 relative">
                  <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
                  </svg>
                  <input
                    type="text"
                    v-model="adminStore.searchTerm"
                    placeholder="Search champions..."
                    class="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <select
                  v-model="adminStore.roleFilter"
                  class="px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Roles</option>
                  <option value="Top">Top</option>
                  <option value="Jungle">Jungle</option>
                  <option value="Mid">Mid</option>
                  <option value="Bot">Bot</option>
                  <option value="Support">Support</option>
                  <option value="multiple">Multiple Roles</option>
                  <option value="new">New (No Roles)</option>
                </select>
                <button
                  @click="adminStore.exportChampionData()"
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Export JSON
                </button>
                <label class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors cursor-pointer">
                  Import JSON
                  <input
                    type="file"
                    accept=".json"
                    @change="adminStore.importChampionData($event)"
                    class="hidden"
                  />
                </label>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div
                  v-for="champion in adminStore.filteredChampions"
                  :key="champion.id"
                  class="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors cursor-pointer relative"
                  :class="{ 'border-2 border-red-500': adminStore.isNewChampion(champion) }"
                  @click="adminStore.openEditModal(champion)"
                >
                  <div v-if="adminStore.isNewChampion(champion)" class="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                    NEW
                  </div>
                  <div class="flex items-center gap-3">
                    <img
                      :src="championsStore.getChampionIconUrl(champion.name)"
                      :alt="champion.name"
                      class="w-12 h-12 rounded"
                    />
                    <div class="flex-1">
                      <h4 class="font-semibold text-white">{{ champion.name }}</h4>
                      <p class="text-sm text-gray-400">{{ adminStore.getRolesDisplay(champion) }}</p>
                    </div>
                    <svg class="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828Z" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <p v-if="adminStore.filteredChampions.length === 0" class="text-gray-400 text-center py-8">
                No champions found.
              </p>
            </div>
            
            <!-- OP Tier Editor Tab -->
            <div v-if="adminStore.activeTab === 'opTier'" class="flex-1 overflow-auto p-6">
              <div class="mb-4">
                <div class="relative">
                  <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
                  </svg>
                  <input
                    type="text"
                    v-model="adminStore.opTierSearchTerm"
                    placeholder="Search champions..."
                    class="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              
              <div class="overflow-x-auto">
                <table class="w-full border-collapse">
                  <thead>
                    <tr class="border-b border-gray-700">
                      <th class="text-left p-3 text-gray-300 font-semibold">Champion</th>
                      <th class="text-center p-3 text-gray-300 font-semibold">Top</th>
                      <th class="text-center p-3 text-gray-300 font-semibold">Jungle</th>
                      <th class="text-center p-3 text-gray-300 font-semibold">Mid</th>
                      <th class="text-center p-3 text-gray-300 font-semibold">Bot</th>
                      <th class="text-center p-3 text-gray-300 font-semibold">Support</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="champion in adminStore.filteredChampionsForOpTier"
                      :key="champion.id"
                      class="border-b border-gray-700 hover:bg-gray-700/50"
                    >
                      <td class="p-3">
                        <div class="flex items-center gap-2">
                          <img
                            :src="championsStore.getChampionIconUrl(champion.name)"
                            :alt="champion.name"
                            class="w-8 h-8 rounded"
                          />
                          <span class="text-white font-medium">{{ champion.name }}</span>
                        </div>
                      </td>
                      <td
                        v-for="role in adminStore.validRoles"
                        :key="role"
                        class="p-3 text-center"
                      >
                        <input
                          type="checkbox"
                          :checked="adminStore.isOpForRole(champion.name, role)"
                          @change="adminStore.toggleOpTier(champion.name, role)"
                          class="w-5 h-5 rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500 focus:ring-2"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <p v-if="adminStore.filteredChampionsForOpTier.length === 0" class="text-gray-400 text-center py-8">
                No champions found.
              </p>
            </div>
            
            <!-- Migration Tab - Hidden: No longer needed as data is in cloud, but kept for potential future use -->
            <!--
            <div v-if="adminStore.activeTab === 'migration'" class="flex-1 overflow-auto p-6">
              <div class="max-w-2xl mx-auto space-y-6">
                <div class="bg-gray-700 rounded-lg p-6">
                  <h4 class="text-xl font-semibold text-white mb-4">Migrate from champions.js</h4>
                  <p class="text-gray-300 mb-4">
                    This will migrate champion data from the static champions.js file to Firestore (GLOBAL - shared by all workspaces).
                  </p>
                  <button
                    @click="adminStore.migrateFromChampionsJs()"
                    :disabled="adminStore.isLoading"
                    class="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span v-if="!adminStore.isLoading">Migrate Data</span>
                    <span v-else>Migrating...</span>
                  </button>
                  <p v-if="adminStore.migrationStatus" class="mt-4 text-gray-300">
                    {{ adminStore.migrationStatus }}
                  </p>
                </div>
              </div>
            </div>
            -->
            
            <!-- Settings Tab -->
            <div v-if="adminStore.activeTab === 'settings'" class="flex-1 overflow-auto p-6">
              <div class="max-w-2xl mx-auto space-y-6">
                <div class="bg-gray-700 rounded-lg p-6">
                  <h4 class="text-xl font-semibold text-white mb-4">Global Settings</h4>
                  
                  <div class="space-y-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-300 mb-2">Anonymous User Mode</label>
                      <p class="text-sm text-gray-400 mb-3">Control what anonymous users can do in workspaces.</p>
                      <div class="space-y-2">
                        <label class="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            v-model="adminStore.globalSettings.anonymousUserMode"
                            value="interact"
                            class="w-4 h-4 text-amber-500 bg-gray-700 border-gray-600 focus:ring-amber-500 focus:ring-2"
                          />
                          <div>
                            <span class="text-white font-medium">Interact</span>
                            <p class="text-sm text-gray-400">Anonymous users can highlight champions, mark unavailable, and edit drafting.</p>
                          </div>
                        </label>
                        <label class="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            v-model="adminStore.globalSettings.anonymousUserMode"
                            value="view"
                            class="w-4 h-4 text-amber-500 bg-gray-700 border-gray-600 focus:ring-amber-500 focus:ring-2"
                          />
                          <div>
                            <span class="text-white font-medium">View Only</span>
                            <p class="text-sm text-gray-400">Anonymous users can only view, no editing allowed.</p>
                          </div>
                        </label>
                      </div>
                    </div>
                    
                    <div class="pt-4 border-t border-gray-600">
                      <button
                        @click="adminStore.saveGlobalSettings()"
                        :disabled="adminStore.isSavingSettings"
                        class="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span v-if="!adminStore.isSavingSettings">Save Settings</span>
                        <span v-else>Saving...</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Workspace Settings Tab -->
            <div v-if="adminStore.activeTab === 'workspaceSettings'" class="flex-1 overflow-auto p-6">
              <div class="max-w-2xl mx-auto space-y-6">
                <!-- Create New Workspace Section -->
                <div class="bg-gray-700 rounded-lg p-6">
                  <h4 class="text-xl font-semibold text-white mb-4">Create New Workspace</h4>
                  
                  <div class="space-y-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-300 mb-2">Workspace Name</label>
                      <input
                        type="text"
                        v-model="newWorkspaceName"
                        placeholder="Workspace name"
                        class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                      />
                      <p class="text-xs text-gray-500 mt-1">
                        The workspace ID will be generated from the name (alphanumeric characters and spaces only).
                      </p>
                    </div>
                    
                    <div>
                      <label class="block text-sm font-medium text-gray-300 mb-2">Password</label>
                      <input
                        type="password"
                        v-model="newWorkspacePassword"
                        placeholder="Enter password"
                        class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    
                    <div v-if="newWorkspacePassword">
                      <label class="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                      <input
                        type="password"
                        v-model="newWorkspacePasswordConfirm"
                        placeholder="Confirm password"
                        class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    
                    <p v-if="createWorkspaceError" class="text-red-400 text-sm">{{ createWorkspaceError }}</p>
                    <p v-if="createWorkspaceSuccess" class="text-green-400 text-sm">{{ createWorkspaceSuccess }}</p>
                    
                    <div class="pt-4 border-t border-gray-600">
                      <button
                        @click="handleCreateWorkspace"
                        :disabled="isCreatingWorkspace || !newWorkspaceName || !newWorkspacePassword"
                        class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span v-if="!isCreatingWorkspace">Create Workspace</span>
                        <span v-else>Creating...</span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Edit Current Workspace Section -->
                <div class="bg-gray-700 rounded-lg p-6">
                  <h4 class="text-xl font-semibold text-white mb-4">Edit Current Workspace</h4>
                  
                  <div v-if="!workspaceStore.currentWorkspaceId || workspaceStore.isLocalWorkspace" class="text-gray-400 text-sm mb-4">
                    <p v-if="!workspaceStore.currentWorkspaceId">No workspace selected.</p>
                    <p v-else>Workspace settings are only available for Firestore workspaces, not local workspaces.</p>
                  </div>
                  
                  <div v-else class="space-y-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-300 mb-2">Workspace Name</label>
                      <input
                        type="text"
                        v-model="workspaceName"
                        placeholder="Workspace name"
                        class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    
                    <div>
                      <label class="block text-sm font-medium text-gray-300 mb-2">New Password (leave blank to keep current)</label>
                      <input
                        type="password"
                        v-model="newPassword"
                        placeholder="New password"
                        class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    
                    <div v-if="newPassword">
                      <label class="block text-sm font-medium text-gray-300 mb-2">Confirm New Password</label>
                      <input
                        type="password"
                        v-model="confirmPassword"
                        placeholder="Confirm password"
                        class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    
                    <p v-if="workspaceSettingsError" class="text-red-400 text-sm">{{ workspaceSettingsError }}</p>
                    <p v-if="workspaceSettingsSuccess" class="text-green-400 text-sm">{{ workspaceSettingsSuccess }}</p>
                    
                    <div class="pt-4 border-t border-gray-600">
                      <button
                        @click="handleSaveWorkspaceSettings"
                        :disabled="isSavingWorkspaceSettings"
                        class="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span v-if="!isSavingWorkspaceSettings">Save Settings</span>
                        <span v-else>Saving...</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Edit Champion Modal -->
            <Teleport to="body">
              <Transition name="fade">
                <div
                  v-if="adminStore.isEditModalOpen && adminStore.editedChampion"
                  class="fixed inset-0 z-50 flex items-center justify-center p-4"
                  @click.self="adminStore.closeEditModal()"
                >
                  <div class="fixed inset-0 bg-black/60" @click="adminStore.closeEditModal()"></div>
                  <div
                    class="relative w-full max-w-md rounded-lg bg-gray-800 border border-gray-700 p-6 shadow-lg"
                    @click.stop
                  >
                    <h3 class="text-xl font-semibold text-white mb-4">Edit Champion</h3>
                    
                    <div v-if="adminStore.editedChampion" class="space-y-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Champion Name</label>
                        <input
                          type="text"
                          v-model="adminStore.editedChampion.name"
                          class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      
                      <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Image Name</label>
                        <input
                          type="text"
                          v-model="adminStore.editedChampion.imageName"
                          class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      
                      <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Roles</label>
                        <div class="flex flex-wrap gap-2">
                          <button
                            v-for="role in adminStore.validRoles"
                            :key="role"
                            @click="adminStore.toggleRole(role)"
                            class="px-3 py-1 rounded transition-colors"
                            :class="{
                              'bg-amber-600 text-white': adminStore.editedChampion.roles.includes(role),
                              'bg-gray-700 text-gray-300 hover:bg-gray-600': !adminStore.editedChampion.roles.includes(role)
                            }"
                          >
                            {{ role }}
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Main Role</label>
                        <select
                          v-model="adminStore.editedChampion.mainRole"
                          @change="adminStore.setMainRole(adminStore.editedChampion.mainRole)"
                          class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
                          :disabled="!adminStore.editedChampion.roles || adminStore.editedChampion.roles.length === 0"
                        >
                          <option
                            v-for="role in adminStore.getSortedRoles(adminStore.editedChampion)"
                            :key="role"
                            :value="role"
                          >
                            {{ role }}
                          </option>
                          <option v-if="!adminStore.editedChampion.roles || adminStore.editedChampion.roles.length === 0" value="">
                            No roles selected
                          </option>
                        </select>
                        <p
                          v-if="adminStore.editedChampion.roles && adminStore.editedChampion.roles.length === 1"
                          class="text-xs text-gray-400 mt-1"
                        >
                          Only one role selected - this is automatically the main role
                        </p>
                      </div>
                    </div>
                    
                    <div class="mt-6 flex justify-end gap-3">
                      <button
                        @click="adminStore.closeEditModal()"
                        class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        @click="adminStore.saveChampion()"
                        :disabled="adminStore.isLoading"
                        class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span v-if="!adminStore.isLoading">Save</span>
                        <span v-else>Saving...</span>
                      </button>
                    </div>
                  </div>
                </div>
              </Transition>
            </Teleport>
          </div>
        </div>
      </Transition>
    </Teleport>
</template>

<script setup>
import { onMounted, watch, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import { useChampionsStore } from '@/stores/champions'
import { useWorkspaceStore } from '@/stores/workspace'
import { useWorkspace } from '@/composables/useWorkspace'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const adminStore = useAdminStore()
const championsStore = useChampionsStore()
const workspaceStore = useWorkspaceStore()
const { updateWorkspaceSettings, createWorkspace } = useWorkspace()
const router = useRouter()

// Workspace settings state
const workspaceName = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const workspaceSettingsError = ref('')
const workspaceSettingsSuccess = ref('')
const isSavingWorkspaceSettings = ref(false)

// Create workspace state
const newWorkspaceName = ref('')
const newWorkspacePassword = ref('')
const newWorkspacePasswordConfirm = ref('')
const createWorkspaceError = ref('')
const createWorkspaceSuccess = ref('')
const isCreatingWorkspace = ref(false)

// Watch for tab changes to reset workspace settings form
watch(() => adminStore.activeTab, (tab) => {
  if (tab === 'workspaceSettings') {
    workspaceName.value = workspaceStore.currentWorkspaceName || ''
    newPassword.value = ''
    confirmPassword.value = ''
    workspaceSettingsError.value = ''
    workspaceSettingsSuccess.value = ''
    // Reset create workspace form
    newWorkspaceName.value = ''
    newWorkspacePassword.value = ''
    newWorkspacePasswordConfirm.value = ''
    createWorkspaceError.value = ''
    createWorkspaceSuccess.value = ''
  }
  if (tab === 'settings' && adminStore.isOpen) {
    adminStore.loadGlobalSettings()
  }
})

// Watch for workspace changes to update form
watch(() => workspaceStore.currentWorkspaceName, (name) => {
  if (adminStore.activeTab === 'workspaceSettings') {
    workspaceName.value = name || ''
  }
})

const handleSaveWorkspaceSettings = async () => {
  workspaceSettingsError.value = ''
  workspaceSettingsSuccess.value = ''
  
  if (newPassword.value && newPassword.value !== confirmPassword.value) {
    workspaceSettingsError.value = 'Passwords do not match'
    return
  }
  
  isSavingWorkspaceSettings.value = true
  
  try {
    const updates = {}
    if (workspaceName.value && workspaceName.value.trim() !== '') {
      updates.name = workspaceName.value.trim()
    }
    if (newPassword.value && newPassword.value.trim() !== '') {
      updates.password = newPassword.value.trim()
    }
    
    if (Object.keys(updates).length === 0) {
      workspaceSettingsError.value = 'No changes to save'
      isSavingWorkspaceSettings.value = false
      return
    }
    
    await updateWorkspaceSettings(updates)
    workspaceSettingsSuccess.value = 'Settings saved successfully'
    workspaceStore.currentWorkspaceName = workspaceName.value
    
    setTimeout(() => {
      workspaceSettingsSuccess.value = ''
    }, 3000)
  } catch (err) {
    workspaceSettingsError.value = err.message || 'Failed to save settings'
  } finally {
    isSavingWorkspaceSettings.value = false
  }
}

const handleCreateWorkspace = async () => {
  createWorkspaceError.value = ''
  createWorkspaceSuccess.value = ''
  
  if (!newWorkspaceName.value || newWorkspaceName.value.trim() === '') {
    createWorkspaceError.value = 'Workspace name is required'
    return
  }
  
  if (!newWorkspacePassword.value || newWorkspacePassword.value.trim() === '') {
    createWorkspaceError.value = 'Password is required'
    return
  }
  
  if (newWorkspacePassword.value !== newWorkspacePasswordConfirm.value) {
    createWorkspaceError.value = 'Passwords do not match'
    return
  }
  
  isCreatingWorkspace.value = true
  
  try {
    const result = await createWorkspace(newWorkspaceName.value.trim(), newWorkspacePassword.value)
    
    if (result.success) {
      createWorkspaceSuccess.value = `Workspace "${newWorkspaceName.value.trim()}" created successfully!`
      // Clear form
      newWorkspaceName.value = ''
      newWorkspacePassword.value = ''
      newWorkspacePasswordConfirm.value = ''
      
      // Optionally switch to the new workspace
      if (result.workspaceId) {
        setTimeout(async () => {
          await workspaceStore.loadWorkspace(result.workspaceId)
          createWorkspaceSuccess.value = `Workspace created and loaded successfully!`
        }, 1000)
      }
      
      setTimeout(() => {
        createWorkspaceSuccess.value = ''
      }, 5000)
    } else {
      createWorkspaceError.value = result.error || 'Failed to create workspace'
    }
  } catch (err) {
    createWorkspaceError.value = err.message || 'Failed to create workspace'
  } finally {
    isCreatingWorkspace.value = false
  }
}

// Open admin panel when route is /admin
watch(() => router.currentRoute.value.path, (path) => {
  if (path === '/admin' && authStore.isAdmin && authStore.isAuthenticated && !authStore.isAnonymous) {
    adminStore.open()
  } else if (path !== '/admin' && adminStore.isOpen) {
    adminStore.close()
  }
}, { immediate: true })

onMounted(() => {
  if (router.currentRoute.value.path === '/admin' && authStore.isAdmin && authStore.isAuthenticated && !authStore.isAnonymous) {
    adminStore.open()
    // Load settings when admin panel opens
    adminStore.loadGlobalSettings()
  }
})

// Load settings when admin panel opens
watch(() => adminStore.isOpen, (isOpen) => {
  if (isOpen) {
    adminStore.loadGlobalSettings()
    // Initialize workspace settings form if on that tab
    if (adminStore.activeTab === 'workspaceSettings') {
      workspaceName.value = workspaceStore.currentWorkspaceName || ''
    }
  }
})
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

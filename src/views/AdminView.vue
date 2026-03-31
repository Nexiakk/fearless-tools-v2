<template>
  <Dialog v-model:open="adminStore.isOpen">
    <DialogContent class="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle>Admin Panel</DialogTitle>
      </DialogHeader>

      <Tabs v-model="adminStore.activeTab" class="flex-1 flex flex-col overflow-hidden">
        <TabsList class="grid w-full grid-cols-3">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="workspaceSettings">Workspace Settings</TabsTrigger>
          <TabsTrigger value="defaultTiers">Tier Settings</TabsTrigger>
        </TabsList>

        <!-- Messages -->
        <div v-if="adminStore.error" class="mx-6 mt-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
          {{ adminStore.error }}
        </div>
        <div v-if="adminStore.success" class="mx-6 mt-4 p-3 bg-green-900/50 border border-green-700 rounded text-green-200 text-sm">
          {{ adminStore.success }}
        </div>

        <!-- Settings Tab -->
        <TabsContent value="settings" class="flex-1 overflow-auto p-6 mt-0">
          <div class="max-w-2xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Global Settings</CardTitle>
              </CardHeader>
              <CardContent class="space-y-4">
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
                  <Button
                    @click="adminStore.saveGlobalSettings()"
                    :disabled="adminStore.isSavingSettings"
                    variant="default"
                  >
                    <span v-if="!adminStore.isSavingSettings">Save Settings</span>
                    <span v-else>Saving...</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <!-- Workspace Settings Tab -->
        <TabsContent value="workspaceSettings" class="flex-1 overflow-auto p-6 mt-0">
          <div class="max-w-2xl mx-auto space-y-6">
            <!-- Create New Workspace Section -->
            <Card>
              <CardHeader>
                <CardTitle>Create New Workspace</CardTitle>
              </CardHeader>
              <CardContent class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Workspace Name</label>
                  <Input
                    v-model="newWorkspaceName"
                    placeholder="Workspace name"
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    The workspace ID will be generated from the name (alphanumeric characters and spaces only).
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">Password</label>
                  <Input
                    type="password"
                    v-model="newWorkspacePassword"
                    placeholder="Enter password"
                  />
                </div>

                <div v-if="newWorkspacePassword">
                  <label class="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                  <Input
                    type="password"
                    v-model="newWorkspacePasswordConfirm"
                    placeholder="Confirm password"
                  />
                </div>

                <p v-if="createWorkspaceError" class="text-red-400 text-sm">{{ createWorkspaceError }}</p>
                <p v-if="createWorkspaceSuccess" class="text-green-400 text-sm">{{ createWorkspaceSuccess }}</p>

                <div class="pt-4 border-t border-gray-600">
                  <Button
                    @click="handleCreateWorkspace"
                    :disabled="isCreatingWorkspace || !newWorkspaceName || !newWorkspacePassword"
                    variant="default"
                  >
                    <span v-if="!isCreatingWorkspace">Create Workspace</span>
                    <span v-else>Creating...</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <!-- Edit Current Workspace Section -->
            <Card>
              <CardHeader>
                <CardTitle>Edit Current Workspace</CardTitle>
              </CardHeader>
              <CardContent>
                <div v-if="!workspaceStore.currentWorkspaceId || workspaceStore.isLocalWorkspace" class="text-gray-400 text-sm mb-4">
                  <p v-if="!workspaceStore.currentWorkspaceId">No workspace selected.</p>
                  <p v-else>Workspace settings are only available for Firestore workspaces, not local workspaces.</p>
                </div>

                <div v-else class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">Workspace Name</label>
                    <Input
                      v-model="workspaceName"
                      placeholder="Workspace name"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">New Password (leave blank to keep current)</label>
                    <Input
                      type="password"
                      v-model="newPassword"
                      placeholder="New password"
                    />
                  </div>

                  <div v-if="newPassword">
                    <label class="block text-sm font-medium text-gray-300 mb-2">Confirm New Password</label>
                    <Input
                      type="password"
                      v-model="confirmPassword"
                      placeholder="Confirm password"
                    />
                  </div>

                  <p v-if="workspaceSettingsError" class="text-red-400 text-sm">{{ workspaceSettingsError }}</p>
                  <p v-if="workspaceSettingsSuccess" class="text-green-400 text-sm">{{ workspaceSettingsSuccess }}</p>

                  <div class="pt-4 border-t border-gray-600">
                    <Button
                      @click="handleSaveWorkspaceSettings"
                      :disabled="isSavingWorkspaceSettings"
                      variant="default"
                    >
                      <span v-if="!isSavingWorkspaceSettings">Save Settings</span>
                      <span v-else>Saving...</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <!-- Tier Settings Tab -->
        <TabsContent value="defaultTiers" class="flex-1 overflow-auto p-6 mt-0">
          <div class="flex gap-6 h-full">
            <!-- Left Column: Save Tier Template -->
            <div class="w-2/5">
              <Card class="h-full">
                <CardHeader>
                  <CardTitle>Save Tier Template</CardTitle>
                  <CardDescription>
                    Save the current workspace's tier configuration as a reusable template.
                  </CardDescription>
                </CardHeader>
                <CardContent class="space-y-4">
                  <div v-if="!workspaceStore.currentWorkspaceId" class="text-gray-400 text-sm">
                    No workspace selected. Please select a workspace first.
                  </div>

                  <div v-else-if="!workspaceTiersStore.hasWorkspaceTiers" class="text-gray-400 text-sm">
                    This workspace is using default tiers. Configure custom tiers in the Champion Pool view first.
                  </div>

                  <div v-else>
                    <div class="space-y-3 mb-4">
                      <h4 class="text-white font-medium">Current Tier Configuration:</h4>
                      <div class="space-y-2">
                        <div
                          v-for="tier in workspaceTiersStore.sortedTiers"
                          :key="tier.id"
                          class="flex items-center gap-3 p-3 bg-gray-700 rounded"
                        >
                          <div
                            class="w-4 h-4 rounded"
                            :style="{ backgroundColor: tier.color }"
                          ></div>
                          <span class="text-white">{{ tier.name }}</span>
                          <span class="text-gray-400 text-sm">
                            ({{ Object.keys(tier.champions).length }} champions)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div class="pt-4 border-t border-gray-600 space-y-3">
                      <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Template Name</label>
                        <input
                          v-model="templateName"
                          type="text"
                          class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
                          placeholder="Enter template name"
                        />
                      </div>

                      <Button
                        @click="saveAsTemplate"
                        :disabled="isSavingTemplate || !templateName.trim()"
                        variant="default"
                        class="w-full"
                      >
                        <span v-if="!isSavingTemplate">Save as Template</span>
                        <span v-else>Saving...</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <!-- Right Column: Saved Templates + Global Default Setup -->
            <div class="w-3/5 flex flex-col gap-6">
              <!-- Saved Templates Section -->
              <Card class="flex-1">
                <CardHeader>
                  <CardTitle>Saved Templates</CardTitle>
                  <CardDescription>
                    Load a previously saved tier template into the current workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent class="space-y-4">
                  <div v-if="workspaceTiersStore.isLoadingTemplates" class="text-gray-400 text-sm">
                    Loading templates...
                  </div>

                  <div v-else-if="workspaceTiersStore.templates.length === 0" class="text-gray-400 text-sm">
                    No templates saved yet. Save your current tier configuration as a template above.
                  </div>

                  <div v-else class="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    <div
                      v-for="template in workspaceTiersStore.templates"
                      :key="template.id"
                      class="group p-4 bg-gray-700 rounded-lg"
                    >
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <!-- Template name with edit functionality -->
                          <div v-if="editingTemplateId === template.id" class="flex items-center gap-2">
                            <input
                              v-model="editingTemplateName"
                              type="text"
                              class="flex-1 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:border-amber-500"
                              @keyup.enter="saveTemplateName(template.id)"
                              @keyup.escape="cancelEditTemplateName"
                            />
                            <button
                              @click="saveTemplateName(template.id)"
                              class="p-1 text-green-400 hover:text-green-300 transition-colors"
                              title="Save"
                            >
                              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              @click="cancelEditTemplateName"
                              class="p-1 text-gray-400 hover:text-white transition-colors"
                              title="Cancel"
                            >
                              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          <div v-else class="flex items-center gap-2">
                            <h4 class="text-white font-medium">{{ template.name }}</h4>
                            <button
                              @click="startEditTemplateName(template)"
                              class="p-1 text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                              title="Edit name"
                            >
                              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                          <p class="text-gray-400 text-sm mt-1">
                            {{ template.tiers.length }} tiers
                          </p>
                          <div class="flex flex-wrap gap-1 mt-2">
                            <div
                              v-for="tier in template.tiers"
                              :key="tier.id"
                              class="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                              :style="{ backgroundColor: tier.color + '33', borderLeft: `2px solid ${tier.color}` }"
                            >
                              <span class="text-white">{{ tier.name }}</span>
                              <span class="text-gray-400">({{ Object.keys(tier.champions || {}).length }})</span>
                            </div>
                          </div>
                        </div>
                        <div class="flex items-center gap-2 ml-4">
                          <Button
                            @click="loadTemplate(template.id)"
                            :disabled="isLoadingTemplate"
                            variant="default"
                            size="sm"
                          >
                            <span v-if="!isLoadingTemplate">Load</span>
                            <span v-else>Loading...</span>
                          </Button>
                          <Button
                            @click="deleteTemplate(template.id, template.name)"
                            variant="destructive"
                            size="sm"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <!-- Global Defaults Section -->
              <Card>
                <CardHeader>
                  <CardTitle>Global Default Setup</CardTitle>
                  <CardDescription>
                    Save the current workspace's tier configuration as the global default that will be loaded for all new workspaces.
                  </CardDescription>
                </CardHeader>
                <CardContent class="space-y-4">
                  <div v-if="!workspaceStore.currentWorkspaceId" class="text-gray-400 text-sm">
                    No workspace selected. Please select a workspace first.
                  </div>

                  <div v-else-if="!workspaceTiersStore.hasWorkspaceTiers" class="text-gray-400 text-sm">
                    This workspace is using default tiers. Configure custom tiers in the Champion Pool view first.
                  </div>

                  <div v-else class="pt-4 space-y-3">
                    <Button
                      @click="saveAsDefaultTiers"
                      :disabled="isSavingDefaultTiers"
                      variant="default"
                      class="w-full"
                    >
                      <span v-if="!isSavingDefaultTiers">Save as Global Default</span>
                      <span v-else>Saving...</span>
                    </Button>

                    <Button
                      @click="resetToOriginalDefaults"
                      :disabled="isResettingDefaults"
                      variant="outline"
                      class="w-full"
                    >
                      <span v-if="!isResettingDefaults">Reset to Original Defaults</span>
                      <span v-else>Resetting...</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { onMounted, watch, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import { useChampionsStore } from '@/stores/champions'
import { useWorkspaceStore } from '@/stores/workspace'
import { useWorkspaceTiersStore } from '@/stores/workspaceTiers'
import { useWorkspace } from '@/composables/useWorkspace'
import { useRouter } from 'vue-router'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Tabs from '@/components/ui/tabs/Tabs.vue'
import TabsList from '@/components/ui/tabs/TabsList.vue'
import TabsTrigger from '@/components/ui/tabs/TabsTrigger.vue'
import TabsContent from '@/components/ui/tabs/TabsContent.vue'
import Button from '@/components/ui/button/Button.vue'
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardDescription from '@/components/ui/card/CardDescription.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import Input from '@/components/ui/input/Input.vue'

const authStore = useAuthStore()
const adminStore = useAdminStore()
const championsStore = useChampionsStore()
const workspaceStore = useWorkspaceStore()
const workspaceTiersStore = useWorkspaceTiersStore()
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

// Default tiers state
const isSavingDefaultTiers = ref(false)
const isResettingDefaults = ref(false)

// Template state
const templateName = ref('')
const isSavingTemplate = ref(false)
const isLoadingTemplate = ref(false)
const editingTemplateId = ref(null)
const editingTemplateName = ref('')

// Load templates when admin panel opens
watch(() => adminStore.isOpen, (isOpen) => {
  if (isOpen) {
    adminStore.loadGlobalSettings()
    // Load templates
    workspaceTiersStore.loadAllTemplates()
    // Initialize workspace settings form if on that tab
    if (adminStore.activeTab === 'workspaceSettings') {
      workspaceName.value = workspaceStore.currentWorkspaceName || ''
    }
  }
})

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

const saveAsDefaultTiers = async () => {
  if (!workspaceTiersStore.hasWorkspaceTiers) {
    adminStore.error = 'No custom tiers to save'
    return
  }

  isSavingDefaultTiers.value = true
  adminStore.error = ''
  adminStore.success = ''

  try {
    await workspaceTiersStore.saveAsGlobalDefaults()
    adminStore.success = 'Default tiers saved successfully! New workspaces will use this configuration.'
    setTimeout(() => {
      adminStore.success = ''
    }, 3000)
  } catch (err) {
    adminStore.error = err.message || 'Failed to save default tiers'
  } finally {
    isSavingDefaultTiers.value = false
  }
}

const resetToOriginalDefaults = async () => {
  isResettingDefaults.value = true
  adminStore.error = ''
  adminStore.success = ''

  try {
    await workspaceTiersStore.resetGlobalDefaults()
    adminStore.success = 'Default tiers reset to original configuration.'
    setTimeout(() => {
      adminStore.success = ''
    }, 3000)
  } catch (err) {
    adminStore.error = err.message || 'Failed to reset default tiers'
  } finally {
    isResettingDefaults.value = false
  }
}

const saveAsTemplate = async () => {
  if (!templateName.value.trim()) {
    adminStore.error = 'Template name is required'
    return
  }

  isSavingTemplate.value = true
  adminStore.error = ''
  adminStore.success = ''

  try {
    await workspaceTiersStore.saveAsTemplate(templateName.value.trim())
    adminStore.success = `Template "${templateName.value.trim()}" saved successfully!`
    templateName.value = ''
    setTimeout(() => {
      adminStore.success = ''
    }, 3000)
  } catch (err) {
    adminStore.error = err.message || 'Failed to save template'
  } finally {
    isSavingTemplate.value = false
  }
}

const loadTemplate = async (templateId) => {
  isLoadingTemplate.value = true
  adminStore.error = ''
  adminStore.success = ''

  try {
    const success = await workspaceTiersStore.loadTemplate(templateId)
    if (success) {
      adminStore.success = 'Template loaded successfully!'
      setTimeout(() => {
        adminStore.success = ''
      }, 3000)
    } else {
      adminStore.error = 'Failed to load template'
    }
  } catch (err) {
    adminStore.error = err.message || 'Failed to load template'
  } finally {
    isLoadingTemplate.value = false
  }
}

const deleteTemplate = async (templateId, templateName) => {
  if (!confirm(`Are you sure you want to delete the template "${templateName}"?`)) {
    return
  }

  adminStore.error = ''
  adminStore.success = ''

  try {
    await workspaceTiersStore.deleteTemplate(templateId)
    adminStore.success = `Template "${templateName}" deleted successfully!`
    setTimeout(() => {
      adminStore.success = ''
    }, 3000)
  } catch (err) {
    adminStore.error = err.message || 'Failed to delete template'
  }
}

// Template name editing functions
const startEditTemplateName = (template) => {
  editingTemplateId.value = template.id
  editingTemplateName.value = template.name
}

const saveTemplateName = async (templateId) => {
  if (!editingTemplateName.value.trim()) {
    adminStore.error = 'Template name cannot be empty'
    return
  }

  try {
    // Update the template name in Firestore
    const { updateTierTemplateInFirestore } = await import('@/services/firebase/firestore')
    await updateTierTemplateInFirestore(templateId, editingTemplateName.value.trim(), null)
    
    // Update the local template list
    const template = workspaceTiersStore.templates.find(t => t.id === templateId)
    if (template) {
      template.name = editingTemplateName.value.trim()
    }
    
    adminStore.success = 'Template name updated successfully!'
    setTimeout(() => {
      adminStore.success = ''
    }, 3000)
  } catch (err) {
    adminStore.error = err.message || 'Failed to update template name'
  } finally {
    editingTemplateId.value = null
    editingTemplateName.value = ''
  }
}

const cancelEditTemplateName = () => {
  editingTemplateId.value = null
  editingTemplateName.value = ''
}

// Calculate total champions in a template
const getTotalChampions = (template) => {
  if (!template.tiers || template.tiers.length === 0) return 0
  
  let total = 0
  template.tiers.forEach(tier => {
    if (tier.champions) {
      // champions is an object with champion names as keys and roles arrays as values
      total += Object.keys(tier.champions).length
    }
  })
  return total
}

// Open admin panel when route is /admin
watch(() => router.currentRoute.value.path, (path) => {
  if (path === '/admin' && authStore.isAdmin && authStore.isAuthenticated && !authStore.isAnonymous) {
    adminStore.open('settings')
  } else if (path !== '/admin' && adminStore.isOpen) {
    adminStore.close()
  }
}, { immediate: true })

onMounted(() => {
  if (router.currentRoute.value.path === '/admin' && authStore.isAdmin && authStore.isAuthenticated && !authStore.isAnonymous) {
    adminStore.open('settings')
    // Load settings when admin panel opens
    adminStore.loadGlobalSettings()
  }
})

</script>

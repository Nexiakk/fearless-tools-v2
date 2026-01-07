<script setup lang="ts">
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

interface Props {
  isSyncing?: boolean
  lastSyncTime?: Date | null
  activeUsers?: number
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  isSyncing: false,
  lastSyncTime: null,
  activeUsers: 0,
})
</script>

<template>
  <div :class="cn('flex items-center gap-2', props.class)">
    <!-- Syncing State -->
    <div
      v-if="isSyncing"
      class="flex items-center gap-1 text-xs text-amber-400"
      title="Syncing..."
    >
      <Spinner />
      <span>Syncing</span>
    </div>

    <!-- Success State -->
    <div
      v-else-if="lastSyncTime"
      class="text-xs text-green-400"
      :title="'Last synced: ' + lastSyncTime.toLocaleTimeString('en-US')"
    >
      <svg
        class="h-4 w-4 inline"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fill-rule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clip-rule="evenodd"
        />
      </svg>
    </div>

    <!-- Active Users Count -->
    <div
      v-if="activeUsers > 1"
      class="text-xs text-blue-400"
      :title="activeUsers + ' active users'"
    >
      <span>{{ activeUsers }}</span> active
    </div>
  </div>
</template>

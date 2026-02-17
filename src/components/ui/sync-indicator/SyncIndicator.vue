<script setup lang="ts">
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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

const formatLastSyncTime = (date: Date): string => {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  })
}
</script>

<template>
  <TooltipProvider>
    <div :class="cn('flex items-center gap-2', props.class)">
      <!-- Syncing State -->
      <Tooltip v-if="isSyncing">
        <TooltipTrigger as-child>
          <div
            class="flex items-center gap-1.5 text-xs text-yellow-500"
          >
            <Spinner class="text-yellow-500" />
            <span>Syncing</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Syncing data with the server...</p>
        </TooltipContent>
      </Tooltip>

      <!-- Success State -->
      <Tooltip v-else-if="lastSyncTime">
        <TooltipTrigger as-child>
          <div class="text-green-500">
            <svg
              class="h-4 w-4"
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
        </TooltipTrigger>
        <TooltipContent>
          <p>Last synced: {{ formatLastSyncTime(lastSyncTime) }}</p>
        </TooltipContent>
      </Tooltip>

      <!-- Active Users Count -->
      <Tooltip v-if="activeUsers > 1">
        <TooltipTrigger as-child>
          <div class="text-xs text-blue-500">
            <span>{{ activeUsers }}</span> active
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{{ activeUsers }} users currently active in this workspace</p>
        </TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
</template>

<template>
  <div 
    class="bg-gray-800 rounded-lg border border-gray-700 p-2 cursor-pointer hover:bg-gray-750 transition-colors"
    @click="$emit('open-management')"
  >
    <!-- Header with Toggle -->
    <div class="mb-2 flex items-center justify-between">
      <h3 class="text-xs font-semibold text-white">Players</h3>
      <div class="flex items-center gap-1">
        <span class="text-xs text-gray-400">{{ playerCount }}/10</span>
        <button
          @click.stop="toggleDisplayMode"
          class="text-xs px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-gray-300"
          title="Toggle display mode"
        >
          {{ displayMode === 'enemy-only' ? 'Both' : 'Enemy' }}
        </button>
      </div>
    </div>

    <!-- Enemy Team Only View -->
    <div v-if="displayMode === 'enemy-only'" class="space-y-0.5">
      <div class="text-xs font-medium text-gray-400 mb-1">
        {{ scoutingStore.enemyTeamName }}
      </div>
      <div 
        v-for="role in roles" 
        :key="role"
        class="flex items-center justify-between text-xs py-0.5"
      >
        <span class="text-gray-500 w-14 text-xs">{{ role }}:</span>
        <span v-if="getPlayerForRole('enemy', role)" class="text-white flex-1 text-right text-xs truncate">
          {{ getPlayerForRole('enemy', role).name }}
        </span>
        <span v-else class="text-gray-600 flex-1 text-right text-xs">—</span>
      </div>
    </div>

    <!-- Both Teams View -->
    <div v-else class="grid grid-cols-2 gap-2">
      <!-- Own Team -->
      <div class="space-y-0.5">
        <div class="text-xs font-medium text-gray-400 mb-1">
          {{ scoutingStore.ownTeamName }}
        </div>
        <div 
          v-for="role in roles" 
          :key="`own-${role}`"
          class="flex items-center justify-between text-xs py-0.5"
        >
          <span class="text-gray-500 w-10 text-xs">{{ role }}:</span>
          <span v-if="getPlayerForRole('own', role)" class="text-white text-right truncate text-xs">
            {{ getPlayerForRole('own', role).name }}
          </span>
          <span v-else class="text-gray-600 text-right text-xs">—</span>
        </div>
      </div>

      <!-- Enemy Team -->
      <div class="space-y-0.5">
        <div class="text-xs font-medium text-gray-400 mb-1">
          {{ scoutingStore.enemyTeamName }}
        </div>
        <div 
          v-for="role in roles" 
          :key="`enemy-${role}`"
          class="flex items-center justify-between text-xs py-0.5"
        >
          <span class="text-gray-500 w-10 text-xs">{{ role }}:</span>
          <span v-if="getPlayerForRole('enemy', role)" class="text-white text-right truncate text-xs">
            {{ getPlayerForRole('enemy', role).name }}
          </span>
          <span v-else class="text-gray-600 text-right text-xs">—</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useScoutingStore } from '@/stores/scouting'

const emit = defineEmits(['open-management'])

const scoutingStore = useScoutingStore()
const displayMode = ref('enemy-only') // 'enemy-only' | 'both-teams'

const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']

const playerCount = computed(() => {
  return scoutingStore.players.length
})

const getPlayerForRole = (team, role) => {
  return scoutingStore.getPlayerByTeamAndRole(team, role)
}

const toggleDisplayMode = () => {
  displayMode.value = displayMode.value === 'enemy-only' ? 'both-teams' : 'enemy-only'
}
</script>

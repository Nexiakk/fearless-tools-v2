<template>
  <div 
    class="bg-gray-800 rounded-lg border border-gray-700 p-4 cursor-pointer hover:bg-gray-750 transition-colors"
    @click="$emit('open-management')"
  >
    <!-- Header with Toggle -->
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-white">Players</h3>
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-400">{{ playerCount }}/10</span>
        <button
          @click.stop="toggleDisplayMode"
          class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-gray-300"
          title="Toggle display mode"
        >
          {{ displayMode === 'enemy-only' ? 'Both' : 'Enemy' }}
        </button>
      </div>
    </div>

    <!-- Enemy Team Only View -->
    <div v-if="displayMode === 'enemy-only'" class="space-y-2">
      <div class="text-xs font-medium text-gray-400 mb-2">
        {{ scoutingStore.enemyTeamName }}
      </div>
      <div 
        v-for="role in roles" 
        :key="role"
        class="flex items-center justify-between text-xs py-1"
      >
        <span class="text-gray-500 w-16">{{ role }}:</span>
        <span v-if="getPlayerForRole('enemy', role)" class="text-white flex-1 text-right">
          {{ getPlayerForRole('enemy', role).name }}
        </span>
        <span v-else class="text-gray-600 flex-1 text-right">—</span>
      </div>
    </div>

    <!-- Both Teams View -->
    <div v-else class="grid grid-cols-2 gap-4">
      <!-- Own Team -->
      <div class="space-y-2">
        <div class="text-xs font-medium text-gray-400 mb-2">
          {{ scoutingStore.ownTeamName }}
        </div>
        <div 
          v-for="role in roles" 
          :key="`own-${role}`"
          class="flex items-center justify-between text-xs py-1"
        >
          <span class="text-gray-500 w-12">{{ role }}:</span>
          <span v-if="getPlayerForRole('own', role)" class="text-white text-right truncate ml-1">
            {{ getPlayerForRole('own', role).name }}
          </span>
          <span v-else class="text-gray-600 text-right">—</span>
        </div>
      </div>

      <!-- Enemy Team -->
      <div class="space-y-2">
        <div class="text-xs font-medium text-gray-400 mb-2">
          {{ scoutingStore.enemyTeamName }}
        </div>
        <div 
          v-for="role in roles" 
          :key="`enemy-${role}`"
          class="flex items-center justify-between text-xs py-1"
        >
          <span class="text-gray-500 w-12">{{ role }}:</span>
          <span v-if="getPlayerForRole('enemy', role)" class="text-white text-right truncate ml-1">
            {{ getPlayerForRole('enemy', role).name }}
          </span>
          <span v-else class="text-gray-600 text-right">—</span>
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

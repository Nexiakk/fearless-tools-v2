<template>
  <div class="w-full h-full flex flex-col">
    <!-- Team Selector -->
    <div class="mb-4 flex items-center justify-center gap-4 flex-shrink-0">
      <button
        @click="selectedTeam = 'own'"
        :class="[
          'px-4 py-2 rounded transition-colors',
          selectedTeam === 'own'
            ? 'bg-amber-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        ]"
      >
        {{ scoutingStore.ownTeamName }}
      </button>
      <button
        @click="selectedTeam = 'enemy'"
        :class="[
          'px-4 py-2 rounded transition-colors',
          selectedTeam === 'enemy'
            ? 'bg-amber-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        ]"
      >
        {{ scoutingStore.enemyTeamName }}
      </button>
    </div>

    <!-- Player Cards Grid -->
    <div class="grid grid-cols-5 gap-4 w-full flex-1 min-h-0">
      <PlayerCard
        v-for="role in roles"
        :key="role"
        :role="role"
        :selected-team="selectedTeam"
        @open-detail="handleOpenDetail"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useScoutingStore } from '@/stores/scouting'
import PlayerCard from './PlayerCard.vue'

const scoutingStore = useScoutingStore()

const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']
const selectedTeam = ref('enemy') // Default to enemy team

const handleOpenDetail = (playerId) => {
  scoutingStore.setSelectedPlayer(playerId)
}
</script>

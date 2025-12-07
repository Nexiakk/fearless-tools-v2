<template>
  <div class="w-full h-full flex flex-col">
    <!-- Player Cards Grid -->
    <div class="grid grid-cols-5 gap-4 w-full flex-1 min-h-0">
      <PlayerCard
        v-for="role in roles"
        :key="role"
        :role="role"
        @open-detail="handleOpenDetail"
      />
    </div>
  </div>
</template>

<script setup>
import { useScoutingStore } from '@/stores/scouting'
import PlayerCard from './PlayerCard.vue'

const scoutingStore = useScoutingStore()

const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']

const handleOpenDetail = (playerId) => {
  scoutingStore.setSelectedPlayer(playerId)
}
</script>

<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <!-- Player Cards Grid -->
    <div class="grid grid-cols-5 grid-rows-1 gap-4 w-full h-full min-h-0">
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

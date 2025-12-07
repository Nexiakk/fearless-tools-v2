<template>
  <div class="scouting-nav-expanded">
    <div class="scouting-nav-wrapper">
      <nav class="scouting-nav-buttons">
        <button
          @click="$emit('view-change', 'summary')"
          :class="['scouting-nav-button', { active: currentView === 'summary' }]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="scouting-nav-icon" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
            <path d="M12 7v5l4 2"></path>
          </svg>
          <span>Summary</span>
        </button>
        <div class="scouting-nav-separator">|</div>
        <button
          @click="$emit('view-change', 'manage-players')"
          :class="['scouting-nav-button', { active: currentView === 'manage-players' }]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="scouting-nav-icon" aria-hidden="true">
            <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Manage Players</span>
        </button>
      </nav>
      
      <!-- Team Selector (Right Side) -->
      <div class="scouting-nav-team-selector">
        <select
          :value="scoutingStore.selectedTeamId || ''"
          @change="handleTeamChange"
          class="scouting-nav-team-select"
          :disabled="scoutingStore.teams.length === 0"
        >
          <option :value="null" disabled>
            {{ scoutingStore.teams.length === 0 ? 'No Teams Created' : 'Select team' }}
          </option>
          <option
            v-for="team in scoutingStore.teams"
            :key="team.id"
            :value="team.id"
          >
            {{ team.name }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useScoutingStore } from '@/stores/scouting'

defineProps({
  currentView: {
    type: String,
    required: true,
    validator: (value) => ['summary', 'manage-players'].includes(value)
  }
})

defineEmits(['view-change'])

const scoutingStore = useScoutingStore()

const handleTeamChange = (event) => {
  const teamId = event.target.value || null
  scoutingStore.setSelectedTeamId(teamId)
}
</script>

<style scoped>
.scouting-nav-expanded {
  position: fixed;
  top: 40px; /* Navbar height */
  left: 0;
  right: 0;
  z-index: 99; /* Below navbar (100) but above content */
  width: 100%;
}

.scouting-nav-wrapper {
  width: 100%;
  background-color: #1a1a1a; /* Match navbar background for seamless connection */
  padding: 4px 0; /* py-1 equivalent */
  border-radius: 0 0 2rem 2rem; /* rounded-b-4xl - large border radius for visible effect */
  height: 40px; /* Explicit height for layout calculations */
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.scouting-nav-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 16px;
  width: 100%;
}

.scouting-nav-team-selector {
  position: absolute;
  right: 16px;
  display: flex;
  align-items: center;
}

.scouting-nav-team-select {
  background-color: #374151;
  border: 1px solid #4b5563;
  border-radius: 4px;
  color: #ffffff;
  font-size: 0.875rem;
  padding: 4px 8px;
  min-width: 150px;
  cursor: pointer;
  transition: border-color 0.15s ease-in-out, background-color 0.15s ease-in-out;
}

.scouting-nav-team-select:hover:not(:disabled) {
  border-color: #6b7280;
  background-color: #4b5563;
}

.scouting-nav-team-select:focus {
  outline: none;
  border-color: #fb923c;
}

.scouting-nav-team-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.scouting-nav-button {
  background-color: transparent;
  border: none;
  color: #a0a0a0; /* text-gray-400 */
  font-size: 0.875rem; /* text-sm */
  font-weight: 500; /* font-medium */
  padding: 6px 10px;
  cursor: pointer;
  transition: color 0.15s ease-in-out;
  position: relative;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 8px;
}

.scouting-nav-icon {
  flex-shrink: 0;
  transition: color 0.15s ease-in-out;
  width: 16px;
  height: 16px;
  color: #9ca3af; /* gray-400 - default icon color */
}

.scouting-nav-separator {
  color: #4b5563; /* text-gray-600 */
  font-size: 0.875rem;
  padding: 0 8px;
  user-select: none;
}

.scouting-nav-button:hover {
  color: #ffffff;
}

.scouting-nav-button:hover .scouting-nav-icon {
  color: #fb923c; /* orange-400 on hover */
}

.scouting-nav-button.active {
  color: #ffffff;
}

.scouting-nav-button.active .scouting-nav-icon {
  color: #fb923c; /* orange-400 when active */
}

/* Underline effect for active button */
.scouting-nav-button::after {
  content: "";
  position: absolute;
  bottom: -6px; /* Increased distance from button text */
  left: 50%;
  transform: translateX(-50%);
  height: 3px;
  background-color: #ea580c; /* orange-600 - orange shade related to main theme */
  border-radius: 3px 3px 0 0;
  transition: width 0.3s ease-in-out;
  width: 0; /* Default state: hidden */
}

.scouting-nav-button.active::after {
  width: 33%; /* Smaller width - reduced from 50% */
}
</style>

<template>
  <div
    class="draft-creator-slot"
    :class="slotClasses"
    @click="handleClick"
    @contextmenu.prevent="handleClear"
    :title="slotTitle"
  >
    <img
      v-if="champion"
      :src="championIconUrl"
      :alt="champion"
      draggable="false"
      @error="handleImageError"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useChampionsStore } from '@/stores/champions'

const props = defineProps({
  side: {
    type: String,
    required: true,
    validator: (value) => ['blue', 'red'].includes(value)
  },
  type: {
    type: String,
    required: true,
    validator: (value) => ['picks', 'bans'].includes(value)
  },
  index: {
    type: Number,
    required: true
  },
  champion: {
    type: String,
    default: null
  },
  // Selection states
  selectedForMove: {
    type: Boolean,
    default: false
  },
  selectedForTargeting: {
    type: Boolean,
    default: false
  },
  // Context for icon URL
  iconContext: {
    type: String,
    default: 'pick'
  }
})

const emit = defineEmits(['click', 'clear'])

const championsStore = useChampionsStore()

const slotClasses = computed(() => {
  const classes = [`${props.type.slice(0, -1)}-slot`]

  if (props.champion) {
    classes.push('filled')
  }

  if (props.selectedForMove) {
    classes.push('selected-for-move')
  }

  if (props.selectedForTargeting) {
    classes.push('selected-for-targeting')
  }

  return classes
})

const slotTitle = computed(() => {
  const slotLabel = `${props.side.charAt(0).toUpperCase()}${props.type.charAt(0).toUpperCase()}${props.index + 1}`
  return `Click to place/move/target, Right-click to clear (${slotLabel})`
})

const championIconUrl = computed(() => {
  if (!props.champion) return ''
  return championsStore.getChampionIconUrl(props.champion, props.iconContext)
})

const handleClick = () => {
  emit('click', {
    side: props.side,
    type: props.type,
    index: props.index
  })
}

const handleClear = () => {
  emit('clear', {
    side: props.side,
    type: props.type,
    index: props.index
  })
}

const handleImageError = (e) => {
  e.target.style.opacity = '0.5'
}
</script>

<style>
.draft-creator-slot {
  border: 1px solid #444444;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  transition: background-image 0.2s;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  flex-shrink: 0;
}

.draft-creator-slot:not(.filled):hover {
  border-color: #666666;
}

.draft-creator-slot.filled {
  border-width: 1px;
  border-style: solid;
  background-image: none !important;
  background-color: #1e1e1e;
}

/* Selection Styling */
.draft-creator-slot.selected-for-move,
.draft-creator-slot.selected-for-targeting {
  box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.6);
  border-color: #d97706 !important;
}

.draft-creator-slot.selected-for-targeting {
  background-color: #444444;
}

/* Ban Slot Specifics */
.draft-creator-slot.ban-slot {
  width: 70px;
  height: 70px;
  background-color: #000000;
  border-color: #3a3a3a;
}

.draft-creator-slot.ban-slot:not(.filled):not(.selected-for-targeting):hover {
  background-color: #000000;
  border-color: #444444;
}

.draft-creator-slot.ban-slot.filled {
  border-color: #3a3a3a !important;
  box-shadow: none !important;
  filter: grayscale(50%);
}

.draft-creator-slot.ban-slot.filled.selected-for-move {
  box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.6) !important;
  filter: grayscale(0%) !important;
}

.draft-creator-slot.ban-slot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(90%);
}

/* Pick Slot Specifics */
.draft-creator-slot.pick-slot {
  width: 110px;
  height: 110px;
  background-image: url("../../assets/icons/no_champion.png");
  background-color: #000000;
  border-color: #444444;
}

.draft-creator-slot.pick-slot:not(.filled):not(.selected-for-targeting):hover {
  border-color: #666666;
  background-color: #000000;
}

.draft-creator-slot.pick-slot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>

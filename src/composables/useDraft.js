// Draft Composable
import { computed } from 'vue'
import { useDraftStore } from '@/stores/draft'

export function useDraft() {
  const store = useDraftStore()

  return {
    // State
    draftSeries: computed(() => store.draftSeries),
    highlightedChampions: computed(() => store.highlightedChampions),
    unavailablePanelState: computed(() => store.unavailablePanelState),
    pickContext: computed(() => store.pickContext),
    unavailableChampions: computed(() => store.unavailableChampions),
    championsByRoleForCompactView: computed(() => store.championsByRoleForCompactView),
    // Actions
    togglePick: store.togglePick,
    toggleHighlight: store.toggleHighlight,
    isUnavailable: store.isUnavailable,
    isHighlighted: store.isHighlighted,
    resetHighlighted: store.resetHighlighted,
    resetUnavailable: store.resetUnavailable
  }
}


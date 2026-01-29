// Draft Composable
import { computed } from "vue";
import { useDraftStore } from "@/stores/draft";

export function useDraft() {
  const store = useDraftStore();

  return {
    // State
    draftSeries: computed(() => store.draftSeries),
    unavailablePanelState: computed(() => store.unavailablePanelState),
    pickContext: computed(() => store.pickContext),
    unavailableChampions: computed(() => store.unavailableChampions),
    championsByRoleForCompactView: computed(
      () => store.championsByRoleForCompactView,
    ),
    // Actions
    togglePick: store.togglePick,
    isUnavailable: store.isUnavailable,
    resetUnavailable: store.resetUnavailable,
    resetBans: store.resetBans,
  };
}

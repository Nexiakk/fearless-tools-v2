import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  fetchDraftDataFromFirestore,
  saveDraftDataToFirestore,
  fetchLcuDraftsFromFirestore,
  setupLcuDraftsRealtimeSync,
  deleteAllLcuDrafts,
} from "@/services/firebase/firestore";
import { workspaceService } from "@/services/workspace";
import { useWorkspaceStore } from "./workspace";
import { useChampionsStore } from "./champions";

export const useDraftStore = defineStore("draft", () => {
  // State - NEW STRUCTURE
  const pickedChampions = ref([]); // renamed from draftSeries
  const bannedChampions = ref(new Set()); // Manually banned champions (kept for quick lookup)
  const eventContext = ref([]); // NEW: Combined pick/ban events with timestamps
  const lcuUnavailableChampions = ref(new Set()); // Champions from LCU drafts (non-toggleable)
  const lcuBannedChampions = ref(new Set()); // Banned champions from LCU drafts - latest game only
  const lcuDraftsRaw = ref([]); // Raw LCU drafts with timestamps for event history
  let saveTimeout = null;
  let isSaving = ref(false);
  const isLoading = ref(false);
  let lcuDraftsUnsubscribe = null;

  // Getters
  const unavailableChampions = computed(() => {
    const championsStore = useChampionsStore();

    // Combine manually picked and LCU unavailable champions
    const combined = new Set(pickedChampions.value);

    // Convert LCU unavailable champions (internal IDs) to display names
    lcuUnavailableChampions.value.forEach((internalId) => {
      const champion = championsStore.allChampions.find(
        (c) => c.id === internalId,
      );
      if (champion) {
        combined.add(champion.name);
      }
    });

    return combined;
  });

  // Group champions by role for compact view (used by ChampionPoolView)
  const championsByRoleForCompactView = computed(() => {
    const championsStore = useChampionsStore();
    
    if (!championsStore.allChampions || championsStore.allChampions.length === 0) {
      return {
        top: [],
        jungle: [],
        middle: [],
        bottom: [],
        support: []
      };
    }

    const grouped = {
      top: [],
      jungle: [],
      middle: [],
      bottom: [],
      support: [],
    };

    championsStore.allChampions.forEach((champ) => {
      if (Array.isArray(champ.roles)) {
        champ.roles.forEach((role) => {
          if (grouped[role]) {
            grouped[role].push(champ);
          }
        });
      }
    });

    // Sort by priority (banned/unavailable > alphabetical)
    Object.keys(grouped).forEach((role) => {
      grouped[role].sort((a, b) => {
        const aBanned = isBannedChampion(a.name) || unavailableChampions.value.has(a.name);
        const bBanned = isBannedChampion(b.name) || unavailableChampions.value.has(b.name);
        
        if (aBanned && !bBanned) return -1;
        if (!aBanned && bBanned) return 1;
        
        return (a.name || '').localeCompare(b.name || '');
      });
    });

    return grouped;
  });

  // Helper function to validate champion names exist in the champion store
  function validateChampionNames(championNames, championsStore) {
    const validNames = new Set();
    championNames.forEach((name) => {
      if (name && name !== "0" && typeof name === "string") {
        const champion = championsStore.allChampions.find((c) => c.id === name);
        if (champion) {
          validNames.add(name);
        }
      }
    });
    return validNames;
  }

  // Extract picked champions from LCU drafts
  function extractLcuUnavailableChampions(lcuDrafts, championsStore) {
    const pickedChampionNames = new Set();

    lcuDrafts.forEach((draft) => {
      const bluePicks = draft.blueSide?.picks || [];
      const redPicks = draft.redSide?.picks || [];

      bluePicks.forEach((name) => {
        if (name && name !== "0" && typeof name === "string") {
          pickedChampionNames.add(name);
        }
      });

      redPicks.forEach((name) => {
        if (name && name !== "0" && typeof name === "string") {
          pickedChampionNames.add(name);
        }
      });
    });

    return validateChampionNames(pickedChampionNames, championsStore);
  }

  // Extract banned champions from the latest LCU draft only
  function extractLcuBannedChampions(lcuDrafts, championsStore) {
    if (!lcuDrafts || lcuDrafts.length === 0) {
      return new Set();
    }

    let latestDraft = null;
    let maxNumber = -1;

    lcuDrafts.forEach((draft) => {
      if (draft.id) {
        const parts = draft.id.split("_");
        if (parts.length >= 2) {
          const number = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(number) && number > maxNumber) {
            maxNumber = number;
            latestDraft = draft;
          }
        }
      }
    });

    if (!latestDraft && lcuDrafts.length > 0) {
      latestDraft = lcuDrafts[0];
    }

    if (!latestDraft) {
      return new Set();
    }

    const bluePicks = latestDraft.blueSide?.picks || [];
    const redPicks = latestDraft.redSide?.picks || [];
    const totalPicks =
      bluePicks.filter((id) => id && id !== "0").length +
      redPicks.filter((id) => id && id !== "0").length;

    if (totalPicks >= 10) {
      return new Set();
    }

    const bannedChampionNames = new Set();
    const blueBans = latestDraft.blueSide?.bans || [];
    const redBans = latestDraft.redSide?.bans || [];

    blueBans.forEach((name) => {
      if (name && name !== "0" && typeof name === "string") {
        bannedChampionNames.add(name);
      }
    });

    redBans.forEach((name) => {
      if (name && name !== "0" && typeof name === "string") {
        bannedChampionNames.add(name);
      }
    });

    return validateChampionNames(bannedChampionNames, championsStore);
  }

  // Update LCU unavailable champions from drafts
  function updateLcuUnavailableChampions(lcuDrafts, championsStore) {
    lcuDraftsRaw.value = lcuDrafts || [];
    lcuUnavailableChampions.value = extractLcuUnavailableChampions(
      lcuDrafts,
      championsStore,
    );
    lcuBannedChampions.value = extractLcuBannedChampions(
      lcuDrafts,
      championsStore,
    );
  }

  // Actions
  function isUnavailable(championName) {
    return unavailableChampions.value.has(championName);
  }

  function isLcuUnavailable(championName) {
    const championsStore = useChampionsStore();
    const champion = championsStore.allChampions.find(
      (c) => c.name === championName,
    );
    return champion && lcuUnavailableChampions.value.has(champion.id);
  }

  function isBannedChampion(championName) {
    if (bannedChampions.value.has(championName)) {
      return true;
    }

    const championsStore = useChampionsStore();
    const champion = championsStore.allChampions.find(
      (c) => c.name === championName,
    );
    if (champion && lcuBannedChampions.value.has(champion.id)) {
      return true;
    }

    return false;
  }

  function isLcuBanned(championName) {
    const championsStore = useChampionsStore();
    const champion = championsStore.allChampions.find(
      (c) => c.name === championName,
    );
    return champion && lcuBannedChampions.value.has(champion.id);
  }

  function toggleBan(championName) {
    if (isLcuBanned(championName)) {
      return;
    }

    if (bannedChampions.value.has(championName)) {
      // Removing ban
      bannedChampions.value.delete(championName);
      // Remove from eventContext
      eventContext.value = eventContext.value.filter(
        (e) => !(e.championId === championName && e.eventType === "BAN")
      );
    } else {
      // Adding ban
      bannedChampions.value.add(championName);
      // Add to eventContext with timestamp
      eventContext.value.push({
        championId: championName,
        eventType: "BAN",
        eventOrder: 0,
        timestamp: new Date(),
      });
    }

    queueSave();
  }

  function togglePick(championName) {
    if (isLcuUnavailable(championName) || isBannedChampion(championName)) {
      return;
    }

    const index = pickedChampions.value.indexOf(championName);

    if (index === -1) {
      // Adding champion
      pickedChampions.value.push(championName);

      // Add to eventContext with timestamp
      const pickCount = eventContext.value.filter(e => e.eventType === "PICK").length;
      eventContext.value.push({
        championId: championName,
        eventType: "PICK",
        eventOrder: pickCount + 1,
        timestamp: new Date(),
      });
    } else {
      // Removing champion
      pickedChampions.value.splice(index, 1);
      // Remove from eventContext
      eventContext.value = eventContext.value.filter(
        (e) => !(e.championId === championName && e.eventType === "PICK")
      );
    }

    queueSave();
  }

  async function resetUnavailable() {
    pickedChampions.value = [];
    bannedChampions.value = new Set();
    eventContext.value = [];

    const workspaceStore = useWorkspaceStore();
    if (workspaceStore.currentWorkspaceId && !workspaceStore.isLocalWorkspace) {
      try {
        await deleteAllLcuDrafts(workspaceStore.currentWorkspaceId);
        lcuUnavailableChampions.value = new Set();
        lcuBannedChampions.value = new Set();
        lcuDraftsRaw.value = [];
      } catch (error) {
        console.error("Error deleting LCU drafts:", error);
      }
    } else {
      lcuUnavailableChampions.value = new Set();
      lcuBannedChampions.value = new Set();
      lcuDraftsRaw.value = [];
    }

    queueSave();
  }

  async function resetBans() {
    bannedChampions.value = new Set();
    // Remove ban events from eventContext
    eventContext.value = eventContext.value.filter((e) => e.eventType !== "BAN");

    queueSave();
  }

  function queueSave() {
    const workspaceStore = useWorkspaceStore();
    if (!workspaceStore.currentWorkspaceId) {
      console.warn("Cannot save: No workspace selected");
      return;
    }

    workspaceStore.setSyncing(true);
    isSaving.value = true;

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        const dataToSave = {
          pickedChampions: pickedChampions.value,
          bannedChampions: Array.from(bannedChampions.value),
          eventContext: eventContext.value,
        };

        if (workspaceStore.isLocalWorkspace) {
          workspaceService.saveLocalWorkspaceData(
            workspaceStore.currentWorkspaceId,
            dataToSave,
          );
          console.log("Saved local workspace data to localStorage");
        } else {
          await saveDraftDataToFirestore(workspaceStore.currentWorkspaceId, dataToSave);
        }
        
        workspaceStore.setSyncing(false);
        isSaving.value = false;
      } catch (error) {
        console.error("Error saving draft data:", error);
        workspaceStore.setSyncing(false);
        isSaving.value = false;
        workspaceStore.networkError = error.message;
      } finally {
        saveTimeout = null;
      }
    }, 3000);
  }

  async function loadWorkspaceData(workspaceId) {
    isLoading.value = true;
    try {
      const data = await fetchDraftDataFromFirestore(workspaceId);
      if (data) {
        pickedChampions.value = data.pickedChampions || [];
        bannedChampions.value = new Set(data.bannedChampions || []);
        eventContext.value = data.eventContext || [];
      }

      await loadLcuDrafts(workspaceId);
    } catch (error) {
      console.error("Error loading workspace data:", error);
    } finally {
      isLoading.value = false;
    }
  }

  async function loadLcuDrafts(workspaceId) {
    try {
      const championsStore = useChampionsStore();
      const lcuDrafts = await fetchLcuDraftsFromFirestore(workspaceId);
      updateLcuUnavailableChampions(lcuDrafts, championsStore);

      if (lcuDraftsUnsubscribe) {
        lcuDraftsUnsubscribe();
      }

      lcuDraftsUnsubscribe = setupLcuDraftsRealtimeSync(
        workspaceId,
        (updatedDrafts) => {
          updateLcuUnavailableChampions(updatedDrafts, championsStore);
        },
      );
    } catch (error) {
      console.error("Error loading LCU drafts:", error);
    }
  }

  function loadDraftData(data) {
    isLoading.value = true;
    try {
      pickedChampions.value = data.pickedChampions || [];
      bannedChampions.value = new Set(data.bannedChampions || []);
      eventContext.value = data.eventContext || [];
    } finally {
      isLoading.value = false;
    }
  }

  return {
    // State
    pickedChampions,
    bannedChampions,
    eventContext,
    lcuUnavailableChampions,
    lcuBannedChampions,
    lcuDraftsRaw,
    isSaving,
    isLoading,
    // Getters
    unavailableChampions,
    championsByRoleForCompactView,
    // Actions
    togglePick,
    toggleBan,
    isUnavailable,
    isLcuUnavailable,
    isBannedChampion,
    isLcuBanned,
    resetUnavailable,
    resetBans,
    loadWorkspaceData,
    loadDraftData,
    loadLcuDrafts,
    // Internal state
    get _saveTimeout() {
      return saveTimeout;
    },
    get _isSaving() {
      return isSaving.value;
    },
    queueSave,
  };
});

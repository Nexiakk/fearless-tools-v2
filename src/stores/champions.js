import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  fetchChampionsFromIndividualDocs,
} from "@/services/firebase/championData";
import { riotApiService } from "@/services/riotApi";

export const useChampionsStore = defineStore("champions", () => {
  // State
  const allChampions = ref([]);
  const opTierChampions = ref({});
  const isLoading = ref(false);
  const patchVersion = ref(localStorage.getItem('fearless_patch_version') || "16.1.1");
  
  // Private state for concurrency control
  let loadingPromise = null;
  let lastLoadTime = null;
  const MIN_RELOAD_INTERVAL = 5000; // 5 seconds minimum between reloads

  // Getters
  const championsByRole = computed(() => {
    const grouped = {
      top: [],
      jungle: [],
      middle: [],
      bottom: [],
      support: [],
    };

    allChampions.value.forEach((champ) => {
      if (Array.isArray(champ.roles)) {
        champ.roles.forEach((role) => {
          if (grouped[role]) {
            grouped[role].push(champ);
          }
        });
      }
    });

    return grouped;
  });

  // Actions
  async function loadChampions(forceReload = false) {
    // Check if data is already loaded and not forcing reload
    if (!forceReload && allChampions.value.length > 0) {
      const timeSinceLastLoad = lastLoadTime ? Date.now() - lastLoadTime : Infinity;
      if (timeSinceLastLoad < MIN_RELOAD_INTERVAL) {
        console.log(`⏩ Skipping champion load - data already loaded (${allChampions.value.length} champions, ${Math.round(timeSinceLastLoad / 1000)}s ago)`);
        return;
      }
    }
    
    // Check if loading is already in progress
    if (loadingPromise) {
      console.log("⏳ Champion load already in progress, waiting...");
      return loadingPromise;
    }
    
    // Create new loading promise
    loadingPromise = (async () => {
      isLoading.value = true;
      try {
        console.log("=== LOADING CHAMPION DATA ===");

        // Use the existing function that properly handles the new data structure
        const result = await fetchChampionsFromIndividualDocs();

        // Set the champions data
        allChampions.value = result.allChampions || [];
        opTierChampions.value = result.opTierChampions || {};
        lastLoadTime = Date.now();

        console.log(
          `✅ Successfully loaded ${allChampions.value.length} champions`
        );
      } catch (error) {
        console.error("=== ERROR loading champion data ===", error);
        allChampions.value = [];
        opTierChampions.value = {};
      } finally {
        isLoading.value = false;
        loadingPromise = null;
      }
    })();
    
    return loadingPromise;
  }

  function setChampions(champions) {
    allChampions.value = champions;
  }

  function setOpTierChampions(opTier) {
    opTierChampions.value = opTier;
  }

  function setLoading(value) {
    isLoading.value = value;
  }

  async function initializePatchVersion() {
    try {
      const version = await riotApiService.getLatestPatchVersionWithRetry();
      if (version) {
        // Check if patch version changed
        const previousVersion = patchVersion.value;
        patchVersion.value = version;
        
        // Persist to localStorage
        localStorage.setItem('fearless_patch_version', version);

        if (previousVersion !== version) {
          console.log(
            `Patch version changed from ${previousVersion} to ${version}`
          );
          // Clear Riot API cache when patch changes (clearCache already logs)
          riotApiService.clearCache();
        } else {
          console.log(`Patch version loaded: ${version} (unchanged)`);
        }
      }
    } catch (error) {
      console.error("Error loading patch version:", error);
      // Keep existing (possibly cached) patch version
    }
  }

  function setPatchVersion(version) {
    patchVersion.value = version;
  }

  function getChampionIconUrl(championName, context = "creator-pool") {
    const champ = allChampions.value.find(
      (c) => c.name?.toLowerCase() === championName?.toLowerCase()
    );
    if (!champ?.imageName) return getPlaceholderUrl(context);
    return `https://ddragon.leagueoflegends.com/cdn/${patchVersion.value}/img/champion/${champ.imageName}.png`;
  }

  function getRoleIconSvg(role) {
    const svgs = {
      top: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-[14px] h-[14px] text-black-300"><g transform="translate(2, 2)"><path opacity="0.2" d="M4.20711 19C3.76165 19 3.53857 18.4614 3.85355 18.1464L6.85355 15.1464C6.94732 15.0527 7.0745 15 7.20711 15H14.5C14.7761 15 15 14.7761 15 14.5V7.20711C15 7.0745 15.0527 6.94732 15.1464 6.85355L18.1464 3.85355C18.4614 3.53857 19 3.76165 19 4.20711V18.5C19 18.7761 18.7761 19 18.5 19H4.20711Z"></path><path d="M15.7929 1C16.2383 1 16.4614 1.53857 16.1464 1.85355L13.1464 4.85355C13.0527 4.94732 12.9255 5 12.7929 5H5.5C5.22386 5 5 5.22386 5 5.5V12.7929C5 12.9255 4.94732 13.0527 4.85355 13.1464L1.85355 16.1464C1.53857 16.4614 1 16.2383 1 15.7929V1.5C1 1.22386 1.22386 1 1.5 1H15.7929Z"></path><path opacity="0.2" d="M8 8.5C8 8.22386 8.22386 8 8.5 8H11.5C11.7761 8 12 8.22386 12 8.5V11.5C12 11.7761 11.7761 12 11.5 12H8.5C8.22386 12 8 11.7761 8 11.5V8.5Z"></path></g></svg>`,
      jungle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-[14px] h-[14px] text-black-300"><g transform="translate(2, 2)"><g fill-rule="evenodd"><g fill-rule="nonzero"><g><path d="M3.14 0c1.58 1.21 5.58 5.023 6.976 9.953s0 10.047 0 10.047c-2.749-3.164-5.893-5.2-6.18-5.382l-.02-.013C3.45 11.814 1 6.79 1 6.79c3.536.867 4.93 4.279 4.93 4.279C5.558 6.698 3.14 0 3.14 0zm14.976 3.907s-1.243 2.471-1.814 4.604c-.235.878-.285 2.2-.29 3.058v.282c.003.347.01.568.01.568s-1.738 2.397-3.38 3.678c.088-1.601.062-3.435-.208-5.334.928-2.023 2.846-5.454 5.682-6.856zm-2.124-3.331s-2.325 3.052-2.836 6.029c-.11.636-.201 1.194-.284 1.695-.379.584-.73 1.166-1.05 1.733-.033-.125-.06-.25-.095-.375-.302-1.07-.704-2.095-1.16-3.08.053-.146.103-.29.17-.438 0 0 1.814-3.78 5.255-5.564z" transform="translate(-2162.000000, -761.000000) translate(2162.000000, 761.000000)"></path></g></g></g></g></svg>`,
      middle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-[14px] h-[14px] text-black-300"><g transform="translate(2, 2)"><path opacity="0.2" d="M11.7929 1C12.2383 1 12.4614 1.53857 12.1464 1.85355L9.14645 4.85355C9.05268 4.94732 8.9255 5 8.79289 5H5.5C5.22386 5 5 5.22386 5 5.5V8.79289C5 8.9255 4.94732 9.05268 4.85355 9.14645L1.85355 12.1464C1.53857 12.4614 1 11.9238 1 11.4783V1.5C1 1.22386 1.22386 1 1.5 1H11.7929Z"></path><path d="M15.8536 1.14645C15.9473 1.05268 16.0745 1 16.2071 1H18.5C18.7761 1 19 1.22386 19 1.5V3.79289C19 3.9255 18.9473 4.05268 18.8536 4.14645L4.14645 18.8536C4.05268 18.9473 3.9255 19 3.79289 19H1.5C1.22386 19 1 18.7761 1 18.5V16.2071C1 16.0745 1.05268 15.9473 1.14645 15.8536L15.8536 1.14645Z"></path><path opacity="0.2" d="M8.20711 19C7.76165 19 7.53857 18.4614 7.85355 18.1464L10.8536 15.1464C10.9473 15.0527 11.0745 15 11.2071 15H14.5C14.7761 15 15 14.7761 15 14.5V11.2071C15 11.0745 15.0527 10.9473 15.1464 10.8536L18.1464 7.85355C18.4614 7.53857 19 7.76165 19 8.20711V18.5C19 18.7761 18.7761 19 18.5 19H8.20711Z"></path></g></svg>`,
      bottom: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-[14px] h-[14px] text-black-300"><g transform="translate(2, 2)"><path opacity="0.2" d="M15.7929 1C16.2383 1 16.4614 1.53857 16.1464 1.85355L13.1464 4.85355C13.0527 4.94732 12.9255 5 12.7929 5H5.5C5.22386 5 5 5.22386 5 5.5V12.7929C5 12.9255 4.94732 13.0527 4.85355 13.1464L1.85355 16.1464C1.53857 16.4614 1 15.9238 1 15.4783V1.5C1 1.22386 1.22386 1 1.5 1H15.7929Z"></path><path d="M4.20711 19C3.76165 19 3.53857 18.4614 3.85355 18.1464L6.85355 15.1464C6.94732 15.0527 7.0745 15 7.20711 15H14.5C14.7761 15 15 14.7761 15 15.5V8.20711C15 8.0745 15.0527 7.94732 15.1464 7.85355L18.1464 4.85355C18.4614 4.53857 19 4.76165 19 5.20711V18.5C19 18.7761 18.7761 19 18.5 19H4.20711Z"></path><path opacity="0.2" d="M8 8.5C8 8.22386 8.22386 8 8.5 8H11.5C11.7761 8 12 8.22386 12 8.5V11.5C12 11.7761 11.7761 12 11.5 12H8.5C8.22386 12 8 11.7761 8 11.5V8.5Z"></path></g></svg>`,
      support: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-[14px] h-[14px] text-black-300"><g transform="translate(2, 2)"><path d="M10.4622 8.2574C10.7023 8.2574 10.9114 8.4209 10.9694 8.6538L12.5978 15.1957C12.6081 15.237 12.6133 15.2794 12.6133 15.322V15.8818C12.6133 16.0204 12.5582 16.1534 12.4601 16.2514L11.0238 17.6869C10.9258 17.7848 10.7929 17.8398 10.6543 17.8398H9.3457C9.2071 17.8398 9.0742 17.7848 8.9762 17.6868L7.53979 16.2504C7.44177 16.1524 7.38671 16.0194 7.38671 15.8808V15.3209C7.38671 15.2784 7.39191 15.236 7.40219 15.1947L9.0306 8.6538C9.0886 8.4209 9.2977 8.2574 9.5377 8.2574H10.4622ZM4.55692 4.77339C4.69554 4.77339 4.82848 4.82845 4.9265 4.92647L7.143 7.14297C7.29085 7.29082 7.33635 7.51255 7.25869 7.70668L5.93856 11.0066C5.79919 11.355 5.34903 11.4474 5.08372 11.1821L3.29732 9.3957C3.13821 9.2366 3.09879 8.9935 3.19947 8.7922L3.52419 8.1432C3.69805 7.79566 3.44535 7.38668 3.05676 7.38668H1.56906C1.39433 7.38668 1.23115 7.29936 1.13421 7.15398L0.0886899 5.586C-0.14291 5.23867 0.10607 4.77339 0.52354 4.77339H4.55692ZM19.4765 4.77339C19.8939 4.77339 20.1429 5.23867 19.9113 5.586L18.8658 7.15398C18.7688 7.29936 18.6057 7.38668 18.4309 7.38668H16.9432C16.5546 7.38668 16.3019 7.79567 16.4758 8.1432L16.8005 8.7922C16.9012 8.9935 16.8618 9.2366 16.7027 9.3957L14.9163 11.1821C14.651 11.4474 14.2008 11.355 14.0614 11.0066L12.7413 7.70668C12.6636 7.51255 12.7092 7.29082 12.857 7.14297L15.0735 4.92647C15.1715 4.82845 15.3045 4.77339 15.4431 4.77339H19.4765ZM11.5907 2.1601C11.738 2.1601 11.8785 2.22224 11.9775 2.33124L12.4774 2.88134C12.5649 2.97754 12.6133 3.10287 12.6133 3.23285V3.74436C12.6133 3.84757 12.5827 3.94846 12.5255 4.03432L11.0259 6.28323C10.929 6.42861 10.7658 6.51593 10.5911 6.51593H9.4089C9.2342 6.51593 9.071 6.42861 8.9741 6.28323L7.47452 4.03432C7.41726 3.94846 7.38671 3.84757 7.38671 3.74436V3.23285C7.38671 3.10287 7.43515 2.97754 7.52257 2.88134L8.0225 2.33124C8.1215 2.22224 8.262 2.1601 8.4093 2.1601H11.5907Z"></path></g></svg>`,
      unknown: '<div class="w-[14px] h-[14px] bg-gray-300 rounded"></div>',
    };
    return svgs[role?.toLowerCase()] || svgs.unknown;
  }

  function getRoleIconUrl(role) {
    const baseUrl = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/';
    const roleUrls = {
      top: 'icon-position-top-blue-hover.png',
      jungle: 'icon-position-jungle-blue-hover.png',
      middle: 'icon-position-middle-blue-hover.png',
      mid: 'icon-position-middle-blue-hover.png',
      bottom: 'icon-position-bottom-blue-hover.png',
      bot: 'icon-position-bottom-blue-hover.png',
      support: 'icon-position-utility-blue-hover.png',
      unknown: 'icon-position-middle-blue-hover.png', // fallback
    };
    const roleKey = role?.toLowerCase();
    return baseUrl + (roleUrls[roleKey] || roleUrls.unknown);
  }

  function isOpForRole(championName, role) {
    return opTierChampions.value[championName]?.includes(role) || false;
  }

  function getPlaceholderUrl(context) {
    const placeholders = {
      pick: "https://placehold.co/60x60/374151/9ca3af?text=?",
      ban: "https://placehold.co/38x38/374151/9ca3af?text=?",
      list: "https://placehold.co/22x22/374151/9ca3af?text=?",
      "creator-pool": "https://placehold.co/56x56/374151/9ca3af?text=?",
      "holding-area": "https://placehold.co/40x40/374151/9ca3af?text=?",
    };
    return placeholders[context] || placeholders["creator-pool"];
  }

  return {
    // State
    allChampions,
    opTierChampions,
    isLoading,
    patchVersion,
    // Getters
    championsByRole,
    // Actions
    loadChampions,
    setChampions,
    setOpTierChampions,
    setLoading,
    setPatchVersion,
    initializePatchVersion,
    getChampionIconUrl,
    getRoleIconSvg,
    getRoleIconUrl,
    isOpForRole,
  };
});

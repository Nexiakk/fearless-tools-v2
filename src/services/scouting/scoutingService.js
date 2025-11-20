import { leaguepediaService } from './leaguepediaService'
import { opggService } from './opggService'
import { useScoutingStore } from '@/stores/scouting'

/**
 * Main orchestrator service for scouting data collection
 * Coordinates between op.gg scraping (backend) and Leaguepedia API
 */
export const scoutingService = {
  /**
   * Scout a single player - collect SoloQ and Pro play data
   * @param {string} playerId - Player ID from Firestore
   * @returns {Promise<Object>} Combined scouting data
   */
  async scoutPlayer(playerId) {
    const scoutingStore = useScoutingStore()
    const player = scoutingStore.players.find(p => p.id === playerId)
    
    if (!player) {
      throw new Error('Player not found')
    }
    
    scoutingStore.setScouting(true)
    scoutingStore.setError('')
    
    try {
      const scoutingData = {
        playerId,
        soloq: null,
        proplay: null,
        lastUpdated: new Date()
      }
      
      // 1. Try to get SoloQ data from op.gg (via backend)
      try {
        if (player.opggUrl) {
          console.log('[ScoutingService] Scraping op.gg for player:', player.name, 'URL:', player.opggUrl)
          const soloqData = await opggService.scrapePlayerChampions(player.opggUrl)
          console.log('[ScoutingService] Received soloqData:', soloqData)
          console.log('[ScoutingService] Champions from soloqData:', soloqData.champions)
          console.log('[ScoutingService] Champions count:', soloqData.champions?.length || 0)
          
          scoutingData.soloq = {
            currentSeason: {
              champions: soloqData.champions || [],
              rank: soloqData.rank || 'Unknown',
              lp: soloqData.lp || 0
            },
            lastUpdated: new Date()
          }
          console.log('[ScoutingService] Created soloq object:', scoutingData.soloq)
          console.log('[ScoutingService] Champions in soloq object:', scoutingData.soloq.currentSeason.champions)
          console.log('[ScoutingService] Champions count in soloq:', scoutingData.soloq.currentSeason.champions.length)
        } else {
          console.warn('[ScoutingService] No op.gg URL for player:', player.name)
        }
      } catch (error) {
        console.error('[ScoutingService] Failed to scrape op.gg:', error)
        console.error('[ScoutingService] Error details:', error.message, error.stack)
        // Fallback to manual entry if available
        const existingData = scoutingStore.scoutingData[playerId]
        if (existingData?.soloq) {
          console.log('[ScoutingService] Using existing soloq data as fallback')
          scoutingData.soloq = existingData.soloq
        } else {
          console.warn('[ScoutingService] No existing soloq data to fallback to')
        }
      }
      
      // 2. Try to get Pro play data from Leaguepedia API
      try {
        // Extract player name from op.gg URL or use player name
        const playerName = this.extractPlayerNameFromOpgg(player.opggUrl) || player.name
        
        const championPool = await leaguepediaService.getPlayerChampionPool(playerName)
        const playerInfo = await leaguepediaService.getPlayerInfo(playerName)
        const recentMatches = await leaguepediaService.getRecentMatches(playerName, 20)
        
        scoutingData.proplay = {
          championPool,
          playerInfo,
          recentMatches,
          teams: playerInfo?.Team ? [playerInfo.Team] : [],
          lastUpdated: new Date()
        }
      } catch (error) {
        console.warn('Failed to fetch Leaguepedia data:', error)
        // Fallback to manual entry if available
        const existingData = scoutingStore.scoutingData[playerId]
        if (existingData?.proplay) {
          scoutingData.proplay = existingData.proplay
        }
      }
      
      // 3. Compute analytics
      console.log('[ScoutingService] Computing analytics with data:', scoutingData)
      scoutingData.analytics = this.computeAnalytics(scoutingData)
      console.log('[ScoutingService] Analytics computed:', scoutingData.analytics)
      
      // 4. Save to Firestore
      console.log('[ScoutingService] Saving to Firestore, final scoutingData:', scoutingData)
      console.log('[ScoutingService] SoloQ champions before save:', scoutingData.soloq?.currentSeason?.champions?.length || 0)
      await scoutingStore.saveScoutingData(playerId, scoutingData)
      console.log('[ScoutingService] Data saved to Firestore')
      
      return scoutingData
    } catch (error) {
      console.error('Error scouting player:', error)
      scoutingStore.setError(`Failed to scout player: ${error.message}`)
      throw error
    } finally {
      scoutingStore.setScouting(false)
    }
  },
  
  /**
   * Scout all players in the workspace
   * @param {Object} options - Options for batch scouting
   * @returns {Promise<void>}
   */
  async scoutAllPlayers(options = {}) {
    const scoutingStore = useScoutingStore()
    const { delay = 2000 } = options // 2 second delay between players
    
    const players = scoutingStore.players
    
    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      
      try {
        await this.scoutPlayer(player.id)
        
        // Add delay between requests (except for last player)
        if (i < players.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      } catch (error) {
        console.error(`Error scouting player ${player.name}:`, error)
        // Continue with next player
      }
    }
  },
  
  /**
   * Extract player name from op.gg URL
   * @param {string} url - op.gg URL
   * @returns {string|null} Player name or null
   */
  extractPlayerNameFromOpgg(url) {
    if (!url) return null
    
    try {
      // op.gg URL format: https://www.op.gg/summoners/{region}/{playerName}
      const match = url.match(/op\.gg\/summoners\/[^/]+\/([^/?]+)/)
      return match ? decodeURIComponent(match[1]) : null
    } catch (error) {
      console.error('Error extracting player name from URL:', error)
      return null
    }
  },
  
  /**
   * Compute analytics from scouting data
   * @param {Object} scoutingData - Scouting data object
   * @returns {Object} Analytics data
   */
  computeAnalytics(scoutingData) {
    const analytics = {
      mostPlayed: [],
      bestWinrate: [],
      recentTrends: [],
      soloqVsProplay: null
    }
    
    // Most played champions (combine SoloQ and Pro)
    const allChampions = new Map()
    
    if (scoutingData.soloq?.currentSeason?.champions) {
      scoutingData.soloq.currentSeason.champions.forEach(champ => {
        if (!allChampions.has(champ.championName)) {
          allChampions.set(champ.championName, {
            championName: champ.championName,
            soloqGames: champ.games || 0,
            proplayGames: 0,
            totalGames: champ.games || 0
          })
        } else {
          const existing = allChampions.get(champ.championName)
          existing.soloqGames += champ.games || 0
          existing.totalGames += champ.games || 0
        }
      })
    }
    
    if (scoutingData.proplay?.championPool) {
      scoutingData.proplay.championPool.forEach(champ => {
        if (!allChampions.has(champ.championName)) {
          allChampions.set(champ.championName, {
            championName: champ.championName,
            soloqGames: 0,
            proplayGames: champ.games || 0,
            totalGames: champ.games || 0
          })
        } else {
          const existing = allChampions.get(champ.championName)
          existing.proplayGames += champ.games || 0
          existing.totalGames += champ.games || 0
        }
      })
    }
    
    analytics.mostPlayed = Array.from(allChampions.values())
      .sort((a, b) => b.totalGames - a.totalGames)
      .slice(0, 10)
    
    // Best winrate champions
    const winrateChampions = []
    
    if (scoutingData.soloq?.currentSeason?.champions) {
      scoutingData.soloq.currentSeason.champions.forEach(champ => {
        if (champ.games >= 5) { // Minimum 5 games
          winrateChampions.push({
            championName: champ.championName,
            winrate: champ.winrate || 0,
            games: champ.games,
            source: 'soloq'
          })
        }
      })
    }
    
    if (scoutingData.proplay?.championPool) {
      scoutingData.proplay.championPool.forEach(champ => {
        if (champ.games >= 3) { // Minimum 3 games for pro play
          const existing = winrateChampions.find(c => c.championName === champ.championName)
          if (existing) {
            // Average if exists in both
            const totalGames = existing.games + champ.games
            existing.winrate = ((existing.winrate * existing.games) + (champ.winrate * champ.games)) / totalGames
            existing.games = totalGames
            existing.source = 'both'
          } else {
            winrateChampions.push({
              championName: champ.championName,
              winrate: champ.winrate || 0,
              games: champ.games,
              source: 'proplay'
            })
          }
        }
      })
    }
    
    analytics.bestWinrate = winrateChampions
      .sort((a, b) => b.winrate - a.winrate)
      .slice(0, 10)
    
    // SoloQ vs Pro play comparison
    if (scoutingData.soloq && scoutingData.proplay) {
      const soloqChampions = new Set(
        scoutingData.soloq.currentSeason?.champions?.map(c => c.championName) || []
      )
      const proplayChampions = new Set(
        scoutingData.proplay.championPool?.map(c => c.championName) || []
      )
      
      const onlySoloq = Array.from(soloqChampions).filter(c => !proplayChampions.has(c))
      const onlyProplay = Array.from(proplayChampions).filter(c => !soloqChampions.has(c))
      const both = Array.from(soloqChampions).filter(c => proplayChampions.has(c))
      
      analytics.soloqVsProplay = {
        onlySoloq,
        onlyProplay,
        both,
        soloqTotal: soloqChampions.size,
        proplayTotal: proplayChampions.size,
        overlap: both.length
      }
    }
    
    return analytics
  },
  
  /**
   * Get cached scouting data or trigger fresh scout
   * @param {string} playerId - Player ID
   * @param {boolean} forceRefresh - Force fresh data
   * @returns {Promise<Object>} Scouting data
   */
  async getPlayerScoutingData(playerId, forceRefresh = false) {
    const scoutingStore = useScoutingStore()
    
    // Load from Firestore if not in memory
    if (!scoutingStore.scoutingData[playerId]) {
      await scoutingStore.loadScoutingData(playerId)
    }
    
    const existingData = scoutingStore.scoutingData[playerId]
    
    // Check if data is stale (older than 24 hours)
    if (existingData?.lastUpdated) {
      const lastUpdated = existingData.lastUpdated.toDate ? existingData.lastUpdated.toDate() : new Date(existingData.lastUpdated)
      const hoursSinceUpdate = (new Date() - lastUpdated) / (1000 * 60 * 60)
      
      if (hoursSinceUpdate > 24 || forceRefresh) {
        // Data is stale, refresh it
        return await this.scoutPlayer(playerId)
      }
    }
    
    // Return cached data or trigger scout if no data exists
    if (!existingData || forceRefresh) {
      return await this.scoutPlayer(playerId)
    }
    
    return existingData
  }
}


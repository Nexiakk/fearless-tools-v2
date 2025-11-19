/**
 * Frontend service for Leaguepedia API
 * Uses poro library directly in the browser (with polyfills)
 */
import { CargoClient } from 'poro'

const cargo = new CargoClient()

export const leaguepediaService = {
  /**
   * Get player's champion pool from pro play
   * @param {string} playerName - Player's name on Leaguepedia
   * @returns {Promise<Array>} Array of champion play data
   */
  async getPlayerChampionPool(playerName) {
    try {
      const result = await cargo.query({
        tables: ['MatchScheduleGame'],
        fields: [
          'MatchScheduleGame.Champion',
          'COUNT(*) as Games',
          'SUM(CASE WHEN MatchScheduleGame.Win="1" THEN 1 ELSE 0 END) as Wins'
        ],
        where: `MatchScheduleGame.Player="${playerName}"`,
        groupBy: 'MatchScheduleGame.Champion',
        orderBy: 'Games DESC',
        limit: 50
      })
      
      // Handle different response formats from poro
      let matches = []
      
      if (Array.isArray(result)) {
        matches = result
      } else if (result && typeof result === 'object') {
        // Try various possible properties
        matches = result.results || result.data || result.items || result.rows || []
        
        // If still not an array, try to convert object values
        if (!Array.isArray(matches) && typeof matches === 'object') {
          matches = Object.values(matches)
        }
      }
      
      if (!Array.isArray(matches)) {
        console.warn('Unexpected Leaguepedia response format:', result)
        return []
      }
      
      return matches.map(match => ({
        championName: match.Champion || match.championName || match.champion || '',
        games: parseInt(match.Games || match.games || 0) || 0,
        wins: parseInt(match.Wins || match.wins || 0) || 0,
        losses: (parseInt(match.Games || match.games || 0) || 0) - (parseInt(match.Wins || match.wins || 0) || 0),
        winrate: (match.Games || match.games) > 0 ? ((parseInt(match.Wins || match.wins || 0) || 0) / parseInt(match.Games || match.games || 0)) * 100 : 0
      }))
    } catch (error) {
      console.error('Leaguepedia API error (getPlayerChampionPool):', error)
      // Return empty array instead of throwing to allow op.gg data to still work
      return []
    }
  },

  /**
   * Get player information from Leaguepedia
   * @param {string} playerName - Player's name on Leaguepedia
   * @returns {Promise<Object|null>} Player info or null if not found
   */
  async getPlayerInfo(playerName) {
    try {
      const players = await cargo.query({
        tables: ['Players'],
        fields: [
          'Players.ID',
          'Players.Name',
          'Players.Team',
          'Players.Role',
          'Players.Region'
        ],
        where: `Players.Name="${playerName}"`,
        limit: 1
      })
      
      return players.length > 0 ? players[0] : null
    } catch (error) {
      console.error('Leaguepedia API error (getPlayerInfo):', error)
      throw error
    }
  },

  /**
   * Get recent pro matches for a player
   * @param {string} playerName - Player's name on Leaguepedia
   * @param {number} limit - Number of matches to return (default: 20)
   * @returns {Promise<Array>} Array of recent matches
   */
  async getRecentMatches(playerName, limit = 20) {
    try {
      const matches = await cargo.query({
        tables: ['MatchScheduleGame'],
        fields: [
          'MatchScheduleGame.Champion',
          'MatchScheduleGame.Win',
          'MatchScheduleGame.Date',
          'MatchScheduleGame.Opponent',
          'MatchScheduleGame.Team',
          'MatchScheduleGame.Tournament'
        ],
        where: `MatchScheduleGame.Player="${playerName}"`,
        orderBy: 'MatchScheduleGame.Date DESC',
        limit: limit
      })
      
      return matches.map(match => ({
        champion: match.Champion,
        win: match.Win === '1',
        date: match.Date,
        opponent: match.Opponent,
        team: match.Team,
        tournament: match.Tournament
      }))
    } catch (error) {
      console.error('Leaguepedia API error (getRecentMatches):', error)
      throw error
    }
  },

  /**
   * Search for players by name (fuzzy search)
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Array of matching players
   */
  async searchPlayers(searchTerm) {
    try {
      const players = await cargo.query({
        tables: ['Players'],
        fields: [
          'Players.ID',
          'Players.Name',
          'Players.Team',
          'Players.Role',
          'Players.Region'
        ],
        where: `Players.Name LIKE "%${searchTerm}%"`,
        limit: 20
      })
      
      return players
    } catch (error) {
      console.error('Leaguepedia API error (searchPlayers):', error)
      throw error
    }
  }
}


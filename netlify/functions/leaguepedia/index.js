const { CargoClient } = require('poro')
const axios = require('axios')

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    }
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { action, params } = JSON.parse(event.body)

    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Action is required' })
      }
    }

    // Initialize Poro CargoClient
    const cargo = new CargoClient()
    
    // Access Poro's axios instance to inspect raw responses if needed
    // cargo.axiosInstance can be used for debugging
    
    let results = []
    
    console.log(`[Leaguepedia] Action: ${action}, Params:`, JSON.stringify(params))

    switch (action) {
      case 'getPlayerChampionPool':
        // Query champion pool - use ScoreboardPlayers (plural, not ScoreboardPlayer)
        const playerName1 = params.playerName
        console.log(`[Leaguepedia] getPlayerChampionPool query for player: "${playerName1}"`)
        
        try {
          // Query champion pool with aggregated stats from ScoreboardPlayers
          // This table should have per-game player stats including champion, KDA, CS, gold, etc.
          // We'll aggregate by champion to get totals and averages
          console.log(`[Leaguepedia] Querying ScoreboardPlayers for champion pool data`)
          
          const queryResult = await cargo.query({
            tables: ['ScoreboardPlayers'],
            fields: [
              'ScoreboardPlayers.Champion',
              'COUNT(*) as Games',
              'SUM(CASE WHEN ScoreboardPlayers.Win="1" THEN 1 ELSE 0 END) as Wins',
              'AVG(ScoreboardPlayers.Kills) as AvgKills',
              'AVG(ScoreboardPlayers.Deaths) as AvgDeaths',
              'AVG(ScoreboardPlayers.Assists) as AvgAssists',
              'AVG(ScoreboardPlayers.CS) as AvgCS',
              'AVG(ScoreboardPlayers.Gold) as AvgGold',
              'AVG(ScoreboardPlayers.VisionScore) as AvgVisionScore',
              'AVG(ScoreboardPlayers.DamageToChampions) as AvgDamage'
            ],
            where: `ScoreboardPlayers.Player = "${playerName1}" AND ScoreboardPlayers.Date >= "2025-01-01"`,
            groupBy: ['ScoreboardPlayers.Champion'],
            orderBy: [{ field: 'Games', desc: true }],
            limit: 50
          })
          
          // Handle response
          if (Array.isArray(queryResult)) {
            results = queryResult
          } else if (queryResult && typeof queryResult === 'object') {
            results = queryResult.data || queryResult.results || queryResult.items || []
            if (!Array.isArray(results)) {
              results = []
            }
          } else {
            results = []
          }
          
          console.log(`[Leaguepedia] Query successful, got ${results.length} results`)
          if (results.length > 0) {
            console.log(`[Leaguepedia] First result sample:`, JSON.stringify(results[0]).substring(0, 200))
          }
        } catch (error) {
          console.error(`[Leaguepedia] Query failed:`, error.message)
          // Try simpler query to see what fields actually exist
          try {
            const simpleTest = await cargo.query({
              tables: ['ScoreboardPlayers'],
              fields: ['ScoreboardPlayers.Player', 'ScoreboardPlayers.Champion'],
              where: `ScoreboardPlayers.Player = "${playerName1}"`,
              limit: 1
            })
            console.log(`[Leaguepedia] Simple test query result:`, JSON.stringify(simpleTest).substring(0, 300))
          } catch (testError) {
            console.error(`[Leaguepedia] Simple test also failed:`, testError.message)
          }
          results = []
        }
        
        // Transform results to match op.gg data structure
        const transformedChampionPool = results.map(match => {
          const games = parseInt(match.Games || match.games || 0) || 0
          const wins = parseInt(match.Wins || match.wins || 0) || 0
          const losses = games - wins
          const winrate = games > 0 ? (wins / games) * 100 : 0
          
          const avgKills = parseFloat(match.AvgKills || match.avgKills || match.Kills || 0) || 0
          const avgDeaths = parseFloat(match.AvgDeaths || match.avgDeaths || match.Deaths || 0) || 0
          const avgAssists = parseFloat(match.AvgAssists || match.avgAssists || match.Assists || 0) || 0
          const kdaRatio = avgDeaths > 0 ? (avgKills + avgAssists) / avgDeaths : (avgKills + avgAssists)
          
          const championData = {
            championName: match.Champion || match.championName || match.champion || '',
            games,
            wins,
            losses,
            winrate: Math.round(winrate * 10) / 10 // Round to 1 decimal
          }
          
          // Add KDA if available
          if (avgKills > 0 || avgDeaths > 0 || avgAssists > 0) {
            championData.kda = {
              kills: Math.round(avgKills * 10) / 10,
              deaths: Math.round(avgDeaths * 10) / 10,
              assists: Math.round(avgAssists * 10) / 10,
              ratio: Math.round(kdaRatio * 100) / 100,
              killParticipation: 0 // Would need team data to calculate
            }
          }
          
          // Add CS if available
          const avgCS = parseFloat(match.AvgCS || match.avgCS || match.CS || 0) || 0
          if (avgCS > 0) {
            championData.cs = {
              total: Math.round(avgCS), // Average CS per game
              perMinute: 0 // Would need game duration to calculate
            }
          }
          
          // Add Gold if available
          const avgGold = parseFloat(match.AvgGold || match.avgGold || match.Gold || 0) || 0
          if (avgGold > 0) {
            championData.gold = {
              total: Math.round(avgGold), // Average gold per game
              perMinute: 0 // Would need game duration to calculate
            }
          }
          
          // Add Vision Score if available
          const avgVision = parseFloat(match.AvgVisionScore || match.avgVisionScore || match.VisionScore || 0) || 0
          if (avgVision > 0) {
            championData.wards = {
              visionScore: Math.round(avgVision * 10) / 10,
              controlWards: 0, // Would need separate field
              placed: 0,
              killed: 0
            }
          }
          
          // Add Damage if available
          const avgDamage = parseFloat(match.AvgDamage || match.avgDamage || match.DamageToChampions || 0) || 0
          if (avgDamage > 0) {
            championData.damage = {
              perMinute: 0, // Would need game duration
              percentage: 0 // Would need team total damage
            }
          }
          
          return championData
        })
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: transformedChampionPool
          })
        }

      case 'getPlayerInfo':
        // Query player info from Players table (this one should work)
        const playerName2 = params.playerName
        console.log(`[Leaguepedia] getPlayerInfo query for player: "${playerName2}"`)
        
        try {
          // First test with direct axios to see response
          const testUrl = `https://lol.fandom.com/wiki/Special:CargoExport?tables=Players&fields=Players.Name&where=Players.Name = "${playerName2}"&limit=1&format=json`
          const testResponse = await axios.get(testUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
          })
          
          console.log(`[Leaguepedia] Players table test response:`, typeof testResponse.data === 'string' 
            ? testResponse.data.substring(0, 200) 
            : 'JSON response')
          
          // If test works, use Poro
          if (typeof testResponse.data === 'string' && testResponse.data.startsWith('Error:')) {
            console.error(`[Leaguepedia] Players table also has issues:`, testResponse.data)
            results = []
          } else {
            const queryResult = await cargo.query({
              tables: ['Players'],
              fields: ['Players.ID', 'Players.Name', 'Players.Team', 'Players.Role', 'Players.Region'],
              where: `Players.Name = "${playerName2}"`,
              orderBy: [{ field: 'Players._pageName' }],
              limit: 1
            })
            
            // Handle response
            if (Array.isArray(queryResult)) {
              results = queryResult
            } else if (queryResult && typeof queryResult === 'object') {
              results = queryResult.data || queryResult.results || queryResult.items || []
              if (!Array.isArray(results)) {
                results = []
              }
            } else {
              results = []
            }
            
            console.log(`[Leaguepedia] Query successful, got ${results.length} results`)
          }
        } catch (error) {
          console.error(`[Leaguepedia] Query failed:`, error.message)
          results = []
        }
        
        const playerInfo = results.length > 0 ? results[0] : null
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: playerInfo
          })
        }

      case 'getRecentMatches':
        // Query recent matches - use ScoreboardPlayers (plural)
        const limit = params.limit || 20
        const playerName3 = params.playerName
        console.log(`[Leaguepedia] getRecentMatches query for player: "${playerName3}"`)
        
        try {
          // Query recent matches with detailed stats
          const queryResult = await cargo.query({
            tables: ['ScoreboardPlayers'],
            fields: [
              'ScoreboardPlayers.Champion',
              'ScoreboardPlayers.Win',
              'ScoreboardPlayers.Date',
              'ScoreboardPlayers.Opponent',
              'ScoreboardPlayers.Team',
              'ScoreboardPlayers.Tournament',
              'ScoreboardPlayers.Kills',
              'ScoreboardPlayers.Deaths',
              'ScoreboardPlayers.Assists',
              'ScoreboardPlayers.CS',
              'ScoreboardPlayers.Gold',
              'ScoreboardPlayers.VisionScore'
            ],
            where: `ScoreboardPlayers.Player = "${playerName3}" AND ScoreboardPlayers.Date >= "2025-01-01"`,
            orderBy: [{ field: 'ScoreboardPlayers.Date', desc: true }],
            limit: limit
          })
          
          // Handle response
          if (Array.isArray(queryResult)) {
            results = queryResult
          } else if (queryResult && typeof queryResult === 'object') {
            results = queryResult.data || queryResult.results || queryResult.items || []
            if (!Array.isArray(results)) {
              results = []
            }
          } else {
            results = []
          }
          
          console.log(`[Leaguepedia] Query successful, got ${results.length} results`)
        } catch (error) {
          console.error(`[Leaguepedia] Query failed:`, error.message)
          results = []
        }
        
        const transformedMatches = results.map(match => ({
          champion: match.Champion || '',
          win: match.Win === '1' || match.Win === 1,
          date: match.Date,
          opponent: match.Opponent,
          team: match.Team,
          tournament: match.Tournament,
          kda: {
            kills: parseFloat(match.Kills || 0) || 0,
            deaths: parseFloat(match.Deaths || 0) || 0,
            assists: parseFloat(match.Assists || 0) || 0
          },
          cs: parseFloat(match.CS || 0) || 0,
          gold: parseFloat(match.Gold || 0) || 0,
          visionScore: parseFloat(match.VisionScore || 0) || 0
        }))
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: transformedMatches
          })
        }

      case 'searchPlayers':
        // Search players
        const searchTerm = params.searchTerm
        console.log(`[Leaguepedia] searchPlayers query for: "${searchTerm}"`)
        
        try {
          const queryResult = await cargo.query({
            tables: ['Players'],
            fields: ['Players.ID', 'Players.Name', 'Players.Team', 'Players.Role', 'Players.Region'],
            where: `Players.Name LIKE "%${searchTerm}%"`,
            limit: 20
          })
          
          // Handle different response formats
          if (Array.isArray(queryResult)) {
            results = queryResult
          } else if (queryResult && typeof queryResult === 'object') {
            results = queryResult.data || queryResult.results || queryResult.items || []
            if (!Array.isArray(results)) {
              results = []
            }
          } else {
            results = []
          }
          
          console.log(`[Leaguepedia] Query successful, got ${results.length} results`)
        } catch (error) {
          console.error(`[Leaguepedia] Query failed:`, error.message)
          console.error(`[Leaguepedia] Query error stack:`, error.stack)
          
          if (error.response) {
            console.error(`[Leaguepedia] Error response status:`, error.response.status)
            console.error(`[Leaguepedia] Error response data:`, typeof error.response.data === 'string' 
              ? error.response.data.substring(0, 500) 
              : JSON.stringify(error.response.data).substring(0, 500))
          }
          
          // Return empty array instead of throwing
          results = []
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: results
          })
        }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown action: ${action}` })
        }
    }
  } catch (error) {
    console.error('Leaguepedia API error:', error)
    
    let errorMessage = 'Failed to fetch Leaguepedia data'
    if (error.response) {
      errorMessage = `Leaguepedia returned error: ${error.response.status}`
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout - Leaguepedia is slow or unavailable'
    } else if (error.message) {
      errorMessage = error.message
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: errorMessage,
        message: error.message 
      })
    }
  }
}


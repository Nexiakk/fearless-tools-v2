const axios = require('axios')

// Helper function to query Leaguepedia Cargo API directly
// Bypasses poro library which has issues with response parsing
async function queryCargoAPI({ tables, fields, where, join_on, group_by, order_by, limit }) {
  const baseUrl = 'https://lol.fandom.com/wiki/Special:CargoExport'
  
  // Build tables parameter - handle both string and array formats
  let tablesParam = Array.isArray(tables) ? tables.join(',') : tables
  
  // Build fields parameter
  const fieldsParam = Array.isArray(fields) ? fields.join(',') : fields
  
  // Build where clause
  const whereParam = where || ''
  
  // Build group_by if provided
  let groupByParam = ''
  if (group_by) {
    groupByParam = Array.isArray(group_by) ? group_by.join(',') : group_by
  }
  
  // Build order_by if provided
  let orderByParam = ''
  if (order_by) {
    if (typeof order_by === 'string') {
      orderByParam = order_by
    } else if (Array.isArray(order_by)) {
      orderByParam = order_by.map(o => {
        if (typeof o === 'string') return o
        if (o.desc) return `${o.field} DESC`
        return o.field
      }).join(',')
    } else if (order_by.field) {
      orderByParam = order_by.desc ? `${order_by.field} DESC` : order_by.field
    }
  }
  
  // Build query parameters
  const params = new URLSearchParams({
    tables: tablesParam,
    fields: fieldsParam,
    format: 'json'
  })
  
  if (whereParam) params.append('where', whereParam)
  if (join_on) params.append('join_on', join_on)
  if (groupByParam) params.append('group_by', groupByParam)
  if (orderByParam) params.append('order_by', orderByParam)
  if (limit) params.append('limit', limit.toString())
  
  const url = `${baseUrl}?${params.toString()}`
  console.log(`[Leaguepedia] Cargo API URL: ${url.substring(0, 200)}...`)
  
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeaguepediaBot/1.0)' },
    timeout: 30000
  })
  
  // Parse Cargo API response
  // Format: { "cargoquery": [{ "title": { "field": "value" } }] }
  if (response.data && response.data.cargoquery && Array.isArray(response.data.cargoquery)) {
    return response.data.cargoquery.map(item => item.title || item)
  }
  
  // Fallback: if response is already an array or different structure
  if (Array.isArray(response.data)) {
    return response.data
  }
  
  // If response.data is an object but not cargoquery format, try to extract data
  if (response.data && typeof response.data === 'object') {
    // Try common property names
    if (Array.isArray(response.data.data)) return response.data.data
    if (Array.isArray(response.data.results)) return response.data.results
    if (Array.isArray(response.data.items)) return response.data.items
  }
  
  console.warn(`[Leaguepedia] Unexpected response format:`, typeof response.data)
  return []
}

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

    let results = []
    
    console.log(`[Leaguepedia] Action: ${action}, Params:`, JSON.stringify(params))

    switch (action) {
      case 'getPlayerChampionPool':
        // Query champion pool - use ScoreboardPlayers (plural, not ScoreboardPlayer)
        const playerName1 = params.playerName
        console.log(`[Leaguepedia] getPlayerChampionPool query for player: "${playerName1}"`)
        
        try {
          // Query champion pool with aggregated stats from ScoreboardPlayers
          // According to Leaguepedia API docs, we need to join PlayerRedirects for name resolution
          // and use proper field names from ScoreboardPlayers table
          console.log(`[Leaguepedia] Querying ScoreboardPlayers for champion pool data`)
          
          // Query ScoreboardPlayers with PlayerRedirects join for name resolution
          // Use direct Cargo API to bypass poro library issues
          try {
            // First try with join for proper name resolution
            results = await queryCargoAPI({
              tables: 'ScoreboardPlayers=SP, PlayerRedirects=PR',
              fields: [
                'SP.Champion',
                'COUNT(*) as Games',
                'SUM(CASE WHEN SP.Win="1" THEN 1 ELSE 0 END) as Wins',
                'AVG(SP.Kills) as AvgKills',
                'AVG(SP.Deaths) as AvgDeaths',
                'AVG(SP.Assists) as AvgAssists',
                'AVG(SP.CS) as AvgCS',
                'AVG(SP.Gold) as AvgGold',
                'AVG(SP.VisionScore) as AvgVisionScore',
                'AVG(SP.DamageToChampions) as AvgDamage'
              ],
              where: `PR.AllName = "${playerName1}" AND SP.Date >= "2025-01-01"`,
              join_on: 'SP.Player=PR.AllName',
              group_by: 'SP.Champion',
              order_by: 'Games DESC',
              limit: 50
            })
            
            console.log(`[Leaguepedia] Join query successful, got ${results.length} results`)
            
            // If join query returns no results, try direct query (player name might match exactly)
            if (results.length === 0) {
              console.log(`[Leaguepedia] Join query returned no results, trying direct query`)
              results = await queryCargoAPI({
                tables: 'ScoreboardPlayers',
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
                group_by: 'ScoreboardPlayers.Champion',
                order_by: 'Games DESC',
                limit: 50
              })
              console.log(`[Leaguepedia] Direct query got ${results.length} results`)
            }
            
            if (results.length > 0) {
              console.log(`[Leaguepedia] First result sample:`, JSON.stringify(results[0]).substring(0, 300))
            }
          } catch (error) {
            console.error(`[Leaguepedia] Query failed:`, error.message)
            console.error(`[Leaguepedia] Query error stack:`, error.stack)
            if (error.response) {
              console.error(`[Leaguepedia] Response status:`, error.response.status)
              console.error(`[Leaguepedia] Response data:`, typeof error.response.data === 'string' 
                ? error.response.data.substring(0, 500) 
                : JSON.stringify(error.response.data).substring(0, 500))
            }
            results = []
          }
        
        // Transform results to match op.gg data structure
        // Handle both camelCase and PascalCase field names from API
        const transformedChampionPool = results.map(match => {
          // Handle field name variations (API might return different casing)
          const games = parseInt(match.Games || match.games || 0) || 0
          const wins = parseInt(match.Wins || match.wins || 0) || 0
          const losses = games - wins
          const winrate = games > 0 ? (wins / games) * 100 : 0
          
          const avgKills = parseFloat(match.AvgKills || match.avgKills || match.Kills || match.kills || 0) || 0
          const avgDeaths = parseFloat(match.AvgDeaths || match.avgDeaths || match.Deaths || match.deaths || 0) || 0
          const avgAssists = parseFloat(match.AvgAssists || match.avgAssists || match.Assists || match.assists || 0) || 0
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
          const avgCS = parseFloat(match.AvgCS || match.avgCS || match.CS || match.cs || 0) || 0
          if (avgCS > 0) {
            championData.cs = {
              total: Math.round(avgCS), // Average CS per game
              perMinute: 0 // Would need game duration to calculate
            }
          }
          
          // Add Gold if available
          const avgGold = parseFloat(match.AvgGold || match.avgGold || match.Gold || match.gold || 0) || 0
          if (avgGold > 0) {
            championData.gold = {
              total: Math.round(avgGold), // Average gold per game
              perMinute: 0 // Would need game duration to calculate
            }
          }
          
          // Add Vision Score if available
          const avgVision = parseFloat(match.AvgVisionScore || match.avgVisionScore || match.VisionScore || match.visionScore || 0) || 0
          if (avgVision > 0) {
            championData.wards = {
              visionScore: Math.round(avgVision * 10) / 10,
              controlWards: 0, // Would need separate field
              placed: 0,
              killed: 0
            }
          }
          
          // Add Damage if available
          const avgDamage = parseFloat(match.AvgDamage || match.avgDamage || match.DamageToChampions || match.damageToChampions || 0) || 0
          if (avgDamage > 0) {
            championData.damage = {
              total: Math.round(avgDamage), // Average damage per game
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
        // Query player info from Players table
        // According to Leaguepedia API docs, should join PlayerRedirects for name resolution
        const playerName2 = params.playerName
        console.log(`[Leaguepedia] getPlayerInfo query for player: "${playerName2}"`)
        
        try {
          // Use PlayerRedirects join as recommended in Leaguepedia API docs
          // Use direct Cargo API to bypass poro library issues
          try {
            results = await queryCargoAPI({
              tables: 'Players=P, PlayerRedirects=PR',
              fields: ['P.ID', 'P.Name', 'P.Team', 'P.Role', 'P.Region', 'P.Country', 'P.Birthdate'],
              where: `PR.AllName = "${playerName2}"`,
              join_on: 'PR.OverviewPage=P.OverviewPage',
              limit: 1
            })
            
            // If join query returns no results, try direct query
            if (results.length === 0) {
              console.log(`[Leaguepedia] Join query returned no results, trying direct query`)
              results = await queryCargoAPI({
                tables: 'Players',
                fields: ['Players.ID', 'Players.Name', 'Players.Team', 'Players.Role', 'Players.Region', 'Players.Country', 'Players.Birthdate'],
                where: `Players.Name = "${playerName2}"`,
                limit: 1
              })
            }
            
            console.log(`[Leaguepedia] Query successful, got ${results.length} results`)
          } catch (apiError) {
            console.error(`[Leaguepedia] Cargo API error:`, apiError.message)
            throw apiError
          }
        } catch (error) {
          console.error(`[Leaguepedia] Query failed:`, error.message)
          console.error(`[Leaguepedia] Query error stack:`, error.stack)
          if (error.response) {
            console.error(`[Leaguepedia] Response status:`, error.response.status)
            console.error(`[Leaguepedia] Response data:`, typeof error.response.data === 'string' 
              ? error.response.data.substring(0, 500) 
              : JSON.stringify(error.response.data).substring(0, 500))
          }
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
        // Query recent matches - use ScoreboardPlayers with PlayerRedirects join
        const limit = params.limit || 20
        const playerName3 = params.playerName
        console.log(`[Leaguepedia] getRecentMatches query for player: "${playerName3}"`)
        
        try {
          // Query recent matches with detailed stats
          // Use direct Cargo API to bypass poro library issues
          try {
            results = await queryCargoAPI({
              tables: 'ScoreboardPlayers=SP, PlayerRedirects=PR',
              fields: [
                'SP.Champion',
                'SP.Win',
                'SP.Date',
                'SP.Opponent',
                'SP.Team',
                'SP.Tournament',
                'SP.Kills',
                'SP.Deaths',
                'SP.Assists',
                'SP.CS',
                'SP.Gold',
                'SP.VisionScore',
                'SP.DamageToChampions'
              ],
              where: `PR.AllName = "${playerName3}" AND SP.Date >= "2025-01-01"`,
              join_on: 'SP.Player=PR.AllName',
              order_by: 'SP.Date DESC',
              limit: limit
            })
            
            // If join query returns no results, try direct query
            if (results.length === 0) {
              console.log(`[Leaguepedia] Join query returned no results, trying direct query`)
              results = await queryCargoAPI({
                tables: 'ScoreboardPlayers',
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
                  'ScoreboardPlayers.VisionScore',
                  'ScoreboardPlayers.DamageToChampions'
                ],
                where: `ScoreboardPlayers.Player = "${playerName3}" AND ScoreboardPlayers.Date >= "2025-01-01"`,
                order_by: 'ScoreboardPlayers.Date DESC',
                limit: limit
              })
            }
            
            console.log(`[Leaguepedia] Query successful, got ${results.length} results`)
          } catch (apiError) {
            console.error(`[Leaguepedia] Cargo API error:`, apiError.message)
            throw apiError
          }
        } catch (error) {
          console.error(`[Leaguepedia] Query failed:`, error.message)
          console.error(`[Leaguepedia] Query error stack:`, error.stack)
          if (error.response) {
            console.error(`[Leaguepedia] Response status:`, error.response.status)
            console.error(`[Leaguepedia] Response data:`, typeof error.response.data === 'string' 
              ? error.response.data.substring(0, 500) 
              : JSON.stringify(error.response.data).substring(0, 500))
          }
          results = []
        }
        
        const transformedMatches = results.map(match => ({
          champion: match.Champion || match.champion || '',
          win: match.Win === '1' || match.Win === 1 || match.win === '1' || match.win === 1,
          date: match.Date || match.date || '',
          opponent: match.Opponent || match.opponent || '',
          team: match.Team || match.team || '',
          tournament: match.Tournament || match.tournament || '',
          kda: {
            kills: parseFloat(match.Kills || match.kills || 0) || 0,
            deaths: parseFloat(match.Deaths || match.deaths || 0) || 0,
            assists: parseFloat(match.Assists || match.assists || 0) || 0
          },
          cs: parseFloat(match.CS || match.cs || 0) || 0,
          gold: parseFloat(match.Gold || match.gold || 0) || 0,
          visionScore: parseFloat(match.VisionScore || match.visionScore || 0) || 0,
          damage: parseFloat(match.DamageToChampions || match.damageToChampions || 0) || 0
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
          // Use direct Cargo API to bypass poro library issues
          results = await queryCargoAPI({
            tables: 'Players',
            fields: ['Players.ID', 'Players.Name', 'Players.Team', 'Players.Role', 'Players.Region'],
            where: `Players.Name LIKE "%${searchTerm}%"`,
            limit: 20
          })
          
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


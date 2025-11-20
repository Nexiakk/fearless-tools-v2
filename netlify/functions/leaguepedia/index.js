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
    headers: { 
      'User-Agent': 'Mozilla/5.0 (compatible; LeaguepediaBot/1.0)',
      'Accept': 'application/json'
    },
    timeout: 30000,
    responseType: 'json', // Explicitly request JSON
    transformResponse: [(data) => {
      // If axios didn't parse it, try to parse it ourselves
      if (typeof data === 'string') {
        try {
          return JSON.parse(data)
        } catch (e) {
          // Return as string if not JSON
          return data
        }
      }
      return data
    }]
  })
  
  // Handle string responses (might be error messages or HTML)
  if (typeof response.data === 'string') {
    console.log(`[Leaguepedia] Response is string, first 500 chars:`, response.data.substring(0, 500))
    
    // Try to parse as JSON if it's a JSON string
    try {
      const parsed = JSON.parse(response.data)
      if (parsed.cargoquery && Array.isArray(parsed.cargoquery)) {
        return parsed.cargoquery.map(item => item.title || item)
      }
      if (Array.isArray(parsed)) {
        return parsed
      }
    } catch (parseError) {
      // Not JSON, might be HTML error page
      console.error(`[Leaguepedia] Response is not JSON, might be error:`, response.data.substring(0, 200))
      
      // Check if it's an error message
      if (response.data.includes('Error:') || response.data.includes('error')) {
        console.error(`[Leaguepedia] API returned error:`, response.data.substring(0, 300))
      }
      return []
    }
  }
  
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
  if (response.data && typeof response.data === 'object') {
    console.warn(`[Leaguepedia] Response keys:`, Object.keys(response.data))
    console.warn(`[Leaguepedia] Response sample:`, JSON.stringify(response.data).substring(0, 300))
  }
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
          // Since Cargo API has issues with SQL functions and aliases, we'll query raw data and aggregate in JS
          try {
            // First try a simple query to discover available fields
            let testFields = ['Champion', 'Result', 'Win', 'W', 'Kills', 'Deaths', 'Assists', 'CS', 'Gold', 'VisionScore', 'DamageToChampions']
            let rawResults = []
            
            // Try with join first
            for (const field of testFields) {
              try {
                rawResults = await queryCargoAPI({
                  tables: 'ScoreboardPlayers=SP, PlayerRedirects=PR',
                  fields: [
                    'SP.Champion',
                    `SP.${field}`,
                    'SP.Kills',
                    'SP.Deaths',
                    'SP.Assists',
                    'SP.CS',
                    'SP.Gold',
                    'SP.VisionScore',
                    'SP.DamageToChampions'
                  ],
                  where: `PR.AllName = "${playerName1}" AND SP.Date >= "2025-01-01"`,
                  join_on: 'SP.Player=PR.AllName',
                  limit: 10 // Just test with 10 first
                })
                if (rawResults.length > 0) {
                  console.log(`[Leaguepedia] Successfully found win field: ${field}, got ${rawResults.length} results`)
                  console.log(`[Leaguepedia] Sample result fields:`, Object.keys(rawResults[0]))
                  // Now query all data with correct field
                  rawResults = await queryCargoAPI({
                    tables: 'ScoreboardPlayers=SP, PlayerRedirects=PR',
                    fields: [
                      'SP.Champion',
                      `SP.${field}`,
                      'SP.Kills',
                      'SP.Deaths',
                      'SP.Assists',
                      'SP.CS',
                      'SP.Gold',
                      'SP.VisionScore',
                      'SP.DamageToChampions'
                    ],
                    where: `PR.AllName = "${playerName1}" AND SP.Date >= "2025-01-01"`,
                    join_on: 'SP.Player=PR.AllName',
                    limit: 1000
                  })
                  break
                }
              } catch (fieldError) {
                // Try next field
                continue
              }
            }
            
            console.log(`[Leaguepedia] Join query successful, got ${rawResults.length} raw games`)
            
            // If join query returns no results, try direct query (player name might match exactly)
            if (rawResults.length === 0) {
              console.log(`[Leaguepedia] Join query returned no results, trying direct query`)
              for (const field of testFields) {
                try {
                  rawResults = await queryCargoAPI({
                    tables: 'ScoreboardPlayers',
                    fields: [
                      'ScoreboardPlayers.Champion',
                      `ScoreboardPlayers.${field}`,
                      'ScoreboardPlayers.Kills',
                      'ScoreboardPlayers.Deaths',
                      'ScoreboardPlayers.Assists',
                      'ScoreboardPlayers.CS',
                      'ScoreboardPlayers.Gold',
                      'ScoreboardPlayers.VisionScore',
                      'ScoreboardPlayers.DamageToChampions'
                    ],
                    where: `ScoreboardPlayers.Player = "${playerName1}" AND ScoreboardPlayers.Date >= "2025-01-01"`,
                    limit: 1000
                  })
                  if (rawResults.length > 0) {
                    console.log(`[Leaguepedia] Direct query successful with field: ${field}`)
                    break
                  }
                } catch (fieldError) {
                  continue
                }
              }
              console.log(`[Leaguepedia] Direct query got ${rawResults.length} raw games`)
            }
            
            // Aggregate by champion in JavaScript
            const championMap = {}
            rawResults.forEach(game => {
              const champ = game.Champion || game.champion || ''
              if (!champ) return
              
              if (!championMap[champ]) {
                championMap[champ] = {
                  Champion: champ,
                  games: 0,
                  wins: 0,
                  kills: [],
                  deaths: [],
                  assists: [],
                  cs: [],
                  gold: [],
                  visionScore: [],
                  damage: []
                }
              }
              
              const stats = championMap[champ]
              stats.games++
              
              // Check if win - try multiple possible field names and formats
              // Result field: "1" = win, "0" = loss (or "W"/"L" in some cases)
              const result = game.Result || game.result || game.Win || game.win || game.W || game.w || ''
              const win = result === '1' || result === 1 || result === 'W' || result === 'Win' || 
                         result === true || result === 'true' ||
                         game.Win === '1' || game.Win === 1 || game.win === '1' || game.win === 1
              if (win) stats.wins++
              
              // Collect stats for averaging
              const kills = parseFloat(game.Kills || game.kills || 0) || 0
              const deaths = parseFloat(game.Deaths || game.deaths || 0) || 0
              const assists = parseFloat(game.Assists || game.assists || 0) || 0
              const cs = parseFloat(game.CS || game.cs || 0) || 0
              const gold = parseFloat(game.Gold || game.gold || 0) || 0
              const vision = parseFloat(game.VisionScore || game.visionScore || 0) || 0
              const damage = parseFloat(game.DamageToChampions || game.damageToChampions || 0) || 0
              
              stats.kills.push(kills)
              stats.deaths.push(deaths)
              stats.assists.push(assists)
              stats.cs.push(cs)
              stats.gold.push(gold)
              stats.visionScore.push(vision)
              stats.damage.push(damage)
            })
            
            // Convert to array and calculate averages
            results = Object.values(championMap).map(stats => {
              const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
              
              return {
                Champion: stats.Champion,
                Games: stats.games,
                Wins: stats.wins,
                AvgKills: avg(stats.kills),
                AvgDeaths: avg(stats.deaths),
                AvgAssists: avg(stats.assists),
                AvgCS: avg(stats.cs),
                AvgGold: avg(stats.gold),
                AvgVisionScore: avg(stats.visionScore),
                AvgDamage: avg(stats.damage)
              }
            }).sort((a, b) => b.Games - a.Games).slice(0, 50) // Sort by games, limit to 50
            
            console.log(`[Leaguepedia] Aggregated ${results.length} champions from ${rawResults.length} games`)
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
            
            // Try a minimal query to see what fields actually exist
            try {
              console.log(`[Leaguepedia] Trying minimal query to discover available fields`)
              const testResult = await queryCargoAPI({
                tables: 'ScoreboardPlayers',
                fields: ['ScoreboardPlayers.Champion', 'ScoreboardPlayers.Player'],
                where: `ScoreboardPlayers.Player = "${playerName1}"`,
                limit: 1
              })
              if (testResult.length > 0) {
                console.log(`[Leaguepedia] Test query successful, available fields in result:`, Object.keys(testResult[0]))
              }
            } catch (testError) {
              console.error(`[Leaguepedia] Test query also failed:`, testError.message)
            }
            
            results = []
          }
        } catch (error) {
          console.error(`[Leaguepedia] Outer try block error:`, error.message)
          results = []
        }
        
        // Transform results to match op.gg data structure
        // Results are now pre-aggregated in JavaScript with proper field names
        const transformedChampionPool = results.map(match => {
          const games = parseInt(match.Games || match.games || 0) || 0
          const wins = parseInt(match.Wins || match.wins || 0) || 0
          const losses = games - wins
          const winrate = games > 0 ? (wins / games) * 100 : 0
          
          const avgKills = parseFloat(match.AvgKills || match.avgKills || 0) || 0
          const avgDeaths = parseFloat(match.AvgDeaths || match.avgDeaths || 0) || 0
          const avgAssists = parseFloat(match.AvgAssists || match.avgAssists || 0) || 0
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
          const avgCS = parseFloat(match.AvgCS || match.avgCS || 0) || 0
          if (avgCS > 0) {
            championData.cs = {
              total: Math.round(avgCS), // Average CS per game
              perMinute: 0 // Would need game duration to calculate
            }
          }
          
          // Add Gold if available
          const avgGold = parseFloat(match.AvgGold || match.avgGold || 0) || 0
          if (avgGold > 0) {
            championData.gold = {
              total: Math.round(avgGold), // Average gold per game
              perMinute: 0 // Would need game duration to calculate
            }
          }
          
          // Add Vision Score if available
          const avgVision = parseFloat(match.AvgVisionScore || match.avgVisionScore || 0) || 0
          if (avgVision > 0) {
            championData.wards = {
              visionScore: Math.round(avgVision * 10) / 10,
              controlWards: 0, // Would need separate field
              placed: 0,
              killed: 0
            }
          }
          
          // Add Damage if available
          const avgDamage = parseFloat(match.AvgDamage || match.avgDamage || 0) || 0
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
              fields: ['P.ID', 'P.Name', 'P.Team', 'P.Role', 'P.Country', 'P.Birthdate', 'P.Residency'],
              where: `PR.AllName = "${playerName2}"`,
              join_on: 'PR.OverviewPage=P.OverviewPage',
              limit: 1
            })
            
            // If join query returns no results, try direct query
            if (results.length === 0) {
              console.log(`[Leaguepedia] Join query returned no results, trying direct query`)
              results = await queryCargoAPI({
                tables: 'Players',
                fields: ['Players.ID', 'Players.Name', 'Players.Team', 'Players.Role', 'Players.Country', 'Players.Birthdate', 'Players.Residency'],
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
                'SP.Result',
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
                  'ScoreboardPlayers.Result',
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
        
        const transformedMatches = results.map(match => {
          // Handle Result field: "1" = win, "0" = loss
          const result = match.Result || match.result || match.Win || match.win || ''
          const win = result === '1' || result === 1 || result === 'W' || result === 'Win' ||
                     match.Win === '1' || match.Win === 1 || match.win === '1' || match.win === 1
          
          return {
            champion: match.Champion || match.champion || '',
            win: win,
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
          }
        })
        
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
            fields: ['Players.ID', 'Players.Name', 'Players.Team', 'Players.Role', 'Players.Country', 'Players.Residency'],
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


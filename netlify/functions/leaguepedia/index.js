const axios = require('axios')

// Helper function to query Leaguepedia Cargo API directly
// Uses api.php?action=cargoquery (same as the working example)
async function queryCargoAPI({ tables, fields, where, join_on, group_by, order_by, limit }) {
  const baseUrl = 'https://lol.fandom.com/api.php'
  
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
  
  // Build query parameters - use api.php format like the working example
  const params = new URLSearchParams({
    action: 'cargoquery',
    format: 'json',
    origin: '*', // Essential for CORS
    tables: tablesParam,
    fields: fieldsParam
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
    timeout: 30000
  })
  
  // Parse Cargo API response
  // Format: { "cargoquery": [{ "title": { "field": "value" } }] }
  if (response.data && response.data.cargoquery && Array.isArray(response.data.cargoquery)) {
    return response.data.cargoquery.map(item => item.title || item)
  }
  
  // Handle errors
  if (response.data && response.data.error) {
    console.error(`[Leaguepedia] API error:`, response.data.error)
    return []
  }
  
  // Fallback: if response is already an array or different structure
  if (Array.isArray(response.data)) {
    return response.data
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
        // Query champion pool using server-side aggregation with PlayerRedirects join
        // Based on implementation guide: https://lol.fandom.com/wiki/Special:ApiSandbox
        const playerName1 = params.playerName
        const year = params.year || new Date().getFullYear() // Default to current year
        
        // Validate year
        const currentYear = new Date().getFullYear()
        if (year < 2011 || year > currentYear + 1) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: `Year must be between 2011 and ${currentYear + 1}`
            })
          }
        }
        
        console.log(`[Leaguepedia] getPlayerChampionPool query for player: "${playerName1}", year: ${year}`)
        
        try {
          // Validate player name
          if (!playerName1 || !playerName1.trim()) {
            throw new Error('Player name is required')
          }
          
          const startDate = `${year}-01-01 00:00:00`
          const endDate = `${year}-12-31 23:59:59`
          
          // Use server-side aggregation with PlayerRedirects for name resolution
          // This matches the implementation guide exactly - field names have spaces
          // Try with PR.OverviewPage first (matches wiki page name)
          let queryParams = {
            action: 'cargoquery',
            format: 'json',
            tables: 'ScoreboardPlayers=SP,ScoreboardGames=SG,PlayerRedirects=PR',
            join_on: 'SP.GameId=SG.GameId,SP.Link=PR.AllName',
            fields: 'SP.Champion,COUNT(*)=Games,SUM(CASE WHEN SP.Side = SG.Winner THEN 1 ELSE 0 END)=Wins,SUM(SP.Kills)=Total kills,SUM(SP.Deaths)=Total deaths,SUM(SP.Assists)=Total assists',
            where: `PR.OverviewPage = "${playerName1}" AND SG.DateTime_UTC >= "${startDate}" AND SG.DateTime_UTC <= "${endDate}"`,
            group_by: 'SP.Champion',
            order_by: 'Games DESC',
            limit: 500
          }
          
          console.log(`[Leaguepedia] First attempt: Using PR.OverviewPage = "${playerName1}"`)
          
          // Note: Field names with spaces are returned as-is by Cargo API
          // Access using bracket notation: match['Total kills']
          
          // Build URL with encoded params
          const baseUrl = 'https://lol.fandom.com/api.php'
          let url = `${baseUrl}?${new URLSearchParams(queryParams).toString()}`
          
          console.log(`[Leaguepedia] Query URL: ${url.substring(0, 200)}...`)
          
          let response = await axios.get(url, {
            headers: { 
              'User-Agent': 'Mozilla/5.0 (compatible; LeaguepediaBot/1.0)',
              'Accept': 'application/json'
            },
            timeout: 30000
          })
          
          console.log(`[Leaguepedia] Response status: ${response.status}`)
          
          // Parse Cargo API response
          console.log(`[Leaguepedia] Response data keys:`, response.data ? Object.keys(response.data) : 'no data')
          console.log(`[Leaguepedia] Response cargoquery exists:`, response.data?.cargoquery ? 'yes' : 'no')
          console.log(`[Leaguepedia] Response cargoquery type:`, Array.isArray(response.data?.cargoquery) ? 'array' : typeof response.data?.cargoquery)
          
          if (response.data && response.data.cargoquery && Array.isArray(response.data.cargoquery)) {
            results = response.data.cargoquery.map(item => item.title || item)
            console.log(`[Leaguepedia] Query successful, got ${results.length} champions`)
            
            if (results.length > 0) {
              console.log(`[Leaguepedia] First result sample:`, JSON.stringify(results[0]).substring(0, 300))
            } else {
              console.log(`[Leaguepedia] Empty results with PR.OverviewPage, trying PR.AllName instead`)
              // Try alternative: use PR.AllName in WHERE clause
              queryParams.where = `PR.AllName = "${playerName1}" AND SG.DateTime_UTC >= "${startDate}" AND SG.DateTime_UTC <= "${endDate}"`
              url = `${baseUrl}?${new URLSearchParams(queryParams).toString()}`
              console.log(`[Leaguepedia] Retry URL: ${url.substring(0, 200)}...`)
              
              response = await axios.get(url, {
                headers: { 
                  'User-Agent': 'Mozilla/5.0 (compatible; LeaguepediaBot/1.0)',
                  'Accept': 'application/json'
                },
                timeout: 30000
              })
              
              if (response.data && response.data.cargoquery && Array.isArray(response.data.cargoquery)) {
                results = response.data.cargoquery.map(item => item.title || item)
                console.log(`[Leaguepedia] Retry successful, got ${results.length} champions`)
              }
              
              if (results.length === 0) {
                console.log(`[Leaguepedia] Still empty - checking if response has error or warnings`)
                if (response.data?.warnings) {
                  console.log(`[Leaguepedia] Warnings:`, JSON.stringify(response.data.warnings))
                }
                if (response.data?.error) {
                  console.log(`[Leaguepedia] Error:`, JSON.stringify(response.data.error))
                }
              }
            }
          } else {
            console.log(`[Leaguepedia] No data found in response`)
            console.log(`[Leaguepedia] Full response structure:`, JSON.stringify(response.data).substring(0, 1000))
            results = []
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
        // Results are now server-side aggregated with fields: Champion, Games, Wins, Total_kills, Total_deaths, Total_assists
        const transformedChampionPool = results.map(match => {
          const games = parseInt(match.Games || match.games || 0) || 0
          const wins = parseInt(match.Wins || match.wins || 0) || 0
          const losses = games - wins
          const winrate = games > 0 ? (wins / games) * 100 : 0
          
          // Total kills/deaths/assists from aggregated data (field names have spaces per implementation guide)
          const totalKills = parseFloat(match['Total kills'] || match['Total Kills'] || match['total kills'] || match.Total_kills || 0) || 0
          const totalDeaths = parseFloat(match['Total deaths'] || match['Total Deaths'] || match['total deaths'] || match.Total_deaths || 0) || 0
          const totalAssists = parseFloat(match['Total assists'] || match['Total Assists'] || match['total assists'] || match.Total_assists || 0) || 0
          
          // Calculate averages per game
          const avgKills = games > 0 ? totalKills / games : 0
          const avgDeaths = games > 0 ? totalDeaths / games : 0
          const avgAssists = games > 0 ? totalAssists / games : 0
          
          // Calculate KDA ratio
          const kdaRatio = avgDeaths > 0 ? (avgKills + avgAssists) / avgDeaths : (avgKills + avgAssists)
          
          const championData = {
            championName: match.Champion || match.championName || match.champion || '',
            games,
            wins,
            losses,
            winrate: Math.round(winrate * 10) / 10 // Round to 1 decimal
          }
          
          // Add KDA if available
          if (totalKills > 0 || totalDeaths > 0 || totalAssists > 0) {
            championData.kda = {
              kills: Math.round(avgKills * 10) / 10,
              deaths: Math.round(avgDeaths * 10) / 10,
              assists: Math.round(avgAssists * 10) / 10,
              ratio: Math.round(kdaRatio * 100) / 100,
              killParticipation: 0 // Would need team data to calculate
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
          // Query recent matches using the working approach
          const startDate = `2025-01-01 00:00:00`
          const endDate = `2026-01-01 00:00:00`
          
          try {
            // Use ScoreboardGames join for date filtering, SP.Link for player name
            results = await queryCargoAPI({
              tables: 'ScoreboardGames=SG,ScoreboardPlayers=SP',
              fields: [
                'SP.Champion',
                'SP.Result',
                'SG.DateTime_UTC',
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
              where: `SP.Link="${playerName3}" AND SG.DateTime_UTC >= "${startDate}" AND SG.DateTime_UTC < "${endDate}"`,
              join_on: 'SG.GameId=SP.GameId',
              order_by: 'SG.DateTime_UTC DESC',
              limit: limit
            })
            
            // If no results, try with PlayerRedirects join
            if (results.length === 0) {
              console.log(`[Leaguepedia] No results with Link field, trying PlayerRedirects join`)
              results = await queryCargoAPI({
                tables: 'ScoreboardGames=SG,ScoreboardPlayers=SP,PlayerRedirects=PR',
                fields: [
                  'SP.Champion',
                  'SP.Result',
                  'SG.DateTime_UTC',
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
                where: `PR.AllName = "${playerName3}" AND SG.DateTime_UTC >= "${startDate}" AND SG.DateTime_UTC < "${endDate}"`,
                join_on: 'SG.GameId=SP.GameId,SP.Link=PR.AllName',
                order_by: 'SG.DateTime_UTC DESC',
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
          // Handle Result field: "Win" or "Loss" (as shown in working example)
          const result = match.Result || match.result || ''
          const win = result === 'Win' || result === 'win' || result === 'W'
          
          return {
            champion: match.Champion || match.champion || '',
            win: win,
            date: match.DateTime_UTC || match.Date || match.date || '',
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


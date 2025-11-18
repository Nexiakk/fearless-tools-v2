const { CargoClient } = require('poro')

const cargo = new CargoClient()

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
    const { action, playerName, limit } = JSON.parse(event.body)

    if (!action || !playerName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'action and playerName are required' })
      }
    }

    let result

    switch (action) {
      case 'getChampionPool':
        const matches = await cargo.query({
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
        
        result = matches.map(match => ({
          championName: match.Champion,
          games: parseInt(match.Games) || 0,
          wins: parseInt(match.Wins) || 0,
          losses: (parseInt(match.Games) || 0) - (parseInt(match.Wins) || 0),
          winrate: match.Games > 0 ? ((parseInt(match.Wins) || 0) / parseInt(match.Games)) * 100 : 0
        }))
        break

      case 'getPlayerInfo':
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
        result = players.length > 0 ? players[0] : null
        break

      case 'getRecentMatches':
        const recentMatches = await cargo.query({
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
          limit: limit || 20
        })
        
        result = recentMatches.map(match => ({
          champion: match.Champion,
          win: match.Win === '1',
          date: match.Date,
          opponent: match.Opponent,
          team: match.Team,
          tournament: match.Tournament
        }))
        break

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action' })
        }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    }
  } catch (error) {
    console.error('Leaguepedia API error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch Leaguepedia data',
        message: error.message 
      })
    }
  }
}


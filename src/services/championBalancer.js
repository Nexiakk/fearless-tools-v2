/**
 * Champion balancing service for distributing champions across roles
 */

export class ChampionBalancer {
  constructor(championsStore) {
    this.championsStore = championsStore
    this.roles = ['top', 'jungle', 'middle', 'bottom', 'support']
    this.placementOrder = [0, 5, 1, 6, 2, 7, 3, 8, 4, 9]
  }

  /**
   * Balance champions across roles and update panel state
   * @param {string[]} championNames - Array of champion names to balance
   * @param {Object} panelState - Current panel state to update
   * @param {Function} saveCallback - Callback to trigger save operation
   */
  balanceChampions(championNames, panelState, saveCallback) {
    // Clear all current placements
    this.roles.forEach(role => {
      panelState[role] = Array(10).fill(null)
    })

    if (championNames.length === 0) {
      saveCallback()
      return
    }

    console.log('Balancing champions:', championNames.length, 'champions')

    // Get champion metadata
    const champData = this.buildChampionData(championNames)

    // Infer probable sequence
    const probableSequence = this.inferSequence(championNames, champData)

    // Build champion preferences
    const championsWithPreferences = this.buildPreferences(championNames, champData, probableSequence)

    // Calculate target count per role
    const targetCount = championNames.length >= 10 ? 2 : Math.ceil(championNames.length / this.roles.length)

    // Perform greedy assignment
    const assignments = this.performGreedyAssignment(championsWithPreferences, targetCount)

    // Adjust balance if needed
    this.adjustBalance(assignments, targetCount, champData, championsWithPreferences)

    // Handle extreme imbalances
    this.handleExtremeImbalance(assignments, championsWithPreferences)

    // Place champions in panel
    this.placeChampionsInPanel(assignments, panelState, championNames.length)

    saveCallback()
  }

  buildChampionData(championNames) {
    const champData = {}

    championNames.forEach(champName => {
      const champion = this.championsStore.allChampions.find(c => c.name === champName)
      if (champion) {
        const possibleRoles = new Set()
        if (champion.mainRole && this.roles.includes(champion.mainRole)) {
          possibleRoles.add(champion.mainRole)
        }
        if (champion.roles && Array.isArray(champion.roles)) {
          champion.roles.forEach(r => {
            if (r && this.roles.includes(r)) {
              possibleRoles.add(r)
            }
          })
        }
        champData[champName] = {
          mainRole: champion.mainRole && this.roles.includes(champion.mainRole) ? champion.mainRole : null,
          possibleRoles: Array.from(possibleRoles)
        }
      } else {
        // Champion not found in store - use all roles as fallback
        champData[champName] = {
          mainRole: null,
          possibleRoles: [...this.roles]
        }
      }
    })

    return champData
  }

  inferSequence(championNames, champData) {
    const forwardSequence = this.roles
    const reverseSequence = [...this.roles].reverse()

    let forwardMatches = 0
    let reverseMatches = 0

    championNames.forEach((champName, index) => {
      const champ = champData[champName]
      if (!champ) return

      const forwardRole = forwardSequence[index % forwardSequence.length]
      const reverseRole = reverseSequence[index % reverseSequence.length]

      if (champ.possibleRoles.includes(forwardRole)) forwardMatches++
      if (champ.possibleRoles.includes(reverseRole)) reverseMatches++
    })

    return forwardMatches >= reverseMatches ? forwardSequence : reverseSequence
  }

  buildPreferences(championNames, champData, probableSequence) {
    const probableRoles = {}
    championNames.forEach((champName, index) => {
      probableRoles[champName] = probableSequence[index % probableSequence.length]
    })

    const championsWithPreferences = championNames.map(champName => {
      const champ = champData[champName]
      if (!champ || champ.possibleRoles.length === 0) {
        return {
          name: champName,
          preferences: [...this.roles],
          possibleRolesCount: this.roles.length
        }
      }

      const preferences = []

      // 1. Add inferred probable role if possible
      const inferredRole = probableRoles[champName]
      if (inferredRole && champ.possibleRoles.includes(inferredRole) && !preferences.includes(inferredRole)) {
        preferences.push(inferredRole)
      }

      // 2. Add mainRole if not already included
      if (champ.mainRole && champ.possibleRoles.includes(champ.mainRole) && !preferences.includes(champ.mainRole)) {
        preferences.push(champ.mainRole)
      }

      // 3. Add remaining possibleRoles
      champ.possibleRoles.forEach(role => {
        if (!preferences.includes(role)) {
          preferences.push(role)
        }
      })

      return {
        name: champName,
        preferences,
        possibleRolesCount: champ.possibleRoles.length
      }
    })

    // Sort by number of possibleRoles (fewest first)
    championsWithPreferences.sort((a, b) => a.possibleRolesCount - b.possibleRolesCount)

    return championsWithPreferences
  }

  performGreedyAssignment(championsWithPreferences, targetCount) {
    const assignments = {}
    const counts = {}

    this.roles.forEach(role => {
      assignments[role] = []
      counts[role] = 0
    })

    championsWithPreferences.forEach(champ => {
      let assigned = false

      // Try first preference where count < targetCount
      for (const preferredRole of champ.preferences) {
        if (counts[preferredRole] < targetCount) {
          assignments[preferredRole].push(champ.name)
          counts[preferredRole]++
          assigned = true
          break
        }
      }

      // If no preference available, try any possible role with space
      if (!assigned) {
        for (const role of champ.preferences) {
          if (counts[role] < targetCount) {
            assignments[role].push(champ.name)
            counts[role]++
            assigned = true
            break
          }
        }
      }

      // Final fallback: assign to role with fewest champions
      if (!assigned) {
        let bestRole = null
        let minCount = Infinity
        for (const role of champ.preferences) {
          if (counts[role] < minCount) {
            minCount = counts[role]
            bestRole = role
          }
        }
        if (bestRole) {
          assignments[bestRole].push(champ.name)
          counts[bestRole]++
        } else if (champ.preferences.length > 0) {
          assignments[champ.preferences[0]].push(champ.name)
          counts[champ.preferences[0]]++
        }
      }
    })

    return { assignments, counts }
  }

  adjustBalance(assignments, targetCount, champData, championsWithPreferences) {
    const counts = {}
    this.roles.forEach(role => {
      counts[role] = assignments[role].length
    })

    const overfilled = []
    const underfilled = []

    this.roles.forEach(role => {
      if (counts[role] > targetCount) {
        overfilled.push(role)
      } else if (counts[role] < targetCount) {
        underfilled.push(role)
      }
    })

    // Move champions from overfilled to underfilled roles
    overfilled.forEach(overRole => {
      const champsToMove = [...assignments[overRole]]

      for (const champName of champsToMove) {
        if (counts[overRole] <= targetCount) break

        const champ = champData[champName]
        if (!champ) continue

        // Try to move to an underfilled role
        for (const underRole of underfilled) {
          if (champ.possibleRoles.includes(underRole) && counts[underRole] < targetCount) {
            assignments[overRole] = assignments[overRole].filter(n => n !== champName)
            assignments[underRole].push(champName)
            counts[overRole]--
            counts[underRole]++

            // Update underfilled list
            if (counts[underRole] >= targetCount) {
              underfilled.splice(underfilled.indexOf(underRole), 1)
            }
            break
          }
        }
      }
    })
  }

  handleExtremeImbalance(assignments, championsWithPreferences) {
    const counts = {}
    this.roles.forEach(role => {
      counts[role] = assignments[role].length
    })

    const hasExtremeImbalance = this.roles.some(role => counts[role] === 0 || counts[role] > 3)

    if (hasExtremeImbalance) {
      // Clear and redistribute
      this.roles.forEach(role => {
        assignments[role] = []
        counts[role] = 0
      })

      let roleIndex = 0
      championsWithPreferences.forEach(champ => {
        let assigned = false

        // Try round-robin through roles
        for (let i = 0; i < this.roles.length; i++) {
          const role = this.roles[(roleIndex + i) % this.roles.length]
          if (champ.preferences.includes(role) && counts[role] < 3) {
            assignments[role].push(champ.name)
            counts[role]++
            roleIndex = (roleIndex + i + 1) % this.roles.length
            assigned = true
            break
          }
        }

        // If still not assigned, use any possible role
        if (!assigned) {
          for (let i = 0; i < this.roles.length; i++) {
            const role = this.roles[(roleIndex + i) % this.roles.length]
            if (champ.preferences.includes(role)) {
              assignments[role].push(champ.name)
              counts[role]++
              roleIndex = (roleIndex + i + 1) % this.roles.length
              break
            }
          }
        }
      })
    }
  }

  placeChampionsInPanel(assignments, panelState, totalChampions) {
    let totalPlaced = 0
    this.roles.forEach(role => {
      assignments[role].forEach((champName, idx) => {
        if (idx < this.placementOrder.length) {
          panelState[role][this.placementOrder[idx]] = champName
          totalPlaced++
        }
      })
    })

    console.log('Placed champions:', totalPlaced, 'out of', totalChampions)
    if (totalPlaced !== totalChampions) {
      console.warn('Not all champions were placed!', {
        total: totalChampions,
        placed: totalPlaced,
        assignments
      })
    }
  }
}

const axios = require('axios')
const cheerio = require('cheerio')

/**
 * Headless browser scraping using Browserless.io (free tier: 6 hours/month)
 * Alternative: Can use ScrapingBee, ScraperAPI, or other services
 * 
 * Free tier options:
 * - Browserless.io: 6 hours/month free
 * - ScrapingBee: 1000 requests/month free
 * - ScraperAPI: 1000 requests/month free
 */

// Get API key from environment variable (set in Netlify dashboard)
// For Browserless.io: Sign up at https://www.browserless.io/ (free tier available)
const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY || ''
// Browserless.io endpoint format: https://production-<region>.browserless.io/content
// Regions: sfo (San Francisco), ams (Amsterdam), etc.
// Default to sfo if not specified
const BROWSERLESS_URL = process.env.BROWSERLESS_URL || 'https://production-sfo.browserless.io/content'

// Alternative: ScrapingBee (uncomment to use instead)
// const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || ''
// const SCRAPINGBEE_URL = 'https://app.scrapingbee.com/api/v1'

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { playerName, region, tag, championsUrl } = JSON.parse(event.body)
    
    let url = championsUrl
    if (!url.includes('/champions')) {
      url = url.replace(/\/$/, '') + '/champions'
    }

    console.log(`[Headless] Fetching URL: ${url}`)

    // Browserless.io is currently disabled due to op.gg bot detection blocking
    // op.gg returns 403 errors for Browserless.io requests
    // Use the regular scraper (scoutOpgg) instead
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: 'Headless browser scraping is currently disabled',
        message: 'Browserless.io is being blocked by op.gg (403 errors). Please use the regular scraper instead by disabling "Use Headless Browser" in the admin panel.',
        hint: 'Toggle off "Use Headless Browser for Scraping" in the Admin Panel settings'
      })
    }

  } catch (error) {
    console.error('[Headless] Scraping error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to scrape with headless browser',
        message: error.message
      })
    }
  }
}


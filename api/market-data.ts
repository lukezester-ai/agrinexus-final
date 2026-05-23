import type { VercelRequest, VercelResponse } from '@vercel/node';
import { yahooFinance } from './yahoo-finance-client.js';

// Cache results for 15 minutes to avoid rate limits
let cachedData: any = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 15 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const now = Date.now();

  if (cachedData && (now - lastFetchTime < CACHE_DURATION_MS)) {
    return res.status(200).json(cachedData);
  }

  try {
    // Fetch live commodity data
    // ZW=F : Chicago SRW Wheat Futures
    // ZC=F : Corn Futures
    const symbols = ['ZW=F', 'ZC=F', 'ZS=F', 'ZL=F'];
    
    const results = await yahooFinance.quote(symbols);
    
    const marketData = results.map(quote => ({
      symbol: quote.symbol,
      name: quote.shortName || quote.longName,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      currency: quote.currency
    }));

    cachedData = {
      timestamp: new Date().toISOString(),
      data: marketData
    };
    lastFetchTime = now;

    return res.status(200).json(cachedData);
  } catch (error) {
    console.error("Error fetching market data:", error);
    
    // Fallback data if API fails
    const fallbackData = {
      timestamp: new Date().toISOString(),
      isFallback: true,
      data: [
        {
          symbol: "ZW=F",
          name: "Wheat Futures",
          price: 540.25,
          change: 5.50,
          changePercent: 1.02,
          currency: "USD"
        },
        {
          symbol: "ZC=F",
          name: "Corn Futures",
          price: 430.50,
          change: -2.25,
          changePercent: -0.52,
          currency: "USD"
        },
        {
          symbol: "ZS=F",
          name: "Soybean Futures",
          price: 1020,
          change: 0,
          changePercent: 0,
          currency: "USD"
        },
        {
          symbol: "ZL=F",
          name: "Soybean Oil",
          price: 48,
          change: 0,
          changePercent: 0,
          currency: "USD"
        }
      ]
    };
    
    return res.status(200).json(fallbackData);
  }
}

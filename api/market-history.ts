import type { VercelRequest, VercelResponse } from '@vercel/node';
import { yahooFinance } from './yahoo-finance-client.js';

// Cache results for 1 hour to avoid rate limits on historical data
let cachedHistory: any = {};
let lastFetchTime: any = {};
const CACHE_DURATION_MS = 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const symbol = (req.query.symbol as string) || 'ZW=F'; // Default to Wheat
  const now = Date.now();

  if (cachedHistory[symbol] && (now - lastFetchTime[symbol] < CACHE_DURATION_MS)) {
    return res.status(200).json(cachedHistory[symbol]);
  }

  try {
    const period2 = new Date();
    const period1 = new Date();
    period1.setDate(period1.getDate() - 30);

    const result = await yahooFinance.historical(symbol, {
      period1,
      period2,
      interval: '1d',
    });

    // Filter to only include date and close price to save bandwidth
    const formattedData = result
      .filter((item) => item.close != null && Number.isFinite(Number(item.close)))
      .map((item) => ({
        date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date).slice(0, 10),
        price: Number(Number(item.close).toFixed(2)),
      }));

    if (!formattedData.length) {
      throw new Error('Empty formatted history');
    }

    const responseData = {
      symbol,
      data: formattedData
    };

    cachedHistory[symbol] = responseData;
    lastFetchTime[symbol] = now;

    return res.status(200).json(responseData);
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error);
    
    // Fallback mock data
    const mockData = [];
    let startPrice = symbol === 'ZW=F' ? 530 : 420;
    const today = new Date();
    for (let i = 30; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        startPrice = startPrice + (Math.random() * 10 - 5);
        mockData.push({
            date: d.toISOString().split('T')[0],
            price: Number(startPrice.toFixed(2))
        });
    }

    return res.status(200).json({ symbol, data: mockData, isFallback: true });
  }
}

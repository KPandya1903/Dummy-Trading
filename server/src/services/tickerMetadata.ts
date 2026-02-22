import { SP500_BY_TICKER } from '../data/sp500.js';

export function getSector(ticker: string): string {
  return SP500_BY_TICKER.get(ticker.toUpperCase())?.sector || 'Other';
}

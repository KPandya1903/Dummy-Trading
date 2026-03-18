import prisma from '../../prisma.js';
import { getCurrentPrices } from '../market/priceService.js';

/**
 * Checks all watchlist items with alert thresholds and marks them as triggered
 * when the current price crosses the threshold.
 */
export async function checkAlerts(): Promise<void> {
  // Find items that have alerts set and haven't been triggered
  const items = await prisma.watchlistItem.findMany({
    where: {
      alertTriggered: false,
      OR: [
        { alertAbove: { not: null } },
        { alertBelow: { not: null } },
      ],
    },
  });

  if (items.length === 0) return;

  const tickers = [...new Set(items.map((i) => i.ticker))];
  const prices = await getCurrentPrices(tickers);

  for (const item of items) {
    const price = prices[item.ticker];
    if (!price) continue;

    let triggered = false;

    if (item.alertAbove !== null && price >= item.alertAbove) {
      triggered = true;
    }
    if (item.alertBelow !== null && price <= item.alertBelow) {
      triggered = true;
    }

    if (triggered) {
      await prisma.watchlistItem.update({
        where: { id: item.id },
        data: { alertTriggered: true },
      });
    }
  }
}

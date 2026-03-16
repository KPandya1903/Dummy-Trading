import prisma from '../prisma.js';
import { getCurrentPrices } from './priceService.js';

export function shouldFillOrder(
  orderType: 'LIMIT' | 'STOP',
  side: 'BUY' | 'SELL',
  currentPrice: number,
  targetPrice: number,
): boolean {
  if (orderType === 'LIMIT' && side === 'BUY')  return currentPrice <= targetPrice;
  if (orderType === 'LIMIT' && side === 'SELL') return currentPrice >= targetPrice;
  if (orderType === 'STOP'  && side === 'SELL') return currentPrice <= targetPrice;
  if (orderType === 'STOP'  && side === 'BUY')  return currentPrice >= targetPrice;
  return false;
}

/**
 * Checks all PENDING orders and fills any that meet their trigger condition.
 * Runs on a setInterval in the server entry point.
 */
export async function checkPendingOrders(): Promise<void> {
  const pending = await prisma.pendingOrder.findMany({
    where: { status: 'PENDING' },
    include: { portfolio: true },
  });

  if (pending.length === 0) return;

  const tickers = [...new Set(pending.map((o) => o.ticker))];
  const prices = await getCurrentPrices(tickers);

  for (const order of pending) {
    const currentPrice = prices[order.ticker];
    if (!currentPrice) continue;

    if (shouldFillOrder(order.orderType, order.side, currentPrice, order.targetPrice)) {
      await prisma.$transaction([
        prisma.trade.create({
          data: {
            portfolioId: order.portfolioId,
            ticker: order.ticker,
            side: order.side,
            quantity: order.quantity,
            price: currentPrice,
          },
        }),
        prisma.pendingOrder.update({
          where: { id: order.id },
          data: { status: 'FILLED', filledAt: new Date() },
        }),
      ]);
      console.log(
        `Order #${order.id} filled: ${order.side} ${order.quantity} × ${order.ticker} @ $${currentPrice.toFixed(2)}`,
      );
    }
  }
}

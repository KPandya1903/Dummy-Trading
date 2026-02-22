import prisma from '../prisma.js';
import { getCurrentPrices } from './priceService.js';

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

    let shouldFill = false;

    if (order.orderType === 'LIMIT' && order.side === 'BUY') {
      // Fill if market price drops to or below limit
      shouldFill = currentPrice <= order.targetPrice;
    } else if (order.orderType === 'LIMIT' && order.side === 'SELL') {
      // Fill if market price rises to or above limit
      shouldFill = currentPrice >= order.targetPrice;
    } else if (order.orderType === 'STOP' && order.side === 'SELL') {
      // Stop-loss: fill if market price drops to or below stop price
      shouldFill = currentPrice <= order.targetPrice;
    } else if (order.orderType === 'STOP' && order.side === 'BUY') {
      // Stop-buy: fill if market price rises to or above stop price
      shouldFill = currentPrice >= order.targetPrice;
    }

    if (shouldFill) {
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

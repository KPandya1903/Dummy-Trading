import prisma from '../../prisma.js';
import { getCurrentPrices } from '../market/priceService.js';
import { checkSufficientShares, checkSufficientCash } from './tradeValidation.js';

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

    if (shouldFillOrder(order.orderType as 'LIMIT' | 'STOP', order.side as 'BUY' | 'SELL', currentPrice, order.targetPrice)) {
      // Re-validate position/cash before filling (state may have changed since order was placed)
      const existingTrades = await prisma.trade.findMany({
        where: { portfolioId: order.portfolioId },
        orderBy: { executedAt: 'asc' },
        select: { ticker: true, side: true, quantity: true, price: true },
      });
      const tradeInputs = existingTrades.map((t) => ({
        ticker: t.ticker,
        side: t.side as 'BUY' | 'SELL',
        quantity: t.quantity,
        price: t.price,
      }));

      if (order.side === 'SELL') {
        const sharesError = checkSufficientShares(tradeInputs, order.ticker, order.quantity);
        if (sharesError) {
          console.log(`Order #${order.id} skipped (insufficient shares): ${sharesError}`);
          continue;
        }
      } else {
        const cashError = checkSufficientCash(tradeInputs, order.portfolio.startingCash, currentPrice, order.quantity);
        if (cashError) {
          console.log(`Order #${order.id} skipped (insufficient cash): ${cashError}`);
          continue;
        }
      }

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

import app from './app.js';
import { checkPendingOrders } from './services/trading/orderService.js';
import { checkAlerts } from './services/social/alertService.js';
import { getMarketData, warmMarketCaps, warmFundamentals } from './services/market/marketService.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Check pending limit/stop orders every 60 seconds
  setInterval(() => {
    checkPendingOrders().catch((err) =>
      console.error('Order check failed:', err),
    );
  }, 60_000);

  // Check watchlist alerts every 60 seconds
  setInterval(() => {
    checkAlerts().catch((err) =>
      console.error('Alert check failed:', err),
    );
  }, 60_000);

  // Warm market caps + fundamentals from Yahoo (24h cache), then pre-warm prices
  warmMarketCaps()
    .then(() => warmFundamentals())
    .then(() => getMarketData())
    .catch((err) => console.error('Initial market cache warm failed:', err));

  // Refresh prices every 30 seconds (Alpaca is real-time)
  setInterval(() => {
    getMarketData().catch((err) =>
      console.error('Market cache refresh failed:', err),
    );
  }, 30_000);

  // Refresh market caps once every 24 hours
  setInterval(() => {
    warmMarketCaps().catch((err) =>
      console.error('Market cap refresh failed:', err),
    );
  }, 24 * 60 * 60_000);
});

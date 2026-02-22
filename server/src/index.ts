import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.routes.js';
import portfolioRoutes from './routes/portfolio.routes.js';
import tradeRoutes from './routes/trade.routes.js';
import watchlistRoutes from './routes/watchlist.routes.js';
import leaderboardRoutes from './routes/leaderboard.routes.js';
import marketRoutes from './routes/market.routes.js';
import groupRoutes from './routes/group.routes.js';
import orderRoutes from './routes/order.routes.js';
import quoteRoutes from './routes/quote.routes.js';
import alertRoutes from './routes/alert.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import badgeRoutes from './routes/badge.routes.js';
import classifierRoutes from './routes/marketClassifiers.routes.js';
import compareRoutes from './routes/compare.routes.js';
import analysisRoutes from './routes/analysis.routes.js';
import predictRoutes from './routes/predict.routes.js';
import newsRoutes from './routes/news.routes.js';
import geminiRoutes from './routes/gemini.routes.js';
import searchRoutes from './routes/search.routes.js';
import researchRoutes from './routes/research.routes.js';
import { checkPendingOrders } from './services/orderService.js';
import { checkAlerts } from './services/alertService.js';
import { getMarketData, warmMarketCaps, warmFundamentals } from './services/marketService.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Routes ───────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/portfolios', portfolioRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/market/classifiers', classifierRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/predict', predictRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/research', researchRoutes);

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

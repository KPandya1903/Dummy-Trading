import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { warmMarketCaps, warmFundamentals } from './services/market/marketService.js';

// ── Auth ──
import authRoutes from './routes/auth/auth.routes.js';
import userRoutes from './routes/auth/user.routes.js';

// ── Trading ──
import portfolioRoutes from './routes/trading/portfolio.routes.js';
import tradeRoutes from './routes/trading/trade.routes.js';
import orderRoutes from './routes/trading/order.routes.js';
import optionsRoutes from './routes/trading/options.routes.js';

// ── Market ──
import marketRoutes from './routes/market/market.routes.js';
import regimeRoutes from './routes/market/marketRegime.routes.js';
import classifierRoutes from './routes/market/marketClassifiers.routes.js';
import quoteRoutes from './routes/market/quote.routes.js';
import searchRoutes from './routes/market/search.routes.js';

// ── Analysis ──
import analysisRoutes from './routes/analysis/analysis.routes.js';
import compareRoutes from './routes/analysis/compare.routes.js';
import factorRoutes from './routes/analysis/factors.routes.js';
import screenerRoutes from './routes/analysis/screener.routes.js';
import predictRoutes from './routes/analysis/predict.routes.js';
import valuationRoutes from './routes/analysis/valuation.routes.js';

// ── Social ──
import groupRoutes from './routes/social/group.routes.js';
import leaderboardRoutes from './routes/social/leaderboard.routes.js';
import badgeRoutes from './routes/social/badge.routes.js';

// ── Alerts ──
import alertRoutes from './routes/alerts/alert.routes.js';
import watchlistRoutes from './routes/alerts/watchlist.routes.js';

// ── Content ──
import newsRoutes from './routes/content/news.routes.js';
import geminiRoutes from './routes/content/gemini.routes.js';
import researchRoutes from './routes/content/research.routes.js';

// ── Other ──
import dashboardRoutes from './routes/dashboard.routes.js';
import cronRoutes from './routes/cron.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

// Warm caches on cold start (fire-and-forget — so every Vercel container has market cap data)
warmMarketCaps().then(() => warmFundamentals()).catch(console.error);

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
app.use('/api/market/regime', regimeRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/options', optionsRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/factors', factorRoutes);
app.use('/api/predict', predictRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/screener', screenerRoutes);
app.use('/api/valuation', valuationRoutes);
app.use('/api/users', userRoutes);

export default app;

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
import factorRoutes from './routes/factors.routes.js';
import predictRoutes from './routes/predict.routes.js';
import regimeRoutes from './routes/marketRegime.routes.js';
import newsRoutes from './routes/news.routes.js';
import geminiRoutes from './routes/gemini.routes.js';
import searchRoutes from './routes/search.routes.js';
import researchRoutes from './routes/research.routes.js';
import cronRoutes from './routes/cron.routes.js';
import screenerRoutes from './routes/screener.routes.js';
import valuationRoutes from './routes/valuation.routes.js';
import userRoutes from './routes/user.routes.js';

const app = express();

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
app.use('/api/market/regime', regimeRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/orders', orderRoutes);
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

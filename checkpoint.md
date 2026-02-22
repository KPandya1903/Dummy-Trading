# Build Checkpoint - Dummy Trading App

Progress log of each implementation step.

---

## Step 1: Project Bootstrap (Monorepo + Stack)

Scaffolded npm workspaces monorepo with `server/` (Express + Prisma + tsx) and `client/` (React + Vite + MUI). ESM throughout, Vite proxy for `/api/*`.

## Step 2: Database Schema (Postgres + Prisma)

User, Portfolio, Trade, WatchlistItem models. TradeSide enum, cascade deletes, unique constraints, FK indexes.

## Step 3: Backend API Scaffolding

Auth, portfolio, trade, watchlist routes mounted under `/api/`. Prisma queries for CRUD operations.

## Step 4: Portfolio Calculation Logic

Pure `buildPositions()` and `computeSummary()` functions. Weighted-average cost basis, realized/unrealized P&L. 12 Jest test cases.

## Step 5: Price Service (Stubbed)

Hash-based deterministic fake prices ($20-$500). Clear integration point for real providers.

## Step 6: React App Bootstrap

6 routes, Layout with AppBar, Axios wrapper with auth interceptor. Login, portfolios, trades, watchlist pages.

## Step 7: Frontend Data Fetching

Reusable `useApi` hook with loading/error states. MUI Dialogs for creation flows, PnLCell with color coding.

## Step 8: Trade Form + Validation

Standalone `TradeForm` component with inline field validation, server error handling, success confirmation.

## Step 9: Watchlist UI

"Paper Buy" flow from watchlist to trade via dialog. Portfolio picker for multi-portfolio users.

## Step 10: Learning-Focused Features

Trade journaling: BUY requires reasoning note, post-trade review with reflection prompts. Reviewed trades get visual distinction.

## Step 11: Real Authentication (bcrypt + JWT)

Replaced stub auth. bcrypt hashing, JWT tokens (7-day expiry), `authenticate` middleware, ownership checks on all endpoints.

## Step 12: Delete Endpoints

DELETE for portfolios (cascade), trades, and watchlist items with confirmation dialogs.

## Step 13: Price Service Improvement

BASE_PRICES map for 12 well-known tickers at realistic prices. Daily variation via date-seeded hash.

## Step 14: Portfolio Performance Chart

`computeHistory()` replays trades chronologically. Recharts LineChart with starting cash reference line.

## Step 15: Leaderboard

Global portfolio ranking by return %. Gold trophy for #1, color-coded returns.

## Step 16: Deployment Configuration

Docker multi-stage builds for server + client. nginx SPA fallback + API proxy. docker-compose with PostgreSQL.

---

## Step 17: Live Market Data (Yahoo Finance + Alpaca)

- Replaced stub price service with Alpaca real-time quotes (30s refresh interval)
- Yahoo Finance v3 for historical data and company fundamentals
- Market data caching service with 24h cache for market caps
- S&P 500 companies as browsable market page with sort/filter/search
- 10 market classifier tiles (gainers, losers, most active, highest market cap, most volatile, sector leaders, 52-week high, highest dividend, lowest P/E, momentum leaders)
- Quote endpoint with 5-minute cache and 1-year price history
- Universal stock search via Yahoo Finance (any ticker, not just S&P 500)
- Scrolling ticker tape component with real-time prices

## Step 18: Groups & Competitions

- Group model with join codes, configurable rules (max trades/day, allowed tickers, date ranges)
- GroupMembership with OWNER/MEMBER roles
- Group-linked portfolios with constraint enforcement on trades
- Group leaderboards and detail pages

## Step 19: Orders, Alerts, Badges

- Pending limit/stop orders with automatic 60-second fill checking
- Watchlist price alerts (above/below thresholds) with 60-second monitoring
- 7 badges: FIRST_TRADE, DIVERSIFIER, TEN_PERCENT, BEAT_MARKET, DAY_TRADER, DIAMOND_HANDS, FULL_PORTFOLIO
- Badge checking triggered on trade execution

## Step 20: Dashboard & Portfolio Enhancements

- Dashboard aggregate endpoint: holdings, leaderboard rank, top trades, performance chart
- Portfolio history with S&P 500 benchmark overlay
- Trade CSV export
- Sector allocation and diversification pie charts

## Step 21: Technical Analysis

- RSI(14), MACD(12/26/9), Bollinger Bands(20,2), SMA(20/50/200), EMA(12/26) via `trading-signals` library
- Configurable period: 3M, 6M, 1Y, 2Y, 5Y
- Analysis landing page with stock search
- Interactive multi-panel charts with Recharts

## Step 22: ML Price Prediction (Initial)

- 3 basic models: Linear Regression (regression npm), Moving Average (SMA/EMA blend), single-layer LSTM (32 units, close-only)
- 7/14/30-day forecast with confidence bands
- Prediction landing page with stock search

## Step 23: AI News & Gemini Integration

- Gemini-powered stock news summaries with sentiment analysis
- Context-aware AI insight panel (technical, fundamental, prediction, news contexts)
- Rate-limited Gemini endpoint with retry logic

## Step 24: Stock Comparison

- Compare up to 5 stocks with normalized percentage returns
- Configurable period: 1W, 1M, 3M, 1Y, 5Y
- Interactive overlay chart

## Step 25: Deep Research Pipeline (Web Scraping + Ollama)

- 10-dimension research: earnings, product launches, sector trends, macro, competitive landscape, supply chain, regulatory, social sentiment, analyst ratings, geopolitical
- Web scraping from Google News RSS, Reddit JSON API, Finviz news tables (cheerio + sentiment)
- Ollama + DeepSeek-R1 8B local LLM for two-pass reasoning (Analyze → Refine)
- Executive summary synthesis with algorithmic fallback if Ollama is down
- SSE streaming for real-time progress updates
- Price correlation per narrative
- Content hash deduplication for incremental research updates

## Step 26: Stacked Ensemble Prediction System

**Goal:** Replace the 3 basic prediction models with a research-grade stacked ensemble.

**Architecture:**
```
                    ┌── Holt-Winters (triple exp. smoothing) ─┐
OHLCV + Indicators  ├── Bidirectional LSTM (48+32 units) ─────┤
    → 23-Feature    ├── GRU (40+20 units, Huber loss) ────────┤──→ Meta-Learner ──→ Ensemble
    Engineering     └── Dense Feature Combiner (128→64→32) ───┘     (learned        + Confidence
                                                                     weights)        + Backtest
```

**New files (11):**
- `server/src/services/prediction/types.ts` — shared interfaces
- `server/src/services/prediction/utils.ts` — normalization, date helpers
- `server/src/services/prediction/featureEngineering.ts` — 23-feature matrix from OHLCV using trading-signals (RSI, MACD, Bollinger %B, SMA/EMA ratios, momentum, volatility, sentiment, day-of-week one-hot, volume ratio, HL range, close position)
- `server/src/services/prediction/baseLearners/exponentialSmoothing.ts` — Holt-Winters with grid-searched α/β/γ (64 combos)
- `server/src/services/prediction/baseLearners/enhancedLstm.ts` — Bidirectional 2-layer LSTM, 30-day window, 23-feature input
- `server/src/services/prediction/baseLearners/gruModel.ts` — 2-layer GRU, 20-day window, Huber loss
- `server/src/services/prediction/baseLearners/featureCombiner.ts` — Dense network (128→64→32→1), 5-day × 23 features flattened
- `server/src/services/prediction/metaLearner.ts` — Level-1 dense network combining 4 base predictions + uncertainties + context features
- `server/src/services/prediction/ensemble.ts` — Orchestrator: parallel base learners with 30s timeout, meta-learner, fallback
- `server/src/services/prediction/backtesting.ts` — Walk-forward validation: RMSE, MAPE, directional accuracy
- `server/src/services/prediction/index.ts` — public exports

**Modified files (3):**
- `server/src/services/predictionService.ts` — replaced 226 lines with re-export from `./prediction/`
- `server/src/routes/predict.routes.ts` — now fetches full OHLCV, queries Prisma for research sentiment, calls `runEnsemble()`
- `client/src/pages/StockPredictionPage.tsx` — gold ensemble line + confidence band on chart, 4 model cards (md={3}), backtest metrics display (dir accuracy, RMSE, MAPE), confidence progress bar, base model weight distribution

**Key details:**
- 4 base learners run in parallel via `Promise.all` (~8-10s dominated by LSTM)
- Meta-learner uses sensitivity analysis to extract approximate model weights
- Backward-compatible API: linearRegression/movingAverage/lstm slots preserved + new ensemble field
- Sentiment integration: queries latest completed Research for ticker, maps bullish→0.8, bearish→0.2, blended by confidence
- Graceful degradation: < 50 candles → minimal features, < 10 rows → flat fallback
- No new npm dependencies (uses existing @tensorflow/tfjs, trading-signals)

**Bugs fixed during review:**
- Operator precedence in metaLearner.ts `learnedWeightedAverage` (`??` vs ternary)
- Tensor memory leaks in `extractWeights` (predict tensors not disposed)
- Removed unused imports across 3 files

---

## Current State

**All 26 steps complete.**

- **Server:** 20 route files, 14 service files, 10 database models
- **Client:** 20+ pages, 12+ components, dark navy/gold theme
- **ML:** Stacked ensemble with 4 base learners + meta-learner + walk-forward backtesting
- **AI:** Gemini for news/insights, Ollama + DeepSeek-R1 for deep research
- **Market Data:** Yahoo Finance historical + Alpaca real-time
- **Type safety:** zero TypeScript errors across both workspaces
- **Auth:** bcrypt + JWT with ownership checks
- **Deployment:** Docker Compose ready

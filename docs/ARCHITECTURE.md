# Dummy Trading — Architecture Diagram & Reference

> **Last Updated:** 2026-03-13 (Session 2 — 7 new features implemented)
> **Purpose:** Living reference for system design, data flows, and feature status.

---

## SYSTEM OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DUMMY TRADING PLATFORM                              │
│                    Paper Trading + Quant Research + AI                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND  (React 18 + Vite + MUI + Recharts)          client/src/                                │
│                                                                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │Dashboard │  │ Trading  │  │ Market   │  │  Charts  │  │   AI /   │  │  Social  │             │
│  │          │  │          │  │ Explorer │  │Technical │  │Research  │  │ Groups   │             │
│  │• P&L     │  │• Buy/Sell│  │• S&P500  │  │• RSI     │  │• News    │  │• Create  │             │
│  │• Positions│  │• Orders  │  │• Search  │  │• MACD    │  │• Insights│  │• Join    │             │
│  │• Perf vs │  │• History │  │• Classify│  │• BB      │  │• Deep    │  │• Compete │             │
│  │  S&P500  │  │• Export  │  │• Quotes  │  │• SMA/EMA │  │  Research│  │• Badges  │             │
│  │• Badges  │  │• Review  │  │• Ticker  │  │• Compare │  │• Predict │  │• Leaderb │             │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘             │
│                                                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐                     │
│  │  apiClient.ts (Axios)  →  /api/* proxy  →  Express Backend              │                     │
│  └─────────────────────────────────────────────────────────────────────────┘                     │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
                                         │ HTTPS
                                         ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│  BACKEND  (Node.js + Express + TypeScript ESM)          server/src/                               │
│                                                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────┐    │
│  │  Express App  (app.ts) — 20+ route modules mounted                                        │    │
│  │                                                                                            │    │
│  │  /auth   /portfolios   /trades   /orders   /watchlist   /alerts   /leaderboard            │    │
│  │  /market  /quotes  /analysis  /predict  /news  /gemini  /research                         │    │
│  │  /compare  /groups  /badges  /dashboard  /cron  /search                                   │    │
│  └──────────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                                    │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────────────────────┐   │
│  │  AUTH LAYER           │  │  BACKGROUND SERVICES  │  │  ML / AI SERVICES                   │   │
│  │  • JWT middleware      │  │  • orderService       │  │  • ensemble.ts (orchestrator)       │   │
│  │  • bcrypt passwords    │  │    (check every 60s)  │  │  • featureEngineering (23 features) │   │
│  │  • 7-day tokens        │  │  • alertService       │  │  • baseLearners:                    │   │
│  └──────────────────────┘  │    (check every 60s)  │  │    - Holt-Winters (exp. smoothing)  │   │
│                              │  • marketService      │  │    - LSTM (bidirectional, 2-layer)  │   │
│                              │    (cache warm)       │  │    - GRU (2-layer, Huber loss)      │   │
│                              └──────────────────────┘  │    - Dense (feature combiner)       │   │
│                                                          │  • metaLearner (stacking L1)        │   │
│  ┌──────────────────────────────────────────────────┐   │  • backtesting (walk-forward)       │   │
│  │  DATA SERVICES                                    │   │  • monteCarlo (confidence bands)    │   │
│  │  • priceService → Alpaca WS + Yahoo Finance       │   │  • groqService (LLM calls)          │   │
│  │  • technicalAnalysisService → trading-signals lib │   │  • researchService (pipeline)       │   │
│  │  • portfolioService → P&L calculations            │   │  • webScraperService (news)         │   │
│  │  • badgeService → achievement unlock logic        │   └──────────────────────────────────────┘   │
│  └──────────────────────────────────────────────────┘                                             │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
                │                           │                        │
                ▼                           ▼                        ▼
┌──────────────────────┐  ┌──────────────────────┐   ┌──────────────────────────────────┐
│  PostgreSQL           │  │  EXTERNAL MARKET DATA │   │  AI / LLM APIS                   │
│  (Supabase / Neon)    │  │                        │   │                                  │
│                        │  │  • Alpaca WebSocket    │   │  • Groq API (primary)            │
│  10 Prisma Models:     │  │    (real-time prices)  │   │    llama-3.3-70b-versatile       │
│  • User               │  │  • Yahoo Finance 2     │   │    14.4k req/day free            │
│  • Portfolio          │  │    (historical OHLCV)  │   │                                  │
│  • Position           │  │    (fundamentals)      │   │  • Ollama (optional, local)      │
│  • Trade              │  │  • Google News RSS     │   │    DeepSeek-R1:8b                │
│  • PendingOrder       │  │  • Reddit search       │   │                                  │
│  • WatchlistItem      │  │  • Finviz scraping     │   │  • Google Gemini (deprecated)    │
│  • Alert              │  └──────────────────────┘   └──────────────────────────────────┘
│  • Group             │
│  • GroupMember       │
│  • Badge             │
│  • ResearchReport    │
│  • ResearchNarrative │
└──────────────────────┘
```

---

## DATA FLOW DIAGRAMS

### 1. Trade Execution Flow
```
User clicks Buy/Sell
        │
        ▼
POST /api/trades
        │
        ├─► Validate: portfolio exists + belongs to user
        ├─► Enforce: group rules (allowed tickers, max trades/day)
        ├─► Fetch: live price via Alpaca → Yahoo Finance fallback
        ├─► Calculate: total cost = qty × price
        ├─► Check: cash balance sufficient (for BUY)
        ├─► Write: Trade record to DB
        ├─► Update: Position (weighted-avg cost basis)
        ├─► Update: Portfolio cash balance
        └─► Trigger: Badge checks (First Trade, Day Trader, etc.)
                │
                ▼
        Return: { trade, newCash, position P&L }
```

### 2. ML Prediction Flow
```
POST /api/predict/:ticker
        │
        ▼
Fetch 1yr OHLCV from Yahoo Finance
        │
        ▼
Feature Engineering (23 features)
  [OHLCV, RSI, MACD, BB%B, SMA ratios, EMA ratios,
   momentum, volatility, sentiment, day-of-week, vol ratio]
        │
        ▼
┌────────────────────────────────────────────────────────────┐
│  4 Base Learners (parallel)                                 │
│                                                             │
│  Holt-Winters  │  BiLSTM (30d)  │  GRU (20d)  │  Dense    │
│  α/β/γ search  │  48+32 units   │  40+20 units │  128→64   │
│                │  TF.js         │  TF.js       │  →32→1    │
└────────────────────────────────────────────────────────────┘
        │
        ▼
Meta-Learner (L1 Stacking)
  → Learned weights on base predictions
        │
        ▼
Monte Carlo Simulation (1000 draws)
  → Confidence bands [upper, lower]
  → Ensemble confidence score
        │
        ▼
Return: { 7d, 14d, 30d: { price, upper, lower, confidence % } }
```

### 3. Deep Research Flow
```
POST /api/research { ticker }
        │
        ▼
Check cache → if <24h old, return cached narratives
        │
        ▼ (new research)
Create ResearchReport (status: PENDING)
        │
        ▼  [Background Async — streams progress via SSE]
Step 1: Scrape Google News RSS (ticker mentions)
Step 2: Scrape Reddit (ticker threads)
Step 3: Scrape Finviz (fundamentals, analyst ratings)
Step 4: Compile all sources
        │
        ▼
Step 5-8: LLM Analysis via Groq (10 dimensions × 2 passes)
  Dimensions:
    1. Earnings & Guidance      6. Supply Chain
    2. Product Launches         7. Regulatory
    3. Sector Trends            8. Social Sentiment
    4. Macro Factors            9. Analyst Ratings
    5. Competitive Landscape   10. Geopolitical Risks
        │
        ▼
Step 9-10: Price Correlation Analysis
  → Compare price before/after each narrative event
        │
        ▼
Step 11-12: Executive Summary + Final Synthesis
        │
        ▼
Mark COMPLETED → Store narratives → Client receives via SSE
```

### 4. Pending Order Check (Every 60s)
```
[Cron / Background 60s timer]
        │
        ▼
Fetch all PENDING orders from DB
        │
        ▼
For each order:
  Get current price (Alpaca → Yahoo fallback)
        │
  ┌─────────────────────────────────────┐
  │  LIMIT BUY:  current ≤ target?      │
  │  LIMIT SELL: current ≥ target?      │
  │  STOP BUY:   current ≥ target?      │
  │  STOP SELL:  current ≤ target?      │
  └─────────────────────────────────────┘
        │ if triggered
        ▼
  Create Trade record → Update order FILLED → Update portfolio
```

---

## DATABASE SCHEMA (Prisma)

```
┌─────────────┐       ┌─────────────────┐       ┌───────────────┐
│    User      │1     N│    Portfolio     │1     N│   Position    │
│─────────────│───────│─────────────────│───────│───────────────│
│ id           │       │ id               │       │ id             │
│ email        │       │ userId           │       │ portfolioId    │
│ passwordHash │       │ name             │       │ ticker         │
│ createdAt    │       │ startingCash     │       │ quantity       │
│              │       │ currentCash      │       │ avgCostBasis   │
└─────────────┘       │ createdAt        │       │ realizedPnl    │
                        └─────────────────┘       └───────────────┘
                               │1
                               │N
                        ┌─────────────────┐
                        │    Trade         │
                        │─────────────────│
                        │ id               │
                        │ portfolioId      │
                        │ ticker           │
                        │ side (BUY/SELL)  │
                        │ quantity         │
                        │ price            │
                        │ total            │
                        │ notes (review)   │
                        │ executedAt       │
                        └─────────────────┘

┌─────────────┐       ┌─────────────────┐       ┌───────────────────┐
│    User      │1     N│  WatchlistItem   │       │  PendingOrder      │
│             │───────│─────────────────│       │───────────────────│
│             │       │ id               │       │ portfolioId        │
│             │       │ userId           │       │ ticker             │
│             │       │ ticker           │       │ side (BUY/SELL)    │
│             │       │ alertAbove       │       │ quantity           │
│             │       │ alertBelow       │       │ targetPrice        │
│             │       │ alertTriggered   │       │ type (LIMIT/STOP)  │
│             │       └─────────────────┘       │ status             │
│             │                                   └───────────────────┘
│             │       ┌─────────────────┐       ┌───────────────────┐
│             │1     N│     Group        │1     N│  GroupMember       │
│             │───────│─────────────────│───────│───────────────────│
│             │       │ id               │       │ userId             │
│             │       │ name             │       │ groupId            │
│             │       │ inviteCode       │       │ portfolioId        │
│             │       │ maxTradesPerDay  │       │ joinedAt           │
│             │       │ allowedTickers[] │       └───────────────────┘
│             │       │ startDate        │
│             │       │ endDate          │       ┌───────────────────┐
│             │       │ startingCash     │       │  ResearchReport    │
│             │       └─────────────────┘       │───────────────────│
│             │                                   │ ticker             │
│             │       ┌─────────────────┐       │ status             │
│             │1     N│     Badge        │       │ executiveSummary   │
└─────────────┘───────│─────────────────│       │ cachedAt           │
                        │ userId           │       └───────────────────┘
                        │ type (7 types)   │
                        │ unlockedAt       │
                        └─────────────────┘
```

---

## FEATURE STATUS MAP

### ✅ COMPLETE & WORKING
| Feature | Location |
|---------|----------|
| JWT Auth (register/login) | `server/src/routes/auth.routes.ts` |
| Portfolio CRUD + P&L | `server/src/routes/portfolio.routes.ts` |
| Trade execution (BUY/SELL market) | `server/src/routes/trade.routes.ts` |
| Weighted-avg cost basis | `server/src/services/portfolioService.ts` |
| Limit & Stop orders (60s check) | `server/src/services/orderService.ts` |
| Watchlist + price alerts (60s) | `server/src/services/alertService.ts` |
| S&P 500 browser + search | `server/src/routes/market.routes.ts` |
| 10 market classifier tiles | `server/src/routes/market.routes.ts` |
| Quote pages (fundamentals) | `server/src/routes/quotes` |
| Technical analysis (7 indicators) | `server/src/services/technicalAnalysisService.ts` |
| Interactive Recharts charts | `client/src/pages/` |
| ML stacked ensemble (4 models) | `server/src/services/prediction/` |
| 23-feature engineering | `server/src/services/prediction/featureEngineering.ts` |
| Monte Carlo confidence bands | `server/src/services/prediction/monteCarlo.ts` |
| Walk-forward backtesting | `server/src/services/prediction/backtesting.ts` |
| Groq AI news + sentiment | `server/src/services/groqService.ts` |
| Deep research (10-dim pipeline) | `server/src/services/researchService.ts` |
| SSE streaming for research | `server/src/routes/research.routes.ts` |
| Groups + competitions | `server/src/routes/groups.routes.ts` |
| 7 achievement badges | `server/src/services/badgeService.ts` |
| Global + group leaderboards | `server/src/routes/leaderboard.routes.ts` |
| Trade history + CSV export | `server/src/routes/trade.routes.ts` |
| Post-trade review notes | `server/src/routes/trade.routes.ts` |
| Stock comparison (5 tickers) | `server/src/routes/compare.routes.ts` |
| Vercel serverless deployment | `api/index.ts`, `vercel.json` |
| Cron jobs (orders, alerts, mkt) | `vercel.json`, `server/src/routes/cron.routes.ts` |

### ✅ NEWLY ADDED (Session 2 — 2026-03-13)
| Feature | Location |
|---------|----------|
| Market Regime Panel on Dashboard | `client/src/pages/DashboardPage.tsx` |
| Stock Screener backend (`/api/screener`) | `server/src/routes/screener.routes.ts` |
| Stock Screener page (presets, filters, sort) | `client/src/pages/ScreenerPage.tsx` |
| Kelly Position Sizing (`/api/portfolios/:id/kelly`) | `server/src/routes/portfolio.routes.ts` |
| PositionSizingPanel (Full/Half/Quarter Kelly) | `client/src/components/PositionSizingPanel.tsx` |
| Behavioral Bias Tracker (`/api/portfolios/:id/behavior`) | `server/src/routes/portfolio.routes.ts` |
| BehavioralBiasPanel (disposition, overtrading, concentration) | `client/src/components/BehavioralBiasPanel.tsx` |
| Weinstein Stage Analysis (SMA150 + stage chip) | `server/src/services/technicalAnalysisService.ts` + `StockAnalysisPage.tsx` |
| Historical Valuation backend (`/api/valuation/:ticker`) | `server/src/routes/valuation.routes.ts` |
| ValuationContextPanel (P/E, PEG, P/B, P/S, EV/EBITDA, 52w range) | `client/src/components/ValuationContextPanel.tsx` |

### ⚠️ PARTIAL / NEEDS WORK
| Feature | Gap | Location |
|---------|-----|----------|
| ML on Vercel | TF.js disabled; only Holt-Winters runs | `server/src/services/predictionService.ts` |
| Order types | No trailing stops, brackets, OCO | `server/src/routes/order.routes.ts` |
| Alerts | No indicator alerts (RSI/MACD/BB triggers) | `server/src/services/alertService.ts` |
| Risk metrics | No Sharpe, max drawdown, beta, VaR | `server/src/services/portfolioService.ts` |
| Screener | 10 tiles exist but no custom builder | New feature needed |
| Portfolio perf history | Daily equity curve exists, benchmark partial | `server/src/routes/portfolio.routes.ts` |

### ❌ NOT STARTED (ROADMAP)
| Feature | Priority | Notes |
|---------|----------|-------|
| Custom screener builder | HIGH | Filter by any fundamental + technical |
| Risk analytics dashboard | HIGH | Sharpe, drawdown, beta, VaR, correlation matrix |
| Trailing stop orders | MEDIUM | % or $ trailing |
| Bracket orders (TP + SL) | MEDIUM | One-click risk management |
| Indicator-based alerts | MEDIUM | RSI < 30, MACD cross, etc. |
| Options simulation | LOW | Greeks, chain view |
| Drag-and-drop terminal | LOW | TradingView-style layout |
| Copy-trading / auto-algo | LOW | Execute based on ML signals |
| Multi-timeframe charts | MEDIUM | 1m, 5m, 15m, 1h, 4h, 1D |
| Level 2 order book sim | LOW | Bid/ask spread, depth of market |

---

## DEPLOYMENT ARCHITECTURE

```
                    ┌──────────────────┐
                    │  Vercel CDN Edge │
                    │  client/dist/    │
                    │  (React SPA)     │
                    └──────────────────┘
                             │
                    ┌──────────────────┐
                    │  Vercel          │
                    │  Serverless Fn   │
                    │  api/index.ts    │
                    │  (Express app)   │
                    │  60s max timeout │
                    │  1024MB memory   │
                    └──────────────────┘
                     │       │        │
             ┌───────┘       │        └────────┐
             ▼               ▼                  ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  Supabase /  │  │  Groq Cloud  │  │  Alpaca API  │
    │  Neon        │  │  LLM API     │  │  Yahoo Fin.  │
    │  PostgreSQL  │  │  (free tier) │  │  Market Data │
    │  (free tier) │  └──────────────┘  └──────────────┘
    └──────────────┘

  Vercel Crons (UTC):
    06:00 → /api/cron/check-orders
    12:00 → /api/cron/check-alerts
    13:00 → /api/cron/warm-market-caps
    14:00 → /api/cron/refresh-market-data
```

---

## TECH DEBT & KNOWN ISSUES

| Issue | Severity | Description |
|-------|----------|-------------|
| TF.js on Vercel | HIGH | LSTM/GRU/Dense disabled; prediction quality degraded on prod |
| Groq rate limits | MEDIUM | 14.4k req/day; deep research eats tokens fast |
| Yahoo Finance rate limits | MEDIUM | No API key; heavy use may get throttled |
| Cron frequency | MEDIUM | Vercel free crons run 1x/day, not 60s intervals |
| Alpaca IEX data | LOW | ~15 min delay on free tier (not true real-time) |
| geminiService.ts | LOW | Deprecated but file still in codebase |
| ollamaService.ts | LOW | Optional local LLM, may not be wired to production paths |

---

## ENVIRONMENT VARIABLES REFERENCE

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret for signing JWT tokens |
| `GROQ_API_KEY` | ✅ | Groq Cloud API key (LLM) |
| `GROQ_MODEL` | optional | Default: `llama-3.3-70b-versatile` |
| `ALPACA_API_KEY` | optional | Alpaca for real-time prices |
| `ALPACA_API_SECRET` | optional | Alpaca secret |
| `PORT` | optional | Default: 3001 |
| `OLLAMA_URL` | optional | Local Ollama endpoint |
| `OLLAMA_MODEL` | optional | Default: `deepseek-r1:8b` |

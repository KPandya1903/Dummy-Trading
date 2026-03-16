# Dummy Trading — Educational Stock Portfolio Manager

A full-featured paper trading platform where users get virtual cash, trade stocks with simulated orders, and track portfolio performance. No real money involved — purely educational.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 5, Material UI 5, Recharts |
| Backend | Node.js, Express 4, TypeScript, ESM |
| Database | PostgreSQL via Prisma ORM (Neon hosted) |
| ML/AI | TensorFlow.js, trading-signals, regression |
| LLM | Google Gemini (news), Ollama + DeepSeek-R1 (research) |
| Auth | Google OAuth 2.0 (`@react-oauth/google`) |
| Market Data | Yahoo Finance (quotes/history), Alpaca (real-time prices) |
| Monorepo | npm workspaces (`server/` + `client/`) |

## Features

### Authentication
- Google OAuth — one-click sign-in, auto-creates account from Google profile
- No email/password forms — Google-only for simplicity and security
- JWT sessions issued on successful Google verification

### Trading & Portfolios
- Multiple portfolios per user with $100k starting cash
- Real-time trade execution via Alpaca pricing
- Weighted-average cost basis, realized/unrealized P&L
- Limit and stop orders with 60-second automatic checking
- Trade history with CSV export and post-trade review journal
- Portfolio performance chart with S&P 500 benchmark overlay

### Group Competitions
- Create or join groups via invite code
- Configurable rules: max trades/day, allowed tickers, date ranges
- Group-specific leaderboards and portfolio constraints

### Market Data
- Full S&P 500 browsable/searchable/sortable market page with **1-second live price updates**
- S&P 500 interactive OHLC candlestick chart (1W/1M/3M/6M/1Y/5Y periods)
- Market Regime Panel and 10 market classifier tiles (top gainers, losers, most active, highest market cap, most volatile, sector leaders, 52-week highs, highest dividend, lowest P/E, momentum leaders)
- Universal stock search via Yahoo Finance (any ticker)
- Scrolling ticker tape with real-time prices (1-second polling)

### Technical Analysis
- RSI (14), MACD (12/26/9), Bollinger Bands (20,2), SMA (20/50/150/200), EMA (12/26)
- **Weinstein Stage Analysis** — classifies stocks into Stage 1 (Base), 2 (Advance), 3 (Distribution), or 4 (Decline) using SMA150 slope and price position
- Configurable period: 3M, 6M, 1Y, 2Y, 5Y
- Interactive charts with Recharts

### ML Price Prediction — Stacked Ensemble
- **23-feature engineering pipeline** from OHLCV data using `trading-signals` (RSI, MACD, Bollinger %B, SMA/EMA ratios, momentum, volatility, sentiment, day-of-week, volume ratio, etc.)
- **4 base learners running in parallel:**
  - Holt-Winters triple exponential smoothing (grid-searched α/β/γ)
  - Bidirectional 2-layer LSTM (48+32 units, 30-day window)
  - 2-layer GRU (40+20 units, Huber loss, 20-day window)
  - Dense Feature Combiner (128→64→32→1, 5-day × 23 features)
- **Meta-learner** combining base predictions with learned weights
- **Walk-forward backtesting** with RMSE, MAPE, directional accuracy
- Confidence bands and ensemble confidence score
- Sentiment integration from latest completed research report
- 7/14/30-day forecast horizons

### AI News & Sentiment
- Gemini-powered stock news summaries with sentiment analysis
- Context-aware AI insights (technical, fundamental, prediction, news)

### Deep Research Reports
- 10-dimension research pipeline (earnings, product launches, sector trends, macro, competitive landscape, supply chain, regulatory, social sentiment, analyst ratings, geopolitical)
- Web scraping from Google News RSS, Reddit, Finviz
- Local LLM analysis via Ollama + DeepSeek-R1 8B
- Two-pass reasoning: Analyze → Refine per dimension
- Executive summary synthesis with algorithmic fallback
- Real-time SSE progress streaming
- Price correlation analysis per narrative

### Stock Comparison
- Compare up to 5 stocks with normalized returns
- Configurable period: 1W, 1M, 3M, 1Y, 5Y

### Alerts & Achievements
- Watchlist with configurable price alerts (above/below thresholds)
- 7 badges: First Trade, Diversifier, Ten Percent, Beat Market, Day Trader, Diamond Hands, Full Portfolio
- Global and group leaderboards ranked by return %

### User Profile
- Avatar with initials fallback
- Stats: portfolio count, trade count, badges earned
- Editable name, bio, and location
- Google account linked status

## Project Structure

```
├── server/
│   ├── prisma/schema.prisma          # 10 models, 6 enums
│   └── src/
│       ├── index.ts                  # Express entry, route mounts, background tasks
│       ├── middleware/
│       │   └── auth.ts               # JWT Bearer token middleware
│       ├── routes/
│       │   ├── auth.routes.ts        # Google OAuth + JWT issuance
│       │   ├── user.routes.ts        # Profile GET/PATCH
│       │   ├── portfolio.routes.ts   # CRUD, summary, performance history
│       │   ├── trade.routes.ts       # Execute, list, export CSV, review
│       │   ├── watchlist.routes.ts   # CRUD with price alerts
│       │   ├── alert.routes.ts       # Triggered alerts
│       │   ├── leaderboard.routes.ts # Global rankings
│       │   ├── group.routes.ts       # Competitions
│       │   ├── order.routes.ts       # Limit/stop orders
│       │   ├── badge.routes.ts       # Achievement system
│       │   ├── dashboard.routes.ts   # Dashboard aggregate
│       │   ├── market.routes.ts      # S&P 500 data, search, OHLC chart
│       │   ├── marketClassifiers.routes.ts  # 10 classifier tiles
│       │   ├── search.routes.ts      # Universal Yahoo Finance search
│       │   ├── quote.routes.ts       # Detailed stock quotes
│       │   ├── analysis.routes.ts    # Technical indicators
│       │   ├── predict.routes.ts     # ML ensemble predictions
│       │   ├── news.routes.ts        # AI news summaries
│       │   ├── gemini.routes.ts      # Gemini AI insights
│       │   ├── compare.routes.ts     # Stock comparison
│       │   └── research.routes.ts    # Deep research pipeline
│       └── services/
│           ├── prediction/           # Stacked ensemble system
│           │   ├── types.ts          # Shared interfaces
│           │   ├── utils.ts          # Normalization, business-day helpers
│           │   ├── featureEngineering.ts  # 23-feature matrix builder
│           │   ├── baseLearners/
│           │   │   ├── exponentialSmoothing.ts  # Holt-Winters
│           │   │   ├── enhancedLstm.ts          # Bidirectional LSTM
│           │   │   ├── gruModel.ts              # GRU network
│           │   │   └── featureCombiner.ts       # Dense network
│           │   ├── metaLearner.ts    # Level-1 stacking
│           │   ├── ensemble.ts       # Orchestrator
│           │   ├── backtesting.ts    # Walk-forward validation
│           │   └── index.ts          # Public exports
│           ├── technicalAnalysisService.ts  # RSI, MACD, BB, SMA, EMA, Weinstein
│           ├── ollamaService.ts      # Local LLM (DeepSeek-R1)
│           ├── webScraperService.ts  # News scraping
│           ├── researchService.ts    # Research pipeline
│           ├── geminiService.ts      # Gemini API
│           ├── marketService.ts      # Market data cache (2s TTL)
│           ├── priceService.ts       # Alpaca real-time prices
│           ├── portfolioService.ts   # Portfolio calculations
│           ├── alertService.ts       # Alert checking (60s)
│           ├── orderService.ts       # Order checking (60s)
│           └── badgeService.ts       # Achievement system
└── client/
    └── src/
        ├── App.tsx                   # 20+ routes, Google OAuth provider
        ├── theme.ts                  # Black/green Robinhood-style dark theme
        ├── components/
        │   ├── Layout.tsx            # Sidebar nav + ticker tape
        │   ├── TickerTape.tsx        # Scrolling price ticker (1s polling)
        │   ├── SP500CandlestickChart.tsx  # OHLC candlestick via Recharts Customized layer
        │   ├── SP500IndexChart.tsx   # S&P 500 line chart
        │   ├── GeminiInsightPanel.tsx # AI analysis panel
        │   ├── MarketClassifierTiles.tsx  # 10 classifier cards
        │   ├── MarketRegimePanel.tsx # Market regime indicator
        │   └── ...                   # Charts, forms, research tiles
        └── pages/
            ├── LoginPage.tsx         # Google OAuth sign-in
            ├── ProfilePage.tsx       # User profile + stats + edit
            ├── DashboardPage.tsx     # Main dashboard
            ├── MarketPage.tsx        # S&P 500 browser + candlestick toggle
            ├── StockDetailPage.tsx   # Stock quotes & fundamentals
            ├── StockAnalysisPage.tsx # Technical analysis charts
            ├── StockPredictionPage.tsx  # ML prediction + ensemble
            ├── StockComparisonPage.tsx  # Multi-stock comparison
            ├── ResearchLandingPage.tsx  # Research tool
            ├── ResearchReportPage.tsx   # Research report viewer
            └── ...                   # Portfolios, trades, groups, etc.
```

## Database Schema

```
User 1──* Portfolio 1──* Trade
  │           │
  │           └──* PendingOrder
  │
  ├──* WatchlistItem
  ├──* UserBadge
  └──* GroupMembership *──1 Group 1──* Portfolio

Research 1──* ResearchNarrative
```

10 models: User, Portfolio, Trade, WatchlistItem, PendingOrder, Group, GroupMembership, UserBadge, Research, ResearchNarrative

User model fields: `id`, `email`, `passwordHash?`, `name?`, `avatarUrl?`, `googleId?`, `bio?`, `location?`, `createdAt`

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL running locally (or a Neon connection string)
- Ollama (optional, for research reports): `brew install ollama && ollama pull deepseek-r1:8b`

### Environment Variables

```bash
# server/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/paper_trading?schema=public"
JWT_SECRET="your-secret-key"
GEMINI_API_KEY="your-gemini-key"          # Optional: for AI news
ALPACA_API_KEY="your-alpaca-key"          # Optional: for real-time prices
ALPACA_API_SECRET="your-alpaca-secret"
OLLAMA_URL="http://localhost:11434"       # Optional: for research
OLLAMA_MODEL="deepseek-r1:8b"            # Optional: for research

# client/.env
VITE_GOOGLE_CLIENT_ID="your-google-oauth-client-id"
```

### Setup

```bash
# Install dependencies
npm install

# Generate Prisma client + push schema
cd server && npx prisma generate && npx prisma db push && cd ..

# Start both dev servers
npm run dev:server   # Express on http://localhost:3001
npm run dev:client   # Vite on http://localhost:5173
```

### Other Commands

```bash
npm test -w server              # Run 135 tests (auth, TA, feature engineering, prediction utils)
npm run lint                    # ESLint
npm run build:server            # Compile server
npm run build:client            # Vite production build
npx -w server prisma studio     # Visual database browser
```

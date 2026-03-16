// ─────────────────────────────────────────────────────────────────
//  Dummy Trading — Figma Architecture Plugin
//  Generates 5 visual frames documenting the project structure.
// ─────────────────────────────────────────────────────────────────

// ── Colors (RGB 0–1 for Figma API) ───────────────────────────────
const C = {
  client:    { r: 0.22, g: 0.46, b: 0.87 },
  server:    { r: 0.13, g: 0.63, b: 0.40 },
  db:        { r: 0.48, g: 0.25, b: 0.79 },
  external:  { r: 0.90, g: 0.53, b: 0.08 },
  ml:        { r: 0.85, g: 0.22, b: 0.22 },
  auth:      { r: 0.79, g: 0.65, b: 0.10 },
  social:    { r: 0.20, g: 0.72, b: 0.78 },
  market:    { r: 0.94, g: 0.47, b: 0.20 },
  white:     { r: 1.00, g: 1.00, b: 1.00 },
  dark:      { r: 0.12, g: 0.12, b: 0.14 },
  muted:     { r: 0.50, g: 0.50, b: 0.55 },
  canvas:    { r: 0.11, g: 0.11, b: 0.13 },
  section:   { r: 0.16, g: 0.16, b: 0.19 },
  card:      { r: 0.20, g: 0.20, b: 0.24 },
  titleBar:  { r: 0.08, g: 0.08, b: 0.10 },
};

// ── Data ──────────────────────────────────────────────────────────

const PAGES_DATA = [
  {
    group: 'Auth',
    color: C.auth,
    pages: [
      { name: 'LoginPage', route: '/login', auth: false },
    ],
  },
  {
    group: 'Portfolio',
    color: C.server,
    pages: [
      { name: 'DashboardPage', route: '/', auth: true },
      { name: 'PortfolioListPage', route: '/portfolios', auth: true },
      { name: 'PortfolioDetailPage', route: '/portfolios/:id', auth: true },
      { name: 'TradeHistoryPage', route: '/portfolios/:id/trades', auth: true },
    ],
  },
  {
    group: 'Trading',
    color: C.client,
    pages: [
      { name: 'TradePage', route: '/trade', auth: true },
      { name: 'WatchlistPage', route: '/watchlist', auth: true },
    ],
  },
  {
    group: 'Market',
    color: C.market,
    pages: [
      { name: 'MarketPage', route: '/market', auth: false },
      { name: 'StockDetailPage', route: '/stocks/:ticker', auth: false },
      { name: 'StockComparisonPage', route: '/compare', auth: false },
      { name: 'ScreenerPage', route: '/screener', auth: false },
    ],
  },
  {
    group: 'Analysis & Prediction',
    color: C.ml,
    pages: [
      { name: 'AnalysisLandingPage', route: '/analysis', auth: false },
      { name: 'StockAnalysisPage', route: '/stocks/:ticker/analysis', auth: false },
      { name: 'PredictionLandingPage', route: '/prediction', auth: false },
      { name: 'StockPredictionPage', route: '/predict/:ticker', auth: false },
    ],
  },
  {
    group: 'Research & News',
    color: C.external,
    pages: [
      { name: 'NewsLandingPage', route: '/news', auth: false },
      { name: 'ResearchLandingPage', route: '/research', auth: false },
      { name: 'ResearchReportPage', route: '/research/:id', auth: false },
    ],
  },
  {
    group: 'Social & Gamification',
    color: C.social,
    pages: [
      { name: 'GroupListPage', route: '/groups', auth: true },
      { name: 'GroupDetailPage', route: '/groups/:id', auth: true },
      { name: 'LeaderboardPage', route: '/leaderboard', auth: false },
      { name: 'BadgesPage', route: '/badges', auth: true },
    ],
  },
];

const ROUTES_DATA = [
  // Auth
  { name: 'auth', prefix: '/api/auth', color: C.auth,
    methods: ['POST /register', 'POST /login'] },
  // Portfolio & Trades
  { name: 'portfolios', prefix: '/api/portfolios', color: C.server,
    methods: ['GET /', 'POST /', 'GET /:id', 'DELETE /:id', 'GET /:id/kelly', 'GET /:id/behavior', 'GET /:id/history'] },
  { name: 'trades', prefix: '/api/trades', color: C.server,
    methods: ['POST /', 'GET /', 'GET /export', 'PATCH /:id/review', 'DELETE /:id'] },
  { name: 'orders', prefix: '/api/orders', color: C.server,
    methods: ['POST /', 'GET /', 'DELETE /:id'] },
  // Market
  { name: 'market', prefix: '/api/market', color: C.market,
    methods: ['GET /', 'GET /:ticker'] },
  { name: 'market/classifiers', prefix: '/api/market/classifiers', color: C.market,
    methods: ['GET /'] },
  { name: 'market/regime', prefix: '/api/market/regime', color: C.market,
    methods: ['GET /'] },
  { name: 'quotes', prefix: '/api/quotes', color: C.market,
    methods: ['GET /:ticker'] },
  { name: 'screener', prefix: '/api/screener', color: C.market,
    methods: ['GET /'] },
  { name: 'compare', prefix: '/api/compare', color: C.market,
    methods: ['GET /'] },
  { name: 'search', prefix: '/api/search', color: C.market,
    methods: ['GET /'] },
  { name: 'valuation', prefix: '/api/valuation', color: C.external,
    methods: ['GET /:ticker'] },
  // Analysis
  { name: 'analysis', prefix: '/api/analysis', color: C.ml,
    methods: ['GET /:ticker'] },
  { name: 'factors', prefix: '/api/factors', color: C.ml,
    methods: ['GET /:ticker'] },
  { name: 'predict', prefix: '/api/predict', color: C.ml,
    methods: ['GET /:ticker', 'POST /:ticker/custom'] },
  // Research & News
  { name: 'news', prefix: '/api/news', color: C.external,
    methods: ['GET /'] },
  { name: 'gemini', prefix: '/api/gemini', color: C.external,
    methods: ['GET /:ticker'] },
  { name: 'research', prefix: '/api/research', color: C.external,
    methods: ['POST /', 'GET /:id', 'GET /:id/stream (SSE)'] },
  // Social
  { name: 'groups', prefix: '/api/groups', color: C.social,
    methods: ['GET /', 'POST /', 'POST /join', 'GET /:id'] },
  { name: 'leaderboard', prefix: '/api/leaderboard', color: C.social,
    methods: ['GET /', 'GET /group/:id'] },
  { name: 'badges', prefix: '/api/badges', color: C.social,
    methods: ['GET /'] },
  // User
  { name: 'watchlist', prefix: '/api/watchlist', color: C.client,
    methods: ['GET /', 'POST /', 'DELETE /:ticker'] },
  { name: 'alerts', prefix: '/api/alerts', color: C.client,
    methods: ['GET /', 'POST /', 'DELETE /:id'] },
  { name: 'dashboard', prefix: '/api/dashboard', color: C.server,
    methods: ['GET /'] },
  // Infra
  { name: 'cron', prefix: '/api/cron', color: C.muted,
    methods: ['GET /check-orders (06:00)', 'GET /check-alerts (12:00)', 'GET /warm-market-caps (13:00)', 'GET /refresh-market-data (14:00)'] },
];

const MODELS_DATA = [
  {
    name: 'User',
    color: C.client,
    fields: ['id: Int (PK)', 'email: String @unique', 'passwordHash: String', 'createdAt: DateTime'],
    relations: ['→ Portfolio[]', '→ WatchlistItem[]', '→ GroupMembership[]', '→ UserBadge[]'],
  },
  {
    name: 'Portfolio',
    color: C.server,
    fields: ['id: Int (PK)', 'userId: Int (FK → User)', 'name: String', 'startingCash: Float', 'groupId: Int? (FK → Group)', 'createdAt: DateTime'],
    relations: ['→ Trade[]', '→ PendingOrder[]'],
  },
  {
    name: 'Trade',
    color: C.server,
    fields: ['id: Int (PK)', 'portfolioId: Int (FK)', 'ticker: String', 'side: BUY | SELL', 'quantity: Int', 'price: Float', 'executedAt: DateTime', 'note: String?', 'reviewNote: String?'],
    relations: [],
  },
  {
    name: 'PendingOrder',
    color: C.server,
    fields: ['id: Int (PK)', 'portfolioId: Int (FK)', 'ticker: String', 'side: TradeSide', 'quantity: Int', 'orderType: MARKET | LIMIT | STOP', 'targetPrice: Float', 'status: PENDING | FILLED | CANCELLED'],
    relations: [],
  },
  {
    name: 'WatchlistItem',
    color: C.client,
    fields: ['id: Int (PK)', 'userId: Int (FK → User)', 'ticker: String', 'alertAbove: Float?', 'alertBelow: Float?', 'alertTriggered: Boolean'],
    relations: [],
  },
  {
    name: 'Group',
    color: C.social,
    fields: ['id: Int (PK)', 'name: String', 'joinCode: String @unique', 'startingCash: Float', 'startDate / endDate: DateTime?', 'maxTradesPerDay: Int?', 'allowedTickers: String?'],
    relations: ['→ GroupMembership[]', '→ Portfolio[]'],
  },
  {
    name: 'GroupMembership',
    color: C.social,
    fields: ['id: Int (PK)', 'groupId: Int (FK → Group)', 'userId: Int (FK → User)', 'role: OWNER | MEMBER', 'joinedAt: DateTime'],
    relations: [],
  },
  {
    name: 'UserBadge',
    color: C.auth,
    fields: ['id: Int (PK)', 'userId: Int (FK → User)', 'badge: FIRST_TRADE | DIVERSIFIER | TEN_PERCENT | BEAT_MARKET | DAY_TRADER | DIAMOND_HANDS | FULL_PORTFOLIO', 'unlockedAt: DateTime'],
    relations: [],
  },
  {
    name: 'Research',
    color: C.ml,
    fields: ['id: Int (PK)', 'ticker: String', 'companyName: String', 'status: PENDING | IN_PROGRESS | COMPLETED | FAILED', 'progress: Int', 'executiveSummary: String?', 'overallSentiment: String?', 'confidenceScore: Float?'],
    relations: ['→ ResearchNarrative[]'],
  },
  {
    name: 'ResearchNarrative',
    color: C.ml,
    fields: ['id: Int (PK)', 'researchId: Int (FK → Research)', 'dimension: String (10 dims)', 'title: String', 'sentiment: String', 'impactScore: Float?', 'summary: String', 'priceBeforeEvent / priceAfterEvent: Float?', 'priceChangePct: Float?'],
    relations: [],
  },
];

const SERVICES_DATA = [
  {
    domain: 'ML / Prediction',
    color: C.ml,
    services: [
      { name: 'ensemble.ts', desc: 'Stacks 4 base learners + meta-learner' },
      { name: 'featureEngineering.ts', desc: '23 features: OHLCV, RSI, MACD, BB, SMA, EMA, momentum, vol, sentiment, day-of-week' },
      { name: 'enhancedLstm.ts', desc: 'Bidirectional LSTM 48+32 units (TF.js)' },
      { name: 'gruModel.ts', desc: '2-layer GRU 40+20 units, Huber loss (TF.js)' },
      { name: 'featureCombiner.ts', desc: 'Dense 128→64→32→1 (TF.js)' },
      { name: 'exponentialSmoothing.ts', desc: 'Holt-Winters α/β/γ grid search (runs on Vercel)' },
      { name: 'metaLearner.ts', desc: 'L1 stacking: learned weights on base predictions' },
      { name: 'monteCarlo.ts', desc: '1000 simulations → confidence bands' },
      { name: 'backtesting.ts', desc: 'Walk-forward validation' },
    ],
  },
  {
    domain: 'Research / AI',
    color: C.external,
    services: [
      { name: 'researchService.ts', desc: '10-dimension analysis pipeline, SSE streaming progress' },
      { name: 'groqService.ts', desc: 'Groq API — llama-3.3-70b-versatile (14.4k req/day free)' },
      { name: 'webScraperService.ts', desc: 'Google News RSS, Reddit search, Finviz scraping' },
      { name: 'geminiService.ts', desc: 'Google Gemini (deprecated, replaced by Groq)' },
      { name: 'ollamaService.ts', desc: 'Local LLM (DeepSeek-R1:8b, optional)' },
    ],
  },
  {
    domain: 'Market Data',
    color: C.market,
    services: [
      { name: 'marketService.ts', desc: 'S&P 500 browser, market cap cache, classifier tiles' },
      { name: 'priceService.ts', desc: 'Alpaca WebSocket → Yahoo Finance fallback' },
      { name: 'technicalAnalysisService.ts', desc: 'RSI, MACD, BB, SMA, EMA, Weinstein Stage, momentum' },
      { name: 'tickerMetadata.ts', desc: 'Static ticker/sector metadata store' },
    ],
  },
  {
    domain: 'Portfolio / Trading',
    color: C.server,
    services: [
      { name: 'portfolioService.ts', desc: 'P&L calc, weighted-avg cost basis, Kelly sizing, behavioral bias tracking' },
      { name: 'orderService.ts', desc: 'Limit/Stop order fulfillment — polls every 60s' },
      { name: 'alertService.ts', desc: 'Price alert trigger check — polls every 60s' },
    ],
  },
  {
    domain: 'Social / Gamification',
    color: C.social,
    services: [
      { name: 'badgeService.ts', desc: '7 achievement badge unlock checks (First Trade, Diversifier, 10%, Beat Market, Day Trader, Diamond Hands, Full Portfolio)' },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────

function makeFrame(name, x, y, w, h) {
  const f = figma.createFrame();
  f.name = name;
  f.x = x; f.y = y;
  f.resize(w, h);
  f.fills = [{ type: 'SOLID', color: C.canvas }];
  f.clipsContent = false;
  figma.currentPage.appendChild(f);
  return f;
}

function makeRect(parent, x, y, w, h, color, radius) {
  const r = figma.createRectangle();
  r.x = x; r.y = y;
  r.resize(Math.max(w, 1), Math.max(h, 1));
  r.fills = [{ type: 'SOLID', color }];
  if (radius) r.cornerRadius = radius;
  parent.appendChild(r);
  return r;
}

function makeText(parent, str, x, y, size, color, weight, maxW) {
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: weight || 'Regular' };
  t.fontSize = size || 12;
  const col = color || C.white;
  const fill = { type: 'SOLID', color: { r: col.r, g: col.g, b: col.b } };
  if (col.a !== undefined) fill.opacity = col.a;
  t.fills = [fill];
  if (maxW) {
    t.textAutoResize = 'HEIGHT';
    t.resize(maxW, 20);
  }
  t.characters = String(str);
  t.x = x; t.y = y;
  parent.appendChild(t);
  return t;
}

// Draws a thin vertical connector bar with a ▼ label
function makeVertConnector(parent, cx, y1, y2, label, color) {
  // shaft
  makeRect(parent, cx - 1, y1, 2, y2 - y1 - 14, color || C.muted);
  // arrowhead text
  makeText(parent, '▼', cx - 6, y2 - 16, 14, color || C.muted, 'Regular');
  if (label) {
    makeText(parent, label, cx + 8, y1 + (y2 - y1) / 2 - 8, 10, color || C.muted, 'Regular');
  }
}

// Draws a thin horizontal connector
function makeHorizConnector(parent, x1, x2, cy, color) {
  makeRect(parent, x1, cy - 1, x2 - x1 - 10, 2, color || C.muted);
  makeText(parent, '▶', x2 - 14, cy - 8, 12, color || C.muted, 'Regular');
}

// Title bar at top of a frame
function makeTitleBar(frame, title, subtitle, accentColor) {
  makeRect(frame, 0, 0, frame.width, 56, C.titleBar);
  makeRect(frame, 0, 0, 5, 56, accentColor || C.client);
  makeText(frame, title, 20, 10, 16, C.white, 'Bold', frame.width - 40);
  if (subtitle) {
    makeText(frame, subtitle, 20, 32, 11, C.muted, 'Regular', frame.width - 40);
  }
}

// Card with colored header band
function makeCard(parent, title, bodyLines, x, y, w, headerColor, opts) {
  const lineH = (opts && opts.lineH) || 16;
  const padding = 10;
  const headerH = 28;
  const totalH = headerH + padding + bodyLines.length * lineH + padding;

  makeRect(parent, x, y, w, totalH, C.card, 6);
  makeRect(parent, x, y, w, headerH, headerColor, 6);
  // Fix bottom corners of header — draw a plain rect over the bottom half
  makeRect(parent, x, y + headerH - 6, w, 6, headerColor);

  makeText(parent, title, x + 8, y + 7, 11, C.white, 'Semi Bold', w - 16);

  let ly = y + headerH + padding;
  for (const line of bodyLines) {
    makeText(parent, line, x + 8, ly, 10, C.muted, 'Regular', w - 16);
    ly += lineH;
  }
  return { x, y, w, h: totalH };
}

// ── Font Loading ───────────────────────────────────────────────────

async function loadFonts() {
  const required = [
    { family: 'Inter', style: 'Regular' },
    { family: 'Inter', style: 'Medium' },
    { family: 'Inter', style: 'Bold' },
  ];
  try {
    await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
  } catch (_) {
    // fallback: Semi Bold not available, Bold will be used
  }
  await Promise.all(required.map(f => figma.loadFontAsync(f)));
}

// ── Frame 1: App Overview ──────────────────────────────────────────
// 3-tier: Client → Server → DB/External/AI + Vercel deployment strip

async function buildAppOverview() {
  const W = 1440, H = 960;
  const f = makeFrame('1 — App Overview', 0, 0, W, H);
  makeTitleBar(f, 'App Overview', 'Dummy Trading — 3-Tier Architecture (React → Express → PostgreSQL + External APIs)', C.client);

  const PAD = 40;
  const tierW = W - PAD * 2;

  // ── Client Tier ─────────────────────────────────────────
  const clientY = 76;
  const clientH = 190;
  makeRect(f, PAD, clientY, tierW, clientH, { r: 0.11, g: 0.22, b: 0.44 }, 10);
  makeRect(f, PAD, clientY, 6, clientH, C.client, 10);
  makeText(f, 'CLIENT TIER', PAD + 16, clientY + 10, 11, C.client, 'Bold');
  makeText(f, 'React 18 + TypeScript + Vite + Material UI  —  /client/src/', PAD + 16, clientY + 26, 11, C.muted, 'Regular');

  const clientCards = [
    { title: 'React 18 + Vite', lines: ['Entry: client/src/main.tsx', 'Bundler: Vite 5.2', 'Strict Mode enabled'] },
    { title: 'Material UI 5.15', lines: ['MUI + Emotion CSS-in-JS', 'Custom dark theme', 'theme.ts config'] },
    { title: 'React Router 6', lines: ['22 page routes', 'RequireAuth guard', 'client/src/App.tsx'] },
    { title: 'Recharts 3.7', lines: ['Equity curve charts', 'Heatmaps, bar charts', 'Portfolio performance'] },
    { title: 'Axios + apiClient', lines: ['JWT auth headers', 'Base URL: /api', 'client/src/apiClient.ts'] },
  ];
  const cardW = 240;
  const cardGap = (tierW - 6 - clientCards.length * cardW) / (clientCards.length + 1);
  clientCards.forEach((card, i) => {
    const cx = PAD + 6 + cardGap * (i + 1) + cardW * i;
    makeCard(f, card.title, card.lines, cx, clientY + 48, cardW, C.client);
  });

  // ── Arrow → Server ─────────────────────────────────────
  makeVertConnector(f, W / 2, clientY + clientH + 4, clientY + clientH + 48, 'HTTPS / REST', C.muted);

  // ── Server Tier ─────────────────────────────────────────
  const serverY = clientY + clientH + 50;
  const serverH = 190;
  makeRect(f, PAD, serverY, tierW, serverH, { r: 0.08, g: 0.25, b: 0.18 }, 10);
  makeRect(f, PAD, serverY, 6, serverH, C.server, 10);
  makeText(f, 'SERVER TIER', PAD + 16, serverY + 10, 11, C.server, 'Bold');
  makeText(f, 'Node.js + Express 4 + TypeScript  —  /server/src/', PAD + 16, serverY + 26, 11, C.muted, 'Regular');

  const serverCards = [
    { title: 'Express 4.19', lines: ['25 route modules', 'app.ts mounts all routes', 'CORS + JSON middleware'] },
    { title: 'Prisma 5.12 ORM', lines: ['PostgreSQL provider', '10 data models', 'Migration history'] },
    { title: 'JWT Auth', lines: ['bcryptjs hashing', '7-day token expiry', 'middleware/auth.ts'] },
    { title: 'Background Tasks', lines: ['orderService: 60s poll', 'alertService: 60s poll', 'marketService cache'] },
    { title: '25 API Routes', lines: ['auth, portfolios, trades', 'market, analysis, predict', 'research, groups, …'] },
  ];
  serverCards.forEach((card, i) => {
    const cx = PAD + 6 + cardGap * (i + 1) + cardW * i;
    makeCard(f, card.title, card.lines, cx, serverY + 48, cardW, C.server);
  });

  // ── Arrows → bottom tier ────────────────────────────────
  const arrowY1 = serverY + serverH + 4;
  const arrowY2 = arrowY1 + 44;
  const botW = (tierW - 32) / 3;
  const dbCx = PAD + 6 + botW / 2;
  const extCx = PAD + 6 + botW + 16 + botW / 2;
  const aiCx  = PAD + 6 + (botW + 16) * 2 + botW / 2;

  makeVertConnector(f, dbCx,  arrowY1, arrowY2, '', C.db);
  makeVertConnector(f, extCx, arrowY1, arrowY2, '', C.external);
  makeVertConnector(f, aiCx,  arrowY1, arrowY2, '', C.ml);

  // ── Bottom Tier: DB / External / AI ────────────────────
  const botY = arrowY2 + 2;
  const botH = 170;

  // Database box
  const dbX = PAD;
  makeRect(f, dbX, botY, botW, botH, { r: 0.18, g: 0.10, b: 0.30 }, 10);
  makeRect(f, dbX, botY, 6, botH, C.db, 10);
  makeText(f, 'DATABASE', dbX + 16, botY + 10, 11, C.db, 'Bold');
  makeText(f, 'PostgreSQL (Supabase / Neon)', dbX + 16, botY + 26, 11, C.muted, 'Regular', botW - 22);
  const dbItems = ['10 Prisma models', 'User, Portfolio, Trade', 'PendingOrder, WatchlistItem', 'Group, GroupMembership', 'Research, ResearchNarrative', 'UserBadge'];
  dbItems.forEach((item, i) => makeText(f, '• ' + item, dbX + 16, botY + 46 + i * 16, 10, C.muted, 'Regular', botW - 22));

  // External APIs box
  const extX = PAD + botW + 16;
  makeRect(f, extX, botY, botW, botH, { r: 0.35, g: 0.20, b: 0.05 }, 10);
  makeRect(f, extX, botY, 6, botH, C.external, 10);
  makeText(f, 'MARKET DATA APIs', extX + 16, botY + 10, 11, C.external, 'Bold');
  makeText(f, 'Real-time + Historical Pricing', extX + 16, botY + 26, 11, C.muted, 'Regular', botW - 22);
  const extItems = ['Alpaca WebSocket (real-time)', 'Yahoo Finance 2 (fallback)', 'Google News RSS', 'Reddit search (sentiment)', 'Finviz (fundamentals)', 'trading-signals 7.4 (RSI…)'];
  extItems.forEach((item, i) => makeText(f, '• ' + item, extX + 16, botY + 46 + i * 16, 10, C.muted, 'Regular', botW - 22));

  // AI / LLM box
  const aiX = PAD + (botW + 16) * 2;
  makeRect(f, aiX, botY, botW, botH, { r: 0.32, g: 0.08, b: 0.08 }, 10);
  makeRect(f, aiX, botY, 6, botH, C.ml, 10);
  makeText(f, 'AI / LLM', aiX + 16, botY + 10, 11, C.ml, 'Bold');
  makeText(f, 'Groq + TensorFlow.js Ensemble', aiX + 16, botY + 26, 11, C.muted, 'Regular', botW - 22);
  const aiItems = ['Groq: llama-3.3-70b-versatile', '14.4k requests/day (free)', 'TF.js: BiLSTM + GRU + Dense', 'Holt-Winters (runs on Vercel)', 'Monte Carlo confidence bands', 'sentiment.js (text analysis)'];
  aiItems.forEach((item, i) => makeText(f, '• ' + item, aiX + 16, botY + 46 + i * 16, 10, C.muted, 'Regular', botW - 22));

  // ── Vercel Deployment Strip ─────────────────────────────
  const deployY = botY + botH + 24;
  makeRect(f, PAD, deployY, tierW, 90, C.section, 8);
  makeText(f, 'DEPLOYMENT  —  Vercel Serverless', PAD + 16, deployY + 10, 11, C.white, 'Bold');
  makeText(f, 'api/index.ts wraps Express app · 1024 MB memory · 60s timeout · SPA CDN edge · npm workspaces monorepo', PAD + 16, deployY + 28, 10, C.muted, 'Regular', tierW - 32);

  const crons = [
    '🕕 06:00 UTC  check-orders',
    '🕛 12:00 UTC  check-alerts',
    '🕑 13:00 UTC  warm-market-caps',
    '🕒 14:00 UTC  refresh-market-data',
  ];
  const cronW = (tierW - 48) / 4;
  crons.forEach((label, i) => {
    const cx2 = PAD + 16 + i * (cronW + 8);
    makeRect(f, cx2, deployY + 52, cronW, 26, C.card, 4);
    makeText(f, label, cx2 + 8, deployY + 58, 9, C.muted, 'Regular', cronW - 12);
  });
}

// ── Frame 2: Page Navigation Map ──────────────────────────────────

async function buildPageNav() {
  const W = 1800;
  // Calculate height dynamically
  const PAGE_BOX_W = 220;
  const PAGE_BOX_H = 68;
  const COLS = 5;
  const PAGE_GAP_X = 16;
  const PAGE_GAP_Y = 12;
  const GROUP_HEADER_H = 36;
  const GROUP_PAD_BOTTOM = 20;
  const PAD = 40;
  const START_Y = 76;

  // Pre-compute total height
  let totalH = START_Y + 20;
  for (const group of PAGES_DATA) {
    const rows = Math.ceil(group.pages.length / COLS);
    totalH += GROUP_HEADER_H + rows * (PAGE_BOX_H + PAGE_GAP_Y) + GROUP_PAD_BOTTOM;
  }
  totalH += 40;

  const f = makeFrame('2 — Page Navigation Map', 1640, 0, W, Math.max(totalH, 600));
  makeTitleBar(f, 'Page Navigation Map', `22 pages across 7 domain groups · Auth-protected routes marked with 🔒`, C.social);

  let currentY = START_Y + 20;

  for (const group of PAGES_DATA) {
    const rows = Math.ceil(group.pages.length / COLS);
    const groupH = GROUP_HEADER_H + rows * (PAGE_BOX_H + PAGE_GAP_Y) + GROUP_PAD_BOTTOM;

    // Group background
    makeRect(f, PAD, currentY, W - PAD * 2, groupH, C.section, 8);

    // Group header
    makeRect(f, PAD, currentY, W - PAD * 2, GROUP_HEADER_H, group.color, 8);
    makeRect(f, PAD, currentY + GROUP_HEADER_H - 8, W - PAD * 2, 8, group.color); // square bottom
    makeText(f, group.group.toUpperCase(), PAD + 14, currentY + 10, 11, C.white, 'Bold');
    makeText(f, group.pages.length + ' page' + (group.pages.length > 1 ? 's' : ''), PAD + 14 + 160, currentY + 11, 10, C.muted, 'Regular');

    // Page boxes
    group.pages.forEach((page, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const px = PAD + 14 + col * (PAGE_BOX_W + PAGE_GAP_X);
      const py = currentY + GROUP_HEADER_H + 10 + row * (PAGE_BOX_H + PAGE_GAP_Y);

      makeRect(f, px, py, PAGE_BOX_W, PAGE_BOX_H, C.card, 6);
      makeRect(f, px, py, PAGE_BOX_W, 4, group.color, 6);

      const authIcon = page.auth ? '🔒 ' : '';
      makeText(f, authIcon + page.name, px + 8, py + 12, 11, C.white, 'Medium', PAGE_BOX_W - 16);
      makeText(f, page.route, px + 8, py + 30, 10, C.muted, 'Regular', PAGE_BOX_W - 16);
      makeText(f, page.auth ? 'Auth required' : 'Public', px + 8, py + 48, 9, page.auth ? C.auth : C.server, 'Regular');
    });

    currentY += groupH + 16;
  }
}

// ── Frame 3: API Route Map ─────────────────────────────────────────

async function buildApiRoutes() {
  const W = 1680;
  const COLS = 3;
  const CARD_W = 500;
  const CARD_GAP_X = 20;
  const CARD_GAP_Y = 16;
  const PAD = 40;
  const START_Y = 76;

  // Estimate height
  const rows = Math.ceil(ROUTES_DATA.length / COLS);
  const maxMethodCount = Math.max(...ROUTES_DATA.map(r => r.methods.length));
  const cardH = 28 + 10 + maxMethodCount * 16 + 12;
  const H = START_Y + 20 + rows * (cardH + CARD_GAP_Y) + 60;

  const f = makeFrame('3 — API Route Map', 3640, 0, W, H);
  makeTitleBar(f, 'API Route Map', '25 Express route modules mounted in server/src/app.ts · all prefixed /api/', C.server);

  ROUTES_DATA.forEach((route, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = PAD + col * (CARD_W + CARD_GAP_X);
    const y = START_Y + 20 + row * (cardH + CARD_GAP_Y);
    makeCard(f, route.name + '  ·  ' + route.prefix, route.methods, x, y, CARD_W, route.color, { lineH: 16 });
  });
}

// ── Frame 4: Data Model Diagram ────────────────────────────────────

async function buildDataModels() {
  const W = 1860;
  const COLS = 3;
  const CARD_W = 560;
  const CARD_GAP_X = 30;
  const CARD_GAP_Y = 20;
  const PAD = 40;
  const START_Y = 76;

  const f = makeFrame('4 — Data Model Diagram', 5640, 0, W, 1);
  makeTitleBar(f, 'Data Model Diagram', '10 Prisma models · PostgreSQL · schema at server/prisma/schema.prisma', C.db);

  let maxY = START_Y + 20;

  MODELS_DATA.forEach((model, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = PAD + col * (CARD_W + CARD_GAP_X);
    const y = START_Y + 20 + row * 0; // we'll track dynamically

    // Manual row tracking for dynamic card heights
    const allLines = [
      ...model.fields,
      ...(model.relations.length > 0 ? ['─── Relations ───', ...model.relations] : []),
    ];
    const cardH = 28 + 10 + allLines.length * 16 + 12;
    const cardY = START_Y + 20 + Math.floor(i / COLS) * 0; // fixed per-row

    // We need per-row y tracking. Rebuild with explicit row tracking below.
    void cardH;
  });

  // Rebuild with proper per-row height tracking
  const rowData = [];
  for (let row = 0; row < Math.ceil(MODELS_DATA.length / COLS); row++) {
    const rowModels = MODELS_DATA.slice(row * COLS, row * COLS + COLS);
    const rowMaxLines = Math.max(...rowModels.map(m => m.fields.length + (m.relations.length > 0 ? m.relations.length + 1 : 0)));
    const rowCardH = 28 + 10 + rowMaxLines * 16 + 12;
    rowData.push({ rowCardH });
  }

  let currentY = START_Y + 20;
  MODELS_DATA.forEach((model, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    if (col === 0 && i > 0) {
      currentY += rowData[row - 1].rowCardH + CARD_GAP_Y;
    }
    if (i === 0) currentY = START_Y + 20;

    const x = PAD + col * (CARD_W + CARD_GAP_X);
    const allLines = [
      ...model.fields,
      ...(model.relations.length > 0 ? ['── Relations ──', ...model.relations] : []),
    ];
    makeCard(f, model.name, allLines, x, currentY, CARD_W, model.color, { lineH: 16 });
  });

  // Calculate final height and resize frame
  let totalH = START_Y + 20;
  for (let row = 0; row < rowData.length; row++) {
    totalH += rowData[row].rowCardH + CARD_GAP_Y;
  }
  totalH += 40;
  f.resize(W, Math.max(totalH, 600));
}

// ── Frame 5: Service Layer Map ─────────────────────────────────────

async function buildServiceLayer() {
  const W = 1460;
  const PAD = 40;
  const START_Y = 76;
  const CARD_W = W - PAD * 2;
  const DOMAIN_GAP = 20;
  const SERVICE_CARD_W = (CARD_W - 16 * 4) / 5;

  const f = makeFrame('5 — Service Layer Map', 7740, 0, W, 1);
  makeTitleBar(f, 'Service Layer Map', '30+ service modules in server/src/services/ — organized by domain', C.ml);

  let currentY = START_Y + 20;

  for (const domain of SERVICES_DATA) {
    const serviceRows = Math.ceil(domain.services.length / 3);
    const domainH = 36 + serviceRows * 90 + 16;

    // Domain background
    makeRect(f, PAD, currentY, CARD_W, domainH, C.section, 8);
    makeRect(f, PAD, currentY, CARD_W, 36, domain.color, 8);
    makeRect(f, PAD, currentY + 28, CARD_W, 8, domain.color);
    makeText(f, domain.domain.toUpperCase(), PAD + 14, currentY + 10, 11, C.white, 'Bold');
    makeText(f, domain.services.length + ' services', PAD + 14 + 200, currentY + 11, 10, C.muted, 'Regular');

    const svcCardW = Math.floor((CARD_W - 16 * 4) / 3);
    const SVC_COLS = 3;

    domain.services.forEach((svc, j) => {
      const col = j % SVC_COLS;
      const row = Math.floor(j / SVC_COLS);
      const sx = PAD + 14 + col * (svcCardW + 14);
      const sy = currentY + 44 + row * 82;

      makeRect(f, sx, sy, svcCardW, 70, C.card, 6);
      makeRect(f, sx, sy, svcCardW, 4, domain.color, 6);
      makeText(f, svc.name, sx + 8, sy + 12, 11, C.white, 'Medium', svcCardW - 16);
      makeText(f, svc.desc, sx + 8, sy + 30, 10, C.muted, 'Regular', svcCardW - 16);
    });

    currentY += domainH + DOMAIN_GAP;
  }

  f.resize(W, currentY + 40);
}

// ── Entry Point ────────────────────────────────────────────────────

figma.showUI(__html__, { width: 300, height: 400 });

figma.ui.onmessage = async (msg) => {
  if (msg.type !== 'generate') return;

  try {
    await loadFonts();

    const opts = msg.options;
    const builders = [];
    if (opts.f1) builders.push(buildAppOverview);
    if (opts.f2) builders.push(buildPageNav);
    if (opts.f3) builders.push(buildApiRoutes);
    if (opts.f4) builders.push(buildDataModels);
    if (opts.f5) builders.push(buildServiceLayer);

    for (const build of builders) {
      await build();
    }

    figma.viewport.scrollAndZoomIntoView(figma.currentPage.children);

    figma.ui.postMessage({
      type: 'done',
      text: `Generated ${builders.length} frame(s) successfully.`,
    });
  } catch (err) {
    figma.ui.postMessage({
      type: 'error',
      text: String(err && err.message ? err.message : err),
    });
  }
};

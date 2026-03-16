# Alpha Terminal — n8n Workflows

12 automation workflows for the Alpha Terminal trading platform.

## Setup

### 1. Start n8n
```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```
Open http://localhost:5678

### 2. Set n8n Variables (Settings → Variables)

| Variable | Description | Required |
|---|---|---|
| `DUMMY_API_URL` | Your backend URL (e.g. `http://localhost:3001`) | ✅ |
| `INTERNAL_API_KEY` | Secret key for internal API calls | ✅ |
| `DISCORD_WEBHOOK_URL` | Default Discord webhook for alerts | ✅ |
| `SLACK_CHANNEL` | Slack channel name (e.g. `#trading-alerts`) | Optional |
| `GROQ_API_KEY` | Groq API key for AI sentiment analysis | Workflow 8 |
| `DISCORD_ML_WEBHOOK_URL` | Separate channel for ML signals | Optional |
| `DISCORD_SCREENER_WEBHOOK_URL` | Separate channel for screener hits | Optional |
| `DISCORD_ALPHA_WEBHOOK_URL` | Separate channel for alpha feed | Optional |
| `DISCORD_TOURNAMENT_WEBHOOK_URL` | Separate channel for tournament | Optional |

### 3. Set Credentials (Settings → Credentials)

- **Slack API** — OAuth token for Slack posting
- **SMTP** — Gmail/SendGrid for email notifications

### 4. Import Workflows

In n8n: Workflows → Import from File → select each JSON from `n8n/workflows/`

---

## Workflows

### Phase 1 — Core Notifications

| File | Webhook Path | Trigger |
|---|---|---|
| `01-order-fill-notifier.json` | `POST /webhook/order-fill` | Trade executed |
| `02-price-alert-dispatcher.json` | `POST /webhook/price-alert` | Alert triggered |
| `03-daily-market-data-sync.json` | Cron: 9am weekdays | Market open |
| `04-portfolio-digest.json` | Cron: 4:30pm weekdays | Market close |

**Webhook payload for order fill:**
```json
{
  "orderId": "ord_123",
  "symbol": "AAPL",
  "side": "BUY",
  "qty": 10,
  "price": 195.50,
  "totalValue": 1955.00,
  "userId": "user_456",
  "userEmail": "user@example.com",
  "timestamp": "2026-03-16T14:30:00Z"
}
```

**Webhook payload for price alert:**
```json
{
  "alertId": "alert_789",
  "symbol": "NVDA",
  "condition": "above",
  "triggerPrice": 900.00,
  "currentPrice": 901.25,
  "userId": "user_456",
  "userEmail": "user@example.com"
}
```

### Phase 2 — Intelligence Layer

| File | Trigger | Description |
|---|---|---|
| `05-ml-signal-alert.json` | `POST /webhook/ml-signal` | ML model flip → notify |
| `06-screener-runner.json` | Cron: every 15min market hours | Run screeners → post hits |
| `07-earnings-calendar.json` | Cron: 8am weekdays | Watchlist earnings alerts |
| `08-ai-news-summary.json` | `POST /webhook/news-summary` | Groq AI sentiment analysis |

**Webhook payload for ML signal:**
```json
{
  "symbol": "NVDA",
  "signal": "BULLISH",
  "confidence": 0.82,
  "modelName": "Ensemble v3",
  "rsi": 42.1,
  "macd": 0.045,
  "sentimentScore": 0.71
}
```

### Phase 3 — Supremacy Features

| File | Trigger | Description |
|---|---|---|
| `09-copy-trade-signal-executor.json` | `POST /webhook/copy-trade-signal` | Auto-execute for subscribers |
| `10-alpha-feed-anomaly-detector.json` | Cron: every 5min market hours | Volume/price anomalies |
| `11-quant-backtest-dispatcher.json` | `POST /webhook/backtest-run` | Async backtest pipeline |
| `12-tournament-leaderboard.json` | Cron: hourly market hours | Sharpe-ranked leaderboard |

---

## Enabling Direct Deploy via MCP

Add `N8N_API_URL` and `N8N_API_KEY` to your Claude Code MCP config:

```bash
claude mcp remove n8n
claude mcp add n8n \
  -e N8N_HOST=http://localhost:5678 \
  -e N8N_API_KEY=your_api_key \
  -e N8N_API_URL=http://localhost:5678 \
  -- npx -y n8n-mcp
```

Then workflows can be deployed directly without manual import.

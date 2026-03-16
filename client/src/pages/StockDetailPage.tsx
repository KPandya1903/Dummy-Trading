import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Typography,
  Box,
  Alert,
  Button,
  Chip,
  Paper,
  Grid,
} from '@mui/material';
import PageLoader from '../components/ui/PageLoader';
import StatCard from '../components/ui/StatCard';
import ChartEmptyState from '../components/ui/ChartEmptyState';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import useApi from '../hooks/useApi';
import StockNewsPanel from '../components/StockNewsPanel';
import { CHART_COLORS, CHART_TOOLTIP_STYLE, CHART_GRID_COLOR, CHART_AXIS_COLOR, getChartLineColor } from '../theme';
import AnimatedNumber from '../components/AnimatedNumber';
import FactorScorecard from '../components/FactorScorecard';
import ValuationContextPanel from '../components/ValuationContextPanel';

interface QuoteDetail {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  marketCap: number | null;
  pe: number | null;
  dividendYield: number | null;
  high52w: number | null;
  low52w: number | null;
  volume: number | null;
  sector: string | null;
  industry: string | null;
  history: { date: string; close: number }[];
}

function fmt(n: number | null): string {
  if (n === null) return 'N/A';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


export default function StockDetailPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const { data: quote, loading, error } = useApi<QuoteDetail>(
    ticker ? `/quotes/${ticker}` : null,
  );

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <>
        <Button component={RouterLink} to="/market" sx={{ mb: 2 }}>
          &larr; Back to Market
        </Button>
        <Alert severity="error">{error}</Alert>
      </>
    );
  }

  if (!quote) return null;

  const isLoggedIn = !!localStorage.getItem('token');
  const isPositive = quote.change >= 0;

  return (
    <>
      <Button component={RouterLink} to="/market" sx={{ mb: 1 }}>
        &larr; Back to Market
      </Button>

      {/* ── Header ──────────────────────────────────────── */}
      <Box display="flex" alignItems="center" gap={2} mb={1}>
        <Typography variant="h4" fontWeight="bold">
          {quote.ticker}
        </Typography>
        <Typography variant="h6" color="text.secondary">
          {quote.name}
        </Typography>
      </Box>

      <Box display="flex" alignItems="baseline" gap={2} mb={3}>
        <AnimatedNumber value={quote.price} prefix="$" variant="h4" />
        <Chip
          label={`${isPositive ? '+' : ''}${fmt(quote.change)} (${isPositive ? '+' : ''}${fmt(quote.changePct)}%)`}
          color={isPositive ? 'success' : 'error'}
          size="small"
        />
      </Box>

      {/* ── Stats grid ──────────────────────────────────── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <StatCard label="Market Cap" value={quote.marketCap !== null ? `$${fmt(quote.marketCap)}B` : 'N/A'} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="P/E Ratio" value={quote.pe !== null ? fmt(quote.pe) : 'N/A'} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="Div Yield" value={quote.dividendYield !== null ? `${fmt(quote.dividendYield)}%` : 'N/A'} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="Volume" value={quote.volume !== null ? quote.volume.toLocaleString() : 'N/A'} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="52w High" value={quote.high52w !== null ? `$${fmt(quote.high52w)}` : 'N/A'} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="52w Low" value={quote.low52w !== null ? `$${fmt(quote.low52w)}` : 'N/A'} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="Sector" value={quote.sector || 'N/A'} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="Industry" value={quote.industry || 'N/A'} />
        </Grid>
      </Grid>

      <ValuationContextPanel ticker={quote.ticker} />

      <FactorScorecard ticker={quote.ticker} />

      {/* ── Price chart ─────────────────────────────────── */}
      <>
        <Typography variant="h6" gutterBottom>
          1-Year Price History
        </Typography>
        <Paper variant="outlined" sx={{ p: 2, mb: 4 }}>
          {quote.history.length === 0 ? (
            <ChartEmptyState message="No price history available" height={300} />
          ) : (
            <Box role="img" aria-label={`${quote.ticker} 1-year price history chart`}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={quote.history}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => d.slice(5)}
                  interval="preserveStartEnd"
                  minTickGap={60}
                  tick={{ fill: CHART_AXIS_COLOR }}
                />
                <YAxis domain={['auto', 'auto']} tick={{ fill: CHART_AXIS_COLOR }} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Close']}
                  labelFormatter={(label) => String(label)}
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke={quote.history.length >= 2 ? getChartLineColor(quote.history[0].close, quote.history[quote.history.length - 1].close) : CHART_COLORS[0]}
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
            </Box>
          )}
        </Paper>
      </>

      {/* ── Action buttons ─────────────────────────────── */}
      <Box display="flex" gap={2} flexWrap="wrap" mb={3}>
        {isLoggedIn && (
          <Button
            component={RouterLink}
            to={`/trade?ticker=${quote.ticker}`}
            variant="contained"
            size="large"
          >
            Trade {quote.ticker}
          </Button>
        )}
        <Button
          component={RouterLink}
          to={`/stocks/${quote.ticker}/analysis`}
          variant="outlined"
          size="large"
        >
          Technical Analysis
        </Button>
        <Button
          component={RouterLink}
          to={`/predict/${quote.ticker}`}
          variant="outlined"
          size="large"
        >
          Price Prediction
        </Button>
      </Box>

      {/* ── News ─────────────────────────────────────────── */}
      <StockNewsPanel ticker={quote.ticker} />
    </>
  );
}

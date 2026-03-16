import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Alert,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Divider,
  Stack,
  Fade,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import useApi from '../hooks/useApi';
import DashboardPerformanceChart from '../components/DashboardPerformanceChart';
import AnimatedNumber from '../components/AnimatedNumber';
import MarketRegimePanel from '../components/MarketRegimePanel';
import PageLoader from '../components/ui/PageLoader';
import CollapsiblePanel from '../components/ui/CollapsiblePanel';
import StatRow from '../components/ui/StatRow';
import SectionHeader from '../components/ui/SectionHeader';

interface DashboardData {
  totalValue: number;
  totalStartingCash: number;
  totalReturnPct: number;
  cashRemaining: number;
  todaysChange: number;
  todaysChangePct: number;
  marketStatus: string;
  rank: number;
  totalPlayers: number;
  topPlayer: { email: string; totalValue: number; returnPct: number } | null;
  portfolios: {
    id: number;
    name: string;
    totalValue: number;
    returnPct: number;
  }[];
  holdings: {
    ticker: string;
    name: string;
    shares: number;
    avgCost: number;
    currentPrice: number;
    todayChange: number;
    todayChangePct: number;
    totalValue: number;
    totalGainLoss: number;
    totalGainLossPct: number;
  }[];
  topGainers: { ticker: string; value: number; pnl: number }[];
  topLosers: { ticker: string; value: number; pnl: number }[];
  recentTrades: {
    id: number;
    ticker: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    executedAt: string;
    portfolioName: string;
  }[];
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const panelSx = {
  p: 4,
  background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
  border: '1px solid rgba(0,200,5,0.1)',
  height: '100%',
};

export default function DashboardPage() {
  const { data, loading, error } = useApi<DashboardData>('/dashboard');
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    gameInfo: false,
    topMovers: true,
    holdings: true,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) return <PageLoader />;

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!data) return null;

  const portfolioIds = data.portfolios.map((p) => p.id);

  return (
    <Fade in timeout={400}>
    <Grid container spacing={4}>
      {/* ── OVERVIEW Panel ──────────────────────────────── */}
      <Grid item xs={12} md={5}>
        <Paper variant="outlined" sx={panelSx}>
          <SectionHeader>Overview</SectionHeader>

          <Typography variant="caption" color="text.secondary">
            ACCOUNT VALUE
          </Typography>
          <AnimatedNumber
            value={data.totalValue}
            prefix="$"
            variant="h3"
            fontWeight={700}
            sx={{ mb: 0.5, fontFamily: '"Playfair Display", serif' }}
          />

          <Box display="flex" alignItems="baseline" gap={1} mb={2}>
            <Typography
              variant="h6"
              color={data.todaysChange >= 0 ? 'success.main' : 'error.main'}
            >
              {data.todaysChange >= 0 ? '+' : ''}${fmt(data.todaysChange)}
            </Typography>
            <Typography
              variant="body2"
              color={data.todaysChangePct >= 0 ? 'success.main' : 'error.main'}
            >
              ({data.todaysChangePct >= 0 ? '+' : ''}
              {data.todaysChangePct}%)
            </Typography>
          </Box>

          <Divider sx={{ borderColor: 'rgba(0,200,5,0.1)', mb: 2 }} />

          <StatRow
            label="ANNUAL RETURN"
            value={`${data.totalReturnPct >= 0 ? '+' : ''}${data.totalReturnPct}%`}
            valueColor={data.totalReturnPct >= 0 ? 'success.main' : 'error.main'}
            tooltip="Return since account creation"
          />
          <StatRow label="CASH" value={`$${fmt(data.cashRemaining)}`} />
        </Paper>
      </Grid>

      {/* ── PERFORMANCE Panel ───────────────────────────── */}
      <Grid item xs={12} md={7}>
        <Paper variant="outlined" sx={panelSx}>
          <SectionHeader>Performance</SectionHeader>
          <DashboardPerformanceChart
            portfolioIds={portfolioIds}
            totalStartingCash={data.totalStartingCash}
          />
        </Paper>
      </Grid>

      {/* ── MARKET REGIME Panel ─────────────────────────── */}
      <Grid item xs={12}>
        <MarketRegimePanel />
      </Grid>

      {/* ── GAME INFO Panel ─────────────────────────────── */}
      <Grid item xs={12} md={5}>
        <CollapsiblePanel
          title="Game Info"
          expanded={expandedSections.gameInfo}
          onToggle={() => toggleSection('gameInfo')}
        >
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Typography variant="h4" fontWeight={700} color="primary.main">
              {data.rank.toLocaleString()}
            </Typography>
            <TrendingUpIcon color="success" fontSize="small" />
            <Typography variant="body1" color="text.secondary">
              of {data.totalPlayers.toLocaleString()} Players
            </Typography>
          </Box>

          {data.topPlayer && (
            <Box mb={2}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                TOP PLAYER
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <EmojiEventsIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                <Typography variant="body1" fontWeight={600}>
                  {data.topPlayer.email.split('@')[0]}
                </Typography>
                <Typography variant="body2" color="success.main">
                  ${fmt(data.topPlayer.totalValue)}
                </Typography>
              </Box>
            </Box>
          )}

          <Button
            variant="outlined"
            fullWidth
            component={RouterLink}
            to="/leaderboard"
            sx={{ mt: 1 }}
          >
            FULL LEADERBOARD
          </Button>
        </CollapsiblePanel>
      </Grid>

      {/* ── TOP MOVERS Panel ────────────────────────────── */}
      <Grid item xs={12} md={7}>
        <CollapsiblePanel
          title="Top Movers"
          expanded={expandedSections.topMovers}
          onToggle={() => toggleSection('topMovers')}
        >
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography
                variant="caption"
                color="success.main"
                fontWeight={700}
                sx={{ mb: 1, display: 'block' }}
              >
                GAINERS
              </Typography>
              {data.topGainers.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No gains yet
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {data.topGainers.map((g) => (
                    <Box
                      key={g.ticker}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Chip
                        label={g.ticker}
                        size="small"
                        clickable
                        component={RouterLink}
                        to={`/stocks/${g.ticker}`}
                      />
                      <Typography variant="body2" color="success.main">
                        +${fmt(g.pnl)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Grid>
            <Grid item xs={6}>
              <Typography
                variant="caption"
                color="error.main"
                fontWeight={700}
                sx={{ mb: 1, display: 'block' }}
              >
                LOSERS
              </Typography>
              {data.topLosers.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No losses yet
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {data.topLosers.map((l) => (
                    <Box
                      key={l.ticker}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Chip
                        label={l.ticker}
                        size="small"
                        clickable
                        component={RouterLink}
                        to={`/stocks/${l.ticker}`}
                      />
                      <Typography variant="body2" color="error.main">
                        ${fmt(l.pnl)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Grid>
          </Grid>
        </CollapsiblePanel>
      </Grid>

      {/* ── HOLDINGS section ────────────────────────────── */}
      <Grid item xs={12}>
        <CollapsiblePanel
          title="Holdings"
          expanded={expandedSections.holdings}
          onToggle={() => toggleSection('holdings')}
        >
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: data.marketStatus === 'REGULAR' ? 'success.main' : 'error.main',
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {data.marketStatus === 'REGULAR'
                ? 'Market is open'
                : data.marketStatus === 'PRE'
                  ? 'Pre-market session'
                  : data.marketStatus === 'POST'
                    ? 'After-hours session'
                    : 'Market is closed'}
            </Typography>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Symbol</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Current Price</TableCell>
                  <TableCell align="right">Today's Change</TableCell>
                  <TableCell align="right">Purchase Price</TableCell>
                  <TableCell align="right">QTY</TableCell>
                  <TableCell align="right">Total Value</TableCell>
                  <TableCell align="right">Total Gain/Loss</TableCell>
                  <TableCell align="center">Trade Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.holdings.map((h) => (
                  <TableRow key={h.ticker} hover>
                    <TableCell>
                      <Chip
                        label={h.ticker}
                        size="small"
                        clickable
                        component={RouterLink}
                        to={`/stocks/${h.ticker}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
                        {h.name}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">${fmt(h.currentPrice)}</TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={h.todayChange >= 0 ? 'success.main' : 'error.main'}
                      >
                        {h.todayChange >= 0 ? '+' : ''}
                        {fmt(h.todayChange)} ({h.todayChangePct >= 0 ? '+' : ''}
                        {h.todayChangePct.toFixed(2)}%)
                      </Typography>
                    </TableCell>
                    <TableCell align="right">${fmt(h.avgCost)}</TableCell>
                    <TableCell align="right">{h.shares}</TableCell>
                    <TableCell align="right">${fmt(h.totalValue)}</TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={h.totalGainLoss >= 0 ? 'success.main' : 'error.main'}
                      >
                        {h.totalGainLoss >= 0 ? '+' : ''}$
                        {fmt(Math.abs(h.totalGainLoss))} (
                        {h.totalGainLossPct >= 0 ? '+' : ''}
                        {h.totalGainLossPct.toFixed(2)}%)
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          onClick={() => navigate(`/trade?ticker=${h.ticker}`)}
                        >
                          Buy
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={() => navigate(`/trade?ticker=${h.ticker}&side=SELL`)}
                        >
                          Sell
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}

                {data.holdings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography variant="body2" color="text.secondary" py={3}>
                        You have no stock holdings yet
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Button
              variant="contained"
              component={RouterLink}
              to={
                data.portfolios.length === 1
                  ? `/portfolios/${data.portfolios[0].id}/trades`
                  : '/portfolios'
              }
            >
              TRADE HISTORY
            </Button>
          </Box>
        </CollapsiblePanel>
      </Grid>
    </Grid>
    </Fade>
  );
}

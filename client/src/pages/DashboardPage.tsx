import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Alert,
  CircularProgress,
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
  Tooltip,
  Stack,
  Collapse,
  IconButton,
  Fade,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import useApi from '../hooks/useApi';
import DashboardPerformanceChart from '../components/DashboardPerformanceChart';
import AnimatedNumber from '../components/AnimatedNumber';

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
  background: 'linear-gradient(135deg, #111d31 0%, #162240 100%)',
  border: '1px solid rgba(201,168,76,0.1)',
  height: '100%',
};

const sectionHeaderSx = {
  fontWeight: 700,
  fontSize: '0.75rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: '#7a8ba5',
  mb: 2.5,
};

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ ...panelSx, height: 'auto' }}>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        onClick={onToggle}
        sx={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <Typography sx={{ ...sectionHeaderSx, mb: 0 }}>{title}</Typography>
        <IconButton size="small">
          <ExpandMoreIcon
            sx={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease',
              color: 'text.secondary',
            }}
          />
        </IconButton>
      </Box>
      <Collapse in={expanded} timeout={350}>
        <Box sx={{ mt: 2 }}>{children}</Box>
      </Collapse>
    </Paper>
  );
}

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

  if (loading) {
    return (
      <Box textAlign="center" mt={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!data) return null;

  const portfolioIds = data.portfolios.map((p) => p.id);

  return (
    <Fade in timeout={400}>
    <Grid container spacing={3.5}>
      {/* ── OVERVIEW Panel ──────────────────────────────── */}
      <Grid item xs={12} md={5}>
        <Paper variant="outlined" sx={panelSx}>
          <Typography sx={sectionHeaderSx}>Overview</Typography>

          <Typography variant="caption" color="text.secondary">
            ACCOUNT VALUE
          </Typography>
          <AnimatedNumber
            value={data.totalValue}
            prefix="$"
            variant="h3"
            fontWeight={700}
            sx={{ mb: 0.5 }}
          />

          {/* Today's Change */}
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

          <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)', mb: 2 }} />

          {/* Stats rows */}
          <StatRow
            label="ANNUAL RETURN"
            value={`${data.totalReturnPct >= 0 ? '+' : ''}${data.totalReturnPct}%`}
            color={data.totalReturnPct >= 0 ? 'success.main' : 'error.main'}
            tooltip="Return since account creation"
          />
          <StatRow
            label="BUYING POWER"
            value={`$${fmt(data.cashRemaining)}`}
          />
          <StatRow label="CASH" value={`$${fmt(data.cashRemaining)}`} />
        </Paper>
      </Grid>

      {/* ── PERFORMANCE Panel ───────────────────────────── */}
      <Grid item xs={12} md={7}>
        <Paper variant="outlined" sx={panelSx}>
          <Typography sx={sectionHeaderSx}>Performance</Typography>
          <DashboardPerformanceChart
            portfolioIds={portfolioIds}
            totalStartingCash={data.totalStartingCash}
          />
        </Paper>
      </Grid>

      {/* ── GAME INFO Panel ─────────────────────────────── */}
      <Grid item xs={12} md={5}>
        <CollapsibleSection
          title="Game Info"
          expanded={expandedSections.gameInfo}
          onToggle={() => toggleSection('gameInfo')}
        >
          <Box display="flex" alignItems="baseline" gap={1} mb={0.5}>
            <Typography variant="caption" color="text.secondary">
              CURRENT RANK
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Typography
              variant="h4"
              fontWeight={700}
              color="primary.main"
            >
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
                <EmojiEventsIcon
                  sx={{ color: 'warning.main', fontSize: 20 }}
                />
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
        </CollapsibleSection>
      </Grid>

      {/* ── TOP MOVERS Panel ────────────────────────────── */}
      <Grid item xs={12} md={7}>
        <CollapsibleSection
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
        </CollapsibleSection>
      </Grid>

      {/* ── HOLDINGS section ────────────────────────────── */}
      <Grid item xs={12}>
        <CollapsibleSection
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
                bgcolor:
                  data.marketStatus === 'REGULAR'
                    ? 'success.main'
                    : 'error.main',
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
                        color={
                          h.todayChange >= 0 ? 'success.main' : 'error.main'
                        }
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
                        color={
                          h.totalGainLoss >= 0 ? 'success.main' : 'error.main'
                        }
                      >
                        {h.totalGainLoss >= 0 ? '+' : ''}$
                        {fmt(Math.abs(h.totalGainLoss))} (
                        {h.totalGainLossPct >= 0 ? '+' : ''}
                        {h.totalGainLossPct.toFixed(2)}%)
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Stack
                        direction="row"
                        spacing={0.5}
                        justifyContent="center"
                      >
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          onClick={() =>
                            navigate(`/trade?ticker=${h.ticker}`)
                          }
                        >
                          Buy
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={() =>
                            navigate(
                              `/trade?ticker=${h.ticker}&side=SELL`,
                            )
                          }
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
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        py={3}
                      >
                        You have no stock holdings yet
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Trade History button */}
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
        </CollapsibleSection>
      </Grid>
    </Grid>
    </Fade>
  );
}

// ── Stat row helper ─────────────────────────────────────
function StatRow({
  label,
  value,
  color,
  tooltip: tip,
}: {
  label: string;
  value: string;
  color?: string;
  tooltip?: string;
}) {
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      py={1}
    >
      <Box display="flex" alignItems="center" gap={0.5}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        {tip && (
          <Tooltip title={tip} arrow>
            <InfoOutlinedIcon
              sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }}
            />
          </Tooltip>
        )}
      </Box>
      <Typography variant="body1" fontWeight={600} color={color}>
        {value}
      </Typography>
    </Box>
  );
}

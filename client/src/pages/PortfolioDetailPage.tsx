import { useState, useEffect, useRef } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
  Button,
  Chip,
  Box,
  Alert,
  IconButton,
  Breadcrumbs,
  Link as MuiLink,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import useApi from '../hooks/useApi';
import apiClient from '../apiClient';
import TradeForm from '../components/TradeForm';
import PortfolioChart from '../components/PortfolioChart';
import DiversificationChart from '../components/DiversificationChart';
import SectorChart from '../components/SectorChart';
import PortfolioRiskMetrics from '../components/PortfolioRiskMetrics';
import PositionSizingPanel from '../components/PositionSizingPanel';
import BehavioralBiasPanel from '../components/BehavioralBiasPanel';
import PageLoader from '../components/ui/PageLoader';
import { useToast } from '../context/ToastContext';

interface Position {
  ticker: string;
  shares: number;
  avgCost: number;
  sector?: string;
}

interface Summary {
  portfolioId: number;
  name: string;
  cashRemaining: number;
  positions: Position[];
  currentPrices: Record<string, number>;
  realizedPnL: number;
  unrealizedPnL: number;
  positionsValue: number;
  totalValue: number;
}

interface PendingOrder {
  id: number;
  ticker: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'LIMIT' | 'STOP';
  targetPrice: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  createdAt: string;
}

interface PositionCellRefs {
  mktPriceEl: HTMLElement;
  mktValueEl: HTMLElement;
  unrealizedEl: HTMLElement;
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    data: summary,
    loading,
    error,
    refetch,
  } = useApi<Summary>(`/portfolios/${id}/summary`);  // no poll interval

  const {
    data: orders,
    refetch: refetchOrders,
  } = useApi<PendingOrder[]>('/orders', { portfolioId: id });

  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const { showToast } = useToast();

  const cancelOrder = async () => {
    if (cancelTarget === null) return;
    try {
      await apiClient.delete(`/orders/${cancelTarget}`);
      refetchOrders();
    } catch {
      showToast('Failed to cancel order. Please try again.', 'error');
    } finally {
      setCancelTarget(null);
    }
  };

  const handleTradeSuccess = () => {
    refetch();
    refetchOrders();
  };

  // ── Refs for live-updated summary stats ──
  const cashRef = useRef<HTMLElement>(null);
  const positionsValueRef = useRef<HTMLElement>(null);
  const totalValueRef = useRef<HTMLElement>(null);
  const realizedPnLRef = useRef<HTMLElement>(null);
  const unrealizedPnLRef = useRef<HTMLElement>(null);

  // ── Refs for positions table cells ──
  const positionRefs = useRef<Map<string, PositionCellRefs>>(new Map());

  // ── Direct poll — zero React re-renders ──
  useEffect(() => {
    if (!summary || !id) return;
    const pollId = setInterval(async () => {
      try {
        const { data: s } = await apiClient.get<Summary>(`/portfolios/${id}/summary`);

        // Summary stats
        if (cashRef.current) cashRef.current.textContent = `$${fmt(s.cashRemaining)}`;
        if (positionsValueRef.current) positionsValueRef.current.textContent = `$${fmt(s.positionsValue)}`;
        if (totalValueRef.current) totalValueRef.current.textContent = `$${fmt(s.totalValue)}`;
        if (realizedPnLRef.current) {
          realizedPnLRef.current.textContent = `$${fmt(s.realizedPnL)}`;
          realizedPnLRef.current.style.color = s.realizedPnL >= 0 ? '#00C805' : '#ff4d4d';
        }
        if (unrealizedPnLRef.current) {
          unrealizedPnLRef.current.textContent = `$${fmt(s.unrealizedPnL)}`;
          unrealizedPnLRef.current.style.color = s.unrealizedPnL >= 0 ? '#00C805' : '#ff4d4d';
        }

        // Positions table
        for (const p of s.positions) {
          const cells = positionRefs.current.get(p.ticker);
          if (!cells) continue;

          const mktPrice = s.currentPrices[p.ticker] ?? p.avgCost;
          const mktValue = p.shares * mktPrice;
          const unrealized = (mktPrice - p.avgCost) * p.shares;

          const prev = Number(cells.mktPriceEl.dataset.price ?? 0);
          if (prev !== mktPrice) {
            cells.mktPriceEl.textContent = `$${fmt(mktPrice)}`;
            cells.mktPriceEl.dataset.price = String(mktPrice);
            const row = cells.mktPriceEl.closest('tr') as HTMLElement | null;
            if (row) {
              row.classList.remove('flash-up', 'flash-down');
              void row.offsetHeight;
              row.classList.add(mktPrice > prev ? 'flash-up' : 'flash-down');
              setTimeout(() => row.classList.remove('flash-up', 'flash-down'), 650);
            }
          }

          cells.mktValueEl.textContent = `$${fmt(mktValue)}`;

          const prefix = unrealized > 0 ? '+' : '';
          cells.unrealizedEl.textContent = `${prefix}$${fmt(unrealized)}`;
          cells.unrealizedEl.style.color = unrealized >= 0 ? '#00C805' : unrealized < 0 ? '#ff4d4d' : '';
        }
      } catch { /* ignore poll errors */ }
    }, 5_000);
    return () => clearInterval(pollId);
  }, [!!summary, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PageLoader variant="table" />;

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!summary) return null;

  const pnlColor = (v: number) => (v >= 0 ? 'success.main' : 'error.main');

  return (
    <>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
        <MuiLink component={RouterLink} to="/portfolios" color="inherit" underline="hover">
          Portfolios
        </MuiLink>
        <Typography color="text.primary">{summary.name}</Typography>
      </Breadcrumbs>

      <Typography variant="h4" gutterBottom>
        {summary.name}
      </Typography>

      {/* ── Summary stats ─────────────────────────────── */}
      <Stack
        direction="row"
        spacing={4}
        mb={4}
        flexWrap="wrap"
        useFlexGap
        sx={{
          '& > *': {
            minWidth: 130,
            p: 2.5,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
          },
        }}
      >
        <Box>
          <Typography variant="overline">Cash</Typography>
          <Typography ref={cashRef} variant="h6">${fmt(summary.cashRemaining)}</Typography>
        </Box>
        <Box>
          <Typography variant="overline">Positions Value</Typography>
          <Typography ref={positionsValueRef} variant="h6">${fmt(summary.positionsValue)}</Typography>
        </Box>
        <Box>
          <Typography variant="overline">Total Value</Typography>
          <Typography ref={totalValueRef} variant="h6" sx={{ fontFamily: '"Playfair Display", serif' }}>${fmt(summary.totalValue)}</Typography>
        </Box>
        <Box>
          <Typography variant="overline">Realized P&amp;L</Typography>
          <Typography ref={realizedPnLRef} variant="h6" color={pnlColor(summary.realizedPnL)}>
            ${fmt(summary.realizedPnL)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="overline">Unrealized P&amp;L</Typography>
          <Typography ref={unrealizedPnLRef} variant="h6" color={pnlColor(summary.unrealizedPnL)}>
            ${fmt(summary.unrealizedPnL)}
          </Typography>
        </Box>
      </Stack>

      {/* ── Performance chart ─────────────────────────── */}
      <PortfolioChart portfolioId={summary.portfolioId} />

      <PortfolioRiskMetrics portfolioId={summary.portfolioId} />

      <PositionSizingPanel portfolioId={summary.portfolioId} />

      <BehavioralBiasPanel portfolioId={summary.portfolioId} />

      {/* ── Positions table ───────────────────────────── */}
      <Typography variant="h6" gutterBottom>
        Positions
      </Typography>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ticker</TableCell>
              <TableCell align="right">Shares</TableCell>
              <TableCell align="right">Avg Cost</TableCell>
              <TableCell align="right">Mkt Price</TableCell>
              <TableCell align="right">Mkt Value</TableCell>
              <TableCell align="right">Unrealized P&amp;L</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {summary.positions.map((p) => {
              const mktPrice = summary.currentPrices[p.ticker] ?? p.avgCost;
              const mktValue = p.shares * mktPrice;
              const unrealized = (mktPrice - p.avgCost) * p.shares;

              return (
                <PositionRow
                  key={p.ticker}
                  ticker={p.ticker}
                  shares={p.shares}
                  avgCost={p.avgCost}
                  mktPrice={mktPrice}
                  mktValue={mktValue}
                  unrealized={unrealized}
                  positionRefs={positionRefs}
                />
              );
            })}

            {summary.positions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No open positions. Execute a trade below.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Diversification pie chart ───────────────── */}
      <DiversificationChart
        positions={summary.positions}
        currentPrices={summary.currentPrices}
        cashRemaining={summary.cashRemaining}
      />

      {/* ── Sector breakdown chart ─────────────────────── */}
      <SectorChart
        positions={summary.positions}
        currentPrices={summary.currentPrices}
      />

      {/* ── Pending orders ─────────────────────────────── */}
      {orders && orders.filter((o) => o.status === 'PENDING').length > 0 && (
        <>
          <Typography variant="h6" gutterBottom>
            Pending Orders
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ticker</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Side</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Target Price</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {orders
                  .filter((o) => o.status === 'PENDING')
                  .map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Chip label={o.ticker} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip label={o.orderType} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={o.side}
                          size="small"
                          color={o.side === 'BUY' ? 'success' : 'error'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">{o.quantity}</TableCell>
                      <TableCell align="right">${fmt(o.targetPrice)}</TableCell>
                      <TableCell>
                        {new Date(o.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setCancelTarget(o.id)}
                          aria-label={`Cancel order: ${o.side} ${o.quantity} ${o.ticker}`}
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* ── Cancel order confirmation ─────────────────── */}
      <Dialog open={cancelTarget !== null} onClose={() => setCancelTarget(null)}>
        <DialogTitle>Cancel Order</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to cancel this pending order? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelTarget(null)}>Keep Order</Button>
          <Button color="error" variant="contained" onClick={cancelOrder}>
            Cancel Order
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Trade form ────────────────────────────────── */}
      <TradeForm portfolioId={summary.portfolioId} onSuccess={handleTradeSuccess} />
    </>
  );
}

// ── Position row — registers refs, never re-renders on price polls ──
function PositionRow({
  ticker, shares, avgCost, mktPrice, mktValue, unrealized, positionRefs,
}: {
  ticker: string; shares: number; avgCost: number;
  mktPrice: number; mktValue: number; unrealized: number;
  positionRefs: React.MutableRefObject<Map<string, PositionCellRefs>>;
}) {
  const mktPriceRef = useRef<HTMLTableCellElement>(null);
  const mktValueRef = useRef<HTMLTableCellElement>(null);
  const unrealizedRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (mktPriceRef.current && mktValueRef.current && unrealizedRef.current) {
      positionRefs.current.set(ticker, {
        mktPriceEl: mktPriceRef.current,
        mktValueEl: mktValueRef.current,
        unrealizedEl: unrealizedRef.current,
      });
    }
    return () => { positionRefs.current.delete(ticker); };
  }, [ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  const pnlColor = unrealized > 0 ? '#00C805' : unrealized < 0 ? '#ff4d4d' : undefined;

  return (
    <TableRow>
      <TableCell>
        <Chip label={ticker} size="small" />
      </TableCell>
      <TableCell align="right">{shares}</TableCell>
      <TableCell align="right">${fmt(avgCost)}</TableCell>
      <TableCell ref={mktPriceRef} align="right" data-price={mktPrice}>
        ${fmt(mktPrice)}
      </TableCell>
      <TableCell ref={mktValueRef} align="right">
        ${fmt(mktValue)}
      </TableCell>
      <TableCell ref={unrealizedRef} align="right" style={{ color: pnlColor }}>
        {unrealized > 0 ? '+' : ''}${fmt(unrealized)}
      </TableCell>
    </TableRow>
  );
}

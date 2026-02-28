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
  CircularProgress,
  IconButton,
} from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import useApi from '../hooks/useApi';
import apiClient from '../apiClient';
import TradeForm from '../components/TradeForm';
import PortfolioChart from '../components/PortfolioChart';
import DiversificationChart from '../components/DiversificationChart';
import SectorChart from '../components/SectorChart';
import PortfolioRiskMetrics from '../components/PortfolioRiskMetrics';

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

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PnLCell({ value }: { value: number }) {
  const color = value > 0 ? 'success.main' : value < 0 ? 'error.main' : 'text.primary';
  const prefix = value > 0 ? '+' : '';
  return (
    <Typography variant="body2" color={color} component="span">
      {prefix}${fmt(value)}
    </Typography>
  );
}

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    data: summary,
    loading,
    error,
    refetch,
  } = useApi<Summary>(`/portfolios/${id}/summary`);

  const {
    data: orders,
    refetch: refetchOrders,
  } = useApi<PendingOrder[]>('/orders', { portfolioId: id });

  const cancelOrder = async (orderId: number) => {
    try {
      await apiClient.delete(`/orders/${orderId}`);
      refetchOrders();
    } catch { /* ignore */ }
  };

  const handleTradeSuccess = () => {
    refetch();
    refetchOrders();
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

  if (!summary) return null;

  const pnlColor = (v: number) => (v >= 0 ? 'success.main' : 'error.main');

  return (
    <>
      <Button component={RouterLink} to="/portfolios" sx={{ mb: 1 }}>
        &larr; All Portfolios
      </Button>

      <Typography variant="h4" gutterBottom>
        {summary.name}
      </Typography>

      {/* ── Summary stats ─────────────────────────────── */}
      <Stack
        direction="row"
        spacing={3.5}
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
          <Typography variant="h6">${fmt(summary.cashRemaining)}</Typography>
        </Box>
        <Box>
          <Typography variant="overline">Positions Value</Typography>
          <Typography variant="h6">${fmt(summary.positionsValue)}</Typography>
        </Box>
        <Box>
          <Typography variant="overline">Total Value</Typography>
          <Typography variant="h6">${fmt(summary.totalValue)}</Typography>
        </Box>
        <Box>
          <Typography variant="overline">Realized P&amp;L</Typography>
          <Typography variant="h6" color={pnlColor(summary.realizedPnL)}>
            ${fmt(summary.realizedPnL)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="overline">Unrealized P&amp;L</Typography>
          <Typography variant="h6" color={pnlColor(summary.unrealizedPnL)}>
            ${fmt(summary.unrealizedPnL)}
          </Typography>
        </Box>
      </Stack>

      {/* ── Performance chart ─────────────────────────── */}
      <PortfolioChart portfolioId={summary.portfolioId} />

      <PortfolioRiskMetrics portfolioId={summary.portfolioId} />

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
                <TableRow key={p.ticker}>
                  <TableCell>
                    <Chip label={p.ticker} size="small" />
                  </TableCell>
                  <TableCell align="right">{p.shares}</TableCell>
                  <TableCell align="right">${fmt(p.avgCost)}</TableCell>
                  <TableCell align="right">${fmt(mktPrice)}</TableCell>
                  <TableCell align="right">${fmt(mktValue)}</TableCell>
                  <TableCell align="right">
                    <PnLCell value={unrealized} />
                  </TableCell>
                </TableRow>
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
                          onClick={() => cancelOrder(o.id)}
                          title="Cancel order"
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

      {/* ── Trade form ────────────────────────────────── */}
      <TradeForm portfolioId={summary.portfolioId} onSuccess={handleTradeSuccess} />
    </>
  );
}

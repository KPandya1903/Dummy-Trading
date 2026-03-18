import { useState, FormEvent } from 'react';
import {
  Typography,
  TextField,
  Button,
  Stack,
  Paper,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  MenuItem,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import useApi from '../../hooks/useApi';
import apiClient from '../../apiClient';
import TradeForm from '../../components/trading/TradeForm';
import PageLoader from '../../components/ui/PageLoader';

interface WatchlistItem {
  id: number;
  ticker: string;
  alertAbove: number | null;
  alertBelow: number | null;
  alertTriggered: boolean;
  createdAt: string;
}

interface Portfolio {
  id: number;
  name: string;
}

export default function WatchlistPage() {
  const { data: items, loading, error, refetch } = useApi<WatchlistItem[]>(
    '/watchlist',
    undefined,
    5_000,
  );
  const { data: portfolios } = useApi<Portfolio[]>('/portfolios');

  // ── Add ticker form ────────────────────────────────────
  const [ticker, setTicker] = useState('');
  const [addError, setAddError] = useState('');

  // ── Paper Buy dialog ───────────────────────────────────
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyTicker, setBuyTicker] = useState('');
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | ''>('');

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setAddError('');
    try {
      await apiClient.post('/watchlist', {
        ticker: ticker.toUpperCase(),
      });
      setTicker('');
      refetch();
    } catch (err: any) {
      setAddError(err.response?.data?.error || 'Failed to add ticker');
    }
  };

  const handleRemove = async (itemId: number) => {
    try {
      await apiClient.delete(`/watchlist/${itemId}`);
      refetch();
    } catch {
      // silently fail
    }
  };

  const openPaperBuy = (tickerSymbol: string) => {
    setBuyTicker(tickerSymbol);
    // Auto-select if user has exactly one portfolio
    if (portfolios?.length === 1) {
      setSelectedPortfolioId(portfolios[0].id);
    } else {
      setSelectedPortfolioId('');
    }
    setBuyOpen(true);
  };

  if (loading) return <PageLoader variant="table" />;

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Watchlist
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {addError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {addError}
        </Alert>
      )}

      <Stack component="form" onSubmit={handleAdd} direction="row" spacing={2} mb={4}>
        <TextField
          label="Ticker symbol"
          size="small"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          required
          sx={{ width: 160 }}
        />
        <Button type="submit" variant="contained">
          Add to Watchlist
        </Button>
      </Stack>

      {/* ── Watchlist table ───────────────────────────── */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ticker</TableCell>
              <TableCell>Added</TableCell>
              <TableCell align="center">Alert Above</TableCell>
              <TableCell align="center">Alert Below</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items?.map((item) => (
              <TableRow
                key={item.id}
                sx={item.alertTriggered ? { bgcolor: 'warning.light' } : undefined}
              >
                <TableCell>
                  <Chip label={item.ticker} size="small" />
                </TableCell>
                <TableCell>
                  {new Date(item.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell align="center">
                  <TextField
                    size="small"
                    type="number"
                    placeholder="—"
                    defaultValue={item.alertAbove ?? ''}
                    onBlur={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      if (val !== item.alertAbove) {
                        apiClient
                          .patch(`/watchlist/${item.id}`, {
                            alertAbove: val,
                            alertBelow: item.alertBelow,
                          })
                          .then(() => refetch());
                      }
                    }}
                    sx={{ width: 100 }}
                    inputProps={{ step: '0.01', min: 0 }}
                  />
                </TableCell>
                <TableCell align="center">
                  <TextField
                    size="small"
                    type="number"
                    placeholder="—"
                    defaultValue={item.alertBelow ?? ''}
                    onBlur={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      if (val !== item.alertBelow) {
                        apiClient
                          .patch(`/watchlist/${item.id}`, {
                            alertAbove: item.alertAbove,
                            alertBelow: val,
                          })
                          .then(() => refetch());
                      }
                    }}
                    sx={{ width: 100 }}
                    inputProps={{ step: '0.01', min: 0 }}
                  />
                </TableCell>
                <TableCell align="center">
                  {item.alertTriggered ? (
                    <Chip label="Triggered" size="small" color="warning" />
                  ) : item.alertAbove || item.alertBelow ? (
                    <Chip label="Active" size="small" color="info" variant="outlined" />
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      No alert
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      size="small"
                      variant="outlined"
                      color="success"
                      onClick={() => openPaperBuy(item.ticker)}
                    >
                      Paper Buy
                    </Button>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemove(item.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}

            {items?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No tickers yet. Add a ticker symbol above to start watching.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Paper Buy dialog ──────────────────────────── */}
      <Dialog
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Paper Buy &mdash; {buyTicker}</DialogTitle>
        <DialogContent>
          {/* Portfolio picker */}
          {!selectedPortfolioId && (
            <TextField
              select
              label="Select portfolio"
              size="small"
              fullWidth
              value=""
              onChange={(e) => setSelectedPortfolioId(Number(e.target.value))}
              sx={{ mt: 1, mb: 2 }}
            >
              {portfolios?.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
          )}

          {selectedPortfolioId && (
            <>
              {portfolios && portfolios.length > 1 && (
                <Typography variant="body2" color="text.secondary" mb={1}>
                  Portfolio:{' '}
                  <strong>
                    {portfolios.find((p) => p.id === selectedPortfolioId)?.name}
                  </strong>
                </Typography>
              )}
              <TradeForm
                portfolioId={selectedPortfolioId as number}
                initialTicker={buyTicker}
                initialSide="BUY"
                onSuccess={() => {
                  setBuyOpen(false);
                }}
              />
            </>
          )}

          {(!portfolios || portfolios.length === 0) && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              You need to create a portfolio first before placing a paper trade.
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

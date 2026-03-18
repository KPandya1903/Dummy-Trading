import { useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  IconButton,
  Collapse,
  Tooltip,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import useApi from '../../hooks/useApi';
import apiClient from '../../apiClient';
import { useToast } from '../../context/ToastContext';

interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

interface OptionPnL {
  totalCost: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
}

interface OptionPosition {
  id: number;
  ticker: string;
  optionType: 'CALL' | 'PUT';
  side: 'BUY' | 'SELL';
  strikePrice: number;
  expirationDate: string;
  quantity: number;
  premium: number;
  spotPrice: number;
  currentPremium: number;
  greeks: OptionGreeks;
  pnl: OptionPnL;
  moneyness: 'ITM' | 'ATM' | 'OTM';
  breakeven: number;
  daysToExpiry: number;
}

interface OptionsPositionsProps {
  portfolioId: number;
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OptionsPositions({ portfolioId }: OptionsPositionsProps) {
  const { data: positions, loading, refetch } = useApi<OptionPosition[]>(
    '/options',
    { portfolioId },
  );

  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [closeDialog, setCloseDialog] = useState<OptionPosition | null>(null);
  const [closePrice, setClosePrice] = useState('');
  const [exerciseTarget, setExerciseTarget] = useState<number | null>(null);

  const { showToast } = useToast();

  const handleClose = async () => {
    if (!closeDialog) return;
    try {
      await apiClient.patch(`/options/${closeDialog.id}/close`, {
        closePrice: Number(closePrice),
      });
      showToast(`Closed ${closeDialog.ticker} ${closeDialog.optionType} $${fmt(closeDialog.strikePrice)}`);
      setCloseDialog(null);
      setClosePrice('');
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to close position', 'error');
    }
  };

  const handleExercise = async () => {
    if (exerciseTarget === null) return;
    try {
      await apiClient.post(`/options/${exerciseTarget}/exercise`);
      showToast('Option exercised successfully');
      setExerciseTarget(null);
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to exercise option', 'error');
    }
  };

  if (loading) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>Options Positions</Typography>
        <Skeleton variant="rectangular" height={200} />
      </Box>
    );
  }

  if (!positions || positions.length === 0) return null;

  const moneynessColor = (m: string) => {
    if (m === 'ITM') return 'success' as const;
    if (m === 'OTM') return 'error' as const;
    return 'default' as const;
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Options Positions
      </Typography>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Ticker</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Side</TableCell>
              <TableCell align="right">Strike</TableCell>
              <TableCell>Expiry</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right">Premium</TableCell>
              <TableCell align="right">Current</TableCell>
              <TableCell align="right">P&amp;L</TableCell>
              <TableCell align="right">P&amp;L%</TableCell>
              <TableCell>Moneyness</TableCell>
              <TableCell align="right">Days Left</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {positions.map((pos) => {
              const pnlColor = pos.pnl.unrealizedPnL >= 0 ? '#00C805' : '#ff5252';
              const isExpanded = expandedRow === pos.id;

              return (
                <>
                  <TableRow key={pos.id}>
                    <TableCell sx={{ width: 32 }}>
                      <IconButton
                        size="small"
                        onClick={() => setExpandedRow(isExpanded ? null : pos.id)}
                      >
                        {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Chip label={pos.ticker} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={pos.optionType}
                        size="small"
                        color={pos.optionType === 'CALL' ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={pos.side}
                        size="small"
                        color={pos.side === 'BUY' ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">${fmt(pos.strikePrice)}</TableCell>
                    <TableCell>{pos.expirationDate}</TableCell>
                    <TableCell align="right">{pos.quantity}</TableCell>
                    <TableCell align="right">${fmt(pos.premium)}</TableCell>
                    <TableCell align="right">${fmt(pos.currentPremium)}</TableCell>
                    <TableCell align="right" sx={{ color: pnlColor, fontWeight: 600 }}>
                      {pos.pnl.unrealizedPnL >= 0 ? '+' : ''}${fmt(pos.pnl.unrealizedPnL)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: pnlColor, fontWeight: 600 }}>
                      {pos.pnl.unrealizedPnLPct >= 0 ? '+' : ''}{fmt(pos.pnl.unrealizedPnLPct)}%
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={pos.moneyness}
                        size="small"
                        color={moneynessColor(pos.moneyness)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={pos.expirationDate}>
                        <span style={{ color: pos.daysToExpiry <= 7 ? '#ffab00' : undefined }}>
                          {pos.daysToExpiry}d
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5}>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={() => {
                            setCloseDialog(pos);
                            setClosePrice(pos.currentPremium.toString());
                          }}
                        >
                          Close
                        </Button>
                        {pos.side === 'BUY' && pos.moneyness === 'ITM' && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            onClick={() => setExerciseTarget(pos.id)}
                          >
                            Exercise
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>

                  {/* Expandable Greeks row */}
                  <TableRow key={`${pos.id}-greeks`}>
                    <TableCell colSpan={14} sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                      <Collapse in={isExpanded} timeout={250} unmountOnExit>
                        <Box
                          sx={{
                            p: 2,
                            display: 'flex',
                            gap: 4,
                            bgcolor: 'rgba(0,200,5,0.03)',
                            borderRadius: 1,
                            my: 1,
                          }}
                        >
                          <Box>
                            <Typography variant="caption" color="text.secondary">Delta</Typography>
                            <Typography variant="body2" fontWeight={600}>{pos.greeks.delta.toFixed(4)}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Gamma</Typography>
                            <Typography variant="body2" fontWeight={600}>{pos.greeks.gamma.toFixed(4)}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Theta</Typography>
                            <Typography variant="body2" fontWeight={600} sx={{ color: '#ff5252' }}>
                              {pos.greeks.theta.toFixed(4)}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Vega</Typography>
                            <Typography variant="body2" fontWeight={600}>{pos.greeks.vega.toFixed(4)}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Breakeven</Typography>
                            <Typography variant="body2" fontWeight={600}>${fmt(pos.breakeven)}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Spot Price</Typography>
                            <Typography variant="body2" fontWeight={600}>${fmt(pos.spotPrice)}</Typography>
                          </Box>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Close Position Dialog */}
      <Dialog open={closeDialog !== null} onClose={() => setCloseDialog(null)}>
        <DialogTitle>Close Option Position</DialogTitle>
        <DialogContent>
          {closeDialog && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Closing {closeDialog.quantity} contract(s) of {closeDialog.ticker}{' '}
                {closeDialog.optionType} ${fmt(closeDialog.strikePrice)}
              </Typography>
              <TextField
                label="Close Price (per share)"
                type="number"
                value={closePrice}
                onChange={(e) => setClosePrice(e.target.value)}
                fullWidth
                inputProps={{ step: '0.01' }}
                autoFocus
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseDialog(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleClose}
            disabled={!closePrice || Number(closePrice) <= 0}
          >
            Close Position
          </Button>
        </DialogActions>
      </Dialog>

      {/* Exercise Confirmation Dialog */}
      <Dialog open={exerciseTarget !== null} onClose={() => setExerciseTarget(null)}>
        <DialogTitle>Exercise Option</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to exercise this option? This will convert the option into a stock position.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExerciseTarget(null)}>Cancel</Button>
          <Button color="primary" variant="contained" onClick={handleExercise}>
            Exercise
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

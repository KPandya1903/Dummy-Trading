import { useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import useApi from '../../hooks/useApi';

interface RealizedGain {
  ticker: string;
  buyDate: string;
  sellDate: string;
  quantity: number;
  costBasis: number;
  sellPrice: number;
  gain: number;
  holdingDays: number;
  isLongTerm: boolean;
}

interface WashSale {
  ticker: string;
  sellDate: string;
  rebuyDate: string;
  disallowedLoss: number;
}

interface TaxLot {
  ticker: string;
  buyDate: string;
  quantity: number;
  costBasis: number;
}

interface TaxData {
  portfolioId: number;
  shortTermGains: number;
  longTermGains: number;
  shortTermLosses: number;
  longTermLosses: number;
  netShortTerm: number;
  netLongTerm: number;
  estimatedTax: number;
  effectiveRate: number;
  realizedGains: RealizedGain[];
  washSales: WashSale[];
  unrealizedTaxLots: TaxLot[];
}

const panelSx = {
  p: 3,
  mb: 4,
  background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
  border: '1px solid rgba(0,200,5,0.12)',
};

const cardSx = {
  p: 2,
  flex: '1 1 140px',
  minWidth: 140,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
};

function pnlColor(n: number): string {
  if (n > 0) return '#00C805';
  if (n < 0) return '#ff5252';
  return '#e8eaf0';
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

export default function TaxSummaryPanel({ portfolioId }: { portfolioId: number }): JSX.Element | null {
  const { data, loading, error } = useApi<TaxData>(`/portfolios/${portfolioId}/tax`);
  const [gainsOpen, setGainsOpen] = useState(false);
  const [lotsOpen, setLotsOpen] = useState(false);

  if (error) return null;

  if (loading || !data) {
    return (
      <Paper variant="outlined" sx={panelSx}>
        <Skeleton variant="text" width={160} height={22} sx={{ mb: 2 }} />
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {[0, 1, 2, 3].map((i) => (
            <Paper key={i} variant="outlined" sx={{ ...cardSx, minHeight: 80 }}>
              <Skeleton variant="text" width={80} height={12} sx={{ mb: 1 }} />
              <Skeleton variant="text" width={60} height={28} />
            </Paper>
          ))}
        </Stack>
      </Paper>
    );
  }

  const hasGains = data.realizedGains.length > 0;
  const hasLots = data.unrealizedTaxLots.length > 0;
  const hasWashSales = data.washSales.length > 0;
  const noData = !hasGains && !hasLots;

  return (
    <Paper variant="outlined" sx={panelSx}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
        <Typography variant="h6" fontWeight={700}>
          Tax Summary
        </Typography>
        <Tooltip
          title="Estimated US federal capital gains tax using FIFO lot tracking. Short-term (&lt;1yr) taxed at 32%, long-term (&ge;1yr) at 15%. For educational purposes only."
          arrow
        >
          <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} />
        </Tooltip>
      </Box>
      <Typography variant="caption" color="text.secondary" display="block" mb={2.5}>
        FIFO cost basis &middot; 32% short-term &middot; 15% long-term
      </Typography>

      {noData && (
        <Typography variant="body2" color="text.secondary">
          No realized trades yet. Tax data will appear after your first sell.
        </Typography>
      )}

      {!noData && (
        <>
          {/* Stat Cards */}
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap mb={2.5}>
            <Paper variant="outlined" sx={cardSx}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                Short-Term P&L
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ color: pnlColor(data.netShortTerm) }}>
                ${fmt(data.netShortTerm)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Gains ${fmt(data.shortTermGains)} &middot; Losses ${fmt(data.shortTermLosses)}
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={cardSx}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                Long-Term P&L
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ color: pnlColor(data.netLongTerm) }}>
                ${fmt(data.netLongTerm)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Gains ${fmt(data.longTermGains)} &middot; Losses ${fmt(data.longTermLosses)}
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={cardSx}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                Est. Tax Liability
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ color: data.estimatedTax > 0 ? '#ff5252' : '#e8eaf0' }}>
                ${fmt(data.estimatedTax)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Federal estimate
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={cardSx}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                Effective Rate
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ color: '#e8eaf0' }}>
                {data.effectiveRate > 0 ? `${data.effectiveRate.toFixed(1)}%` : '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Blended tax rate
              </Typography>
            </Paper>
          </Stack>

          {/* Wash Sale Warnings */}
          {hasWashSales && (
            <Box mb={2.5}>
              <Box display="flex" alignItems="center" gap={0.75} mb={1}>
                <WarningAmberIcon sx={{ fontSize: 16, color: '#ffab00' }} />
                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ffab00', fontWeight: 700 }}>
                  Wash Sales Detected
                </Typography>
              </Box>
              <Stack spacing={1}>
                {data.washSales.map((ws, i) => (
                  <Alert
                    key={i}
                    severity="warning"
                    sx={{ py: 0.5, '& .MuiAlert-message': { fontSize: 12 }, background: 'rgba(255,171,0,0.08)' }}
                  >
                    {ws.ticker}: sold {fmtDate(ws.sellDate)}, rebought {fmtDate(ws.rebuyDate)} &mdash; ${fmt(ws.disallowedLoss)} loss disallowed
                  </Alert>
                ))}
              </Stack>
            </Box>
          )}

          <Divider sx={{ borderColor: 'rgba(0,200,5,0.08)', mb: 2 }} />

          {/* Realized Gains Table (collapsible) */}
          {hasGains && (
            <Box mb={2}>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                sx={{ cursor: 'pointer' }}
                onClick={() => setGainsOpen(!gainsOpen)}
              >
                <Typography variant="subtitle2" fontWeight={700}>
                  Realized Gains ({data.realizedGains.length})
                </Typography>
                <IconButton size="small">
                  <ExpandMoreIcon
                    sx={{
                      transform: gainsOpen ? 'rotate(180deg)' : 'none',
                      transition: '0.2s',
                      fontSize: 20,
                    }}
                  />
                </IconButton>
              </Box>
              <Collapse in={gainsOpen} timeout={300}>
                <TableContainer sx={{ mt: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Ticker</TableCell>
                        <TableCell>Buy Date</TableCell>
                        <TableCell>Sell Date</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell align="right">Cost</TableCell>
                        <TableCell align="right">Sell</TableCell>
                        <TableCell align="right">Gain/Loss</TableCell>
                        <TableCell align="right">Days</TableCell>
                        <TableCell>Type</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.realizedGains.map((g, i) => (
                        <TableRow key={i}>
                          <TableCell sx={{ fontWeight: 600 }}>{g.ticker}</TableCell>
                          <TableCell>{fmtDate(g.buyDate)}</TableCell>
                          <TableCell>{fmtDate(g.sellDate)}</TableCell>
                          <TableCell align="right">{g.quantity}</TableCell>
                          <TableCell align="right">${fmt(g.costBasis)}</TableCell>
                          <TableCell align="right">${fmt(g.sellPrice)}</TableCell>
                          <TableCell align="right" sx={{ color: pnlColor(g.gain), fontWeight: 600 }}>
                            ${fmt(g.gain)}
                          </TableCell>
                          <TableCell align="right">{g.holdingDays}</TableCell>
                          <TableCell>
                            <Chip
                              label={g.isLongTerm ? 'LT' : 'ST'}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: 10,
                                fontWeight: 700,
                                bgcolor: g.isLongTerm ? 'rgba(0,200,5,0.15)' : 'rgba(255,171,0,0.15)',
                                color: g.isLongTerm ? '#00C805' : '#ffab00',
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Collapse>
            </Box>
          )}

          {/* Open Tax Lots (collapsible) */}
          {hasLots && (
            <Box>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                sx={{ cursor: 'pointer' }}
                onClick={() => setLotsOpen(!lotsOpen)}
              >
                <Typography variant="subtitle2" fontWeight={700}>
                  Open Tax Lots ({data.unrealizedTaxLots.length})
                </Typography>
                <IconButton size="small">
                  <ExpandMoreIcon
                    sx={{
                      transform: lotsOpen ? 'rotate(180deg)' : 'none',
                      transition: '0.2s',
                      fontSize: 20,
                    }}
                  />
                </IconButton>
              </Box>
              <Collapse in={lotsOpen} timeout={300}>
                <TableContainer sx={{ mt: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Ticker</TableCell>
                        <TableCell>Buy Date</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell align="right">Cost Basis</TableCell>
                        <TableCell align="right">Days Held</TableCell>
                        <TableCell>Would-Be Type</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.unrealizedTaxLots.map((lot, i) => {
                        const daysHeld = Math.floor(
                          (Date.now() - new Date(lot.buyDate).getTime()) / 86_400_000,
                        );
                        const wouldBeLT = daysHeld >= 365;
                        return (
                          <TableRow key={i}>
                            <TableCell sx={{ fontWeight: 600 }}>{lot.ticker}</TableCell>
                            <TableCell>{fmtDate(lot.buyDate)}</TableCell>
                            <TableCell align="right">{lot.quantity}</TableCell>
                            <TableCell align="right">${fmt(lot.costBasis)}</TableCell>
                            <TableCell align="right">{daysHeld}</TableCell>
                            <TableCell>
                              <Chip
                                label={wouldBeLT ? 'LT' : 'ST'}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  bgcolor: wouldBeLT ? 'rgba(0,200,5,0.15)' : 'rgba(255,171,0,0.15)',
                                  color: wouldBeLT ? '#00C805' : '#ffab00',
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Collapse>
            </Box>
          )}
        </>
      )}
    </Paper>
  );
}

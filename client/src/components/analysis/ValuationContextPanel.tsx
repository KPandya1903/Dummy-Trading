// ── Valuation Context Panel ─────────────────────────────────
// Shows key valuation multiples and a cheap/fair/expensive verdict.
// Inspired by Shiller's CAPE, Graham's margin of safety, and Lynch's PEG.

import {
  Box,
  Chip,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  Grid,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import useApi from '../../hooks/useApi';

interface ValuationData {
  ticker:          string;
  currentPE:       number | null;
  forwardPE:       number | null;
  currentPB:       number | null;
  eps:             number | null;
  epsGrowth:       number | null;
  pegRatio:        number | null;
  priceToSales:    number | null;
  evToEbitda:      number | null;
  pricePercentile: number | null;
  high52w:         number | null;
  low52w:          number | null;
  currentPrice:    number | null;
  marketCap:       number | null;
  verdict:         'cheap' | 'fair' | 'expensive' | 'unknown';
  verdictLabel:    string;
}

const panelSx = {
  p: 3,
  mb: 4,
  background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
  border: '1px solid rgba(0,200,5,0.12)',
};

const VERDICT_COLORS = {
  cheap:     { chip: 'success' as const, bar: '#00C805' },
  fair:      { chip: 'warning' as const, bar: '#ffab00' },
  expensive: { chip: 'error'   as const, bar: '#ff5252' },
  unknown:   { chip: 'default' as const, bar: '#7a8ba5' },
};

function fmt(n: number | null, digits = 1, prefix = '', suffix = ''): string {
  if (n === null) return '—';
  return `${prefix}${n.toFixed(digits)}${suffix}`;
}

interface MetricCellProps {
  label: string;
  value: string;
  tip: string;
}

function MetricCell({ label, value, tip }: MetricCellProps) {
  return (
    <Box>
      <Box display="flex" alignItems="center" gap={0.5} mb={0.25}>
        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7a8ba5' }}>
          {label}
        </Typography>
        <Tooltip title={tip} arrow>
          <InfoOutlinedIcon sx={{ fontSize: 11, color: 'text.disabled', cursor: 'help' }} />
        </Tooltip>
      </Box>
      <Typography variant="body1" fontWeight={700}>
        {value}
      </Typography>
    </Box>
  );
}

export default function ValuationContextPanel({ ticker }: { ticker: string }): JSX.Element | null {
  const { data, loading, error } = useApi<ValuationData>(`/valuation/${ticker}`);

  if (error) return null;

  if (loading || !data) {
    return (
      <Paper variant="outlined" sx={panelSx}>
        <Skeleton variant="text" width={180} height={22} sx={{ mb: 2 }} />
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap mb={2}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Box key={i} sx={{ flex: '1 1 90px', minWidth: 90 }}>
              <Skeleton variant="text" width={60} height={12} sx={{ mb: 0.5 }} />
              <Skeleton variant="text" width={40} height={20} />
            </Box>
          ))}
        </Stack>
      </Paper>
    );
  }

  const verdictStyle = VERDICT_COLORS[data.verdict];

  return (
    <Paper variant="outlined" sx={panelSx}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2.5} flexWrap="wrap" gap={1}>
        <Typography variant="h6" fontWeight={700}>
          Valuation Context
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <Chip
            label={data.verdict.charAt(0).toUpperCase() + data.verdict.slice(1)}
            color={verdictStyle.chip}
            size="small"
            sx={{ fontWeight: 700 }}
          />
        </Box>
      </Box>

      {/* Verdict description */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        {data.verdictLabel}
      </Typography>

      {/* 52-week price range bar */}
      {data.pricePercentile !== null && data.high52w !== null && data.low52w !== null && (
        <Box mb={2.5}>
          <Box display="flex" justifyContent="space-between" mb={0.5}>
            <Typography variant="caption" color="text.secondary">52-Week Price Range</Typography>
            <Typography variant="caption" fontWeight={700} sx={{ color: verdictStyle.bar }}>
              {data.pricePercentile}th percentile
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={data.pricePercentile}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(255,255,255,0.07)',
              '& .MuiLinearProgress-bar': { bgcolor: verdictStyle.bar, borderRadius: 4 },
            }}
          />
          <Box display="flex" justifyContent="space-between" mt={0.5}>
            <Typography variant="caption" color="text.secondary">${data.low52w.toFixed(2)}</Typography>
            {data.currentPrice !== null && (
              <Typography variant="caption" color="text.primary" fontWeight={700}>${data.currentPrice.toFixed(2)}</Typography>
            )}
            <Typography variant="caption" color="text.secondary">${data.high52w.toFixed(2)}</Typography>
          </Box>
        </Box>
      )}

      {/* Multiples grid */}
      <Grid container spacing={2}>
        <Grid item xs={6} sm={4} md={2}>
          <MetricCell
            label="Trailing P/E"
            value={fmt(data.currentPE, 1)}
            tip="Price-to-Earnings (trailing 12 months). Graham: buy below P/E 15 for value. S&P 500 avg ~22."
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetricCell
            label="Forward P/E"
            value={fmt(data.forwardPE, 1)}
            tip="Price-to-Earnings based on next 12 months analyst estimates. Lower forward P/E than trailing = earnings growth expected."
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetricCell
            label="PEG Ratio"
            value={fmt(data.pegRatio, 2)}
            tip="Lynch: PEG < 1 is undervalued (P/E divided by EPS growth rate). PEG > 2 is expensive."
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetricCell
            label="P/B Ratio"
            value={fmt(data.currentPB, 2)}
            tip="Price-to-Book. Graham: P/B < 1.5 is attractive for value stocks. High P/B can indicate strong ROE."
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetricCell
            label="P/S Ratio"
            value={fmt(data.priceToSales, 2)}
            tip="Price-to-Sales. O'Shaughnessy: lowest P/S stocks have historically outperformed. <1 = very cheap."
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetricCell
            label="EV/EBITDA"
            value={fmt(data.evToEbitda, 1)}
            tip="Enterprise Value / EBITDA. Greenblatt's Acquirer's Multiple: <10 suggests potential undervaluation."
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetricCell
            label="EPS (TTM)"
            value={fmt(data.eps, 2, '$')}
            tip="Earnings per share, trailing twelve months."
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetricCell
            label="EPS Growth"
            value={fmt(data.epsGrowth, 1, '', '%')}
            tip="Year-over-year EPS growth rate. Lynch: look for 20-25%+ for growth stocks."
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <MetricCell
            label="Market Cap"
            value={data.marketCap !== null ? `$${data.marketCap.toFixed(1)}B` : '—'}
            tip="Total market capitalisation in billions."
          />
        </Grid>
      </Grid>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
        Valuation benchmarks: Graham P/E &lt;15, Lynch PEG &lt;1, Greenblatt EV/EBITDA &lt;10, O'Shaughnessy P/S &lt;1.
      </Typography>
    </Paper>
  );
}

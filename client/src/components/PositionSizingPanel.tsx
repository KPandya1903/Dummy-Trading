// ── Position Sizing Panel (Kelly Criterion) ─────────────────
// Computes optimal position size from trade history win rate
// and average win/loss ratio, per Kelly (1956) / Van Tharp (2008).

import {
  Box,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  Divider,
  LinearProgress,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import useApi from '../hooks/useApi';

interface KellyData {
  winRate:      number | null;
  avgWin:       number | null;
  avgLoss:      number | null;
  wlRatio:      number | null;
  fullKelly:    number | null;
  halfKelly:    number | null;
  quarterKelly: number | null;
  suggestedPct: number | null;
  sellCount:    number;
  note:         string;
}

const panelSx = {
  p: 3,
  mb: 4,
  background: 'linear-gradient(135deg, #111d31 0%, #162240 100%)',
  border: '1px solid rgba(201,168,76,0.12)',
};

function fmt(n: number | null, digits = 1, suffix = ''): string {
  if (n === null) return '—';
  return `${n.toFixed(digits)}${suffix}`;
}

function kellyColor(pct: number | null): string {
  if (pct === null) return '#7a8ba5';
  if (pct >= 20) return '#00c853';
  if (pct >= 8)  return '#ffab00';
  return '#ff5252';
}

export default function PositionSizingPanel({ portfolioId }: { portfolioId: number }): JSX.Element | null {
  const { data, loading, error } = useApi<KellyData>(`/portfolios/${portfolioId}/kelly`);

  if (error) return null;

  if (loading || !data) {
    return (
      <Paper variant="outlined" sx={panelSx}>
        <Skeleton variant="text" width={200} height={22} sx={{ mb: 2 }} />
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {[0, 1, 2, 3].map((i) => (
            <Box key={i} sx={{ flex: '1 1 120px', minWidth: 120 }}>
              <Skeleton variant="text" width={80} height={12} sx={{ mb: 0.5 }} />
              <Skeleton variant="text" width={60} height={24} />
            </Box>
          ))}
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={panelSx}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
        <Typography variant="h6" fontWeight={700}>
          Position Sizing
        </Typography>
        <Tooltip
          title="Kelly Criterion (Kelly 1956 / Van Tharp 2008): calculates optimal % of portfolio to risk on each trade based on your historical win rate and win/loss ratio. Half Kelly is recommended for live trading to reduce variance."
          arrow
        >
          <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} />
        </Tooltip>
      </Box>
      <Typography variant="caption" color="text.secondary" display="block" mb={2.5}>
        Based on your {data.sellCount} closed trade{data.sellCount !== 1 ? 's' : ''}
      </Typography>

      {/* Stats Row */}
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap mb={2.5}>
        <StatBox label="Win Rate"   value={fmt(data.winRate, 1, '%')}  tip="% of sell trades closed at a profit vs. avg cost" />
        <StatBox label="Avg Win"    value={fmt(data.avgWin,  2, '%')}  tip="Average gain % per winning trade" />
        <StatBox label="Avg Loss"   value={data.avgLoss !== null ? `-${data.avgLoss.toFixed(2)}%` : '—'} tip="Average loss % per losing trade" />
        <StatBox label="W/L Ratio"  value={fmt(data.wlRatio, 2)}       tip="Avg win ÷ avg loss. >1 means wins are larger than losses on average." />
      </Stack>

      <Divider sx={{ borderColor: 'rgba(201,168,76,0.08)', mb: 2.5 }} />

      {/* Kelly Variants */}
      {data.fullKelly !== null ? (
        <>
          <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7a8ba5', display: 'block', mb: 1.5 }}>
            Kelly Fraction Variants
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap mb={2}>
            <KellyBar label="Full Kelly"    pct={data.fullKelly}    recommended={false} tip="Maximum growth but high variance — not recommended for most traders." />
            <KellyBar label="Half Kelly"    pct={data.halfKelly}    recommended={true}  tip="Recommended: half the optimal size. Reduces variance by ~75% vs. full Kelly with ~25% less growth." />
            <KellyBar label="Quarter Kelly" pct={data.quarterKelly} recommended={false} tip="Conservative sizing. Very low variance, modest growth." />
          </Stack>

          {/* Suggestion callout */}
          {data.suggestedPct !== null && (
            <Box
              sx={{
                mt: 1,
                p: 2,
                borderRadius: 1,
                border: `1px solid ${kellyColor(data.suggestedPct)}33`,
                background: `${kellyColor(data.suggestedPct)}08`,
              }}
            >
              <Typography variant="body2" fontWeight={700} sx={{ color: kellyColor(data.suggestedPct) }}>
                Suggested position size: {data.suggestedPct}% per trade
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Half Kelly — optimal balance of growth and capital preservation
              </Typography>
            </Box>
          )}
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {data.note}
        </Typography>
      )}
    </Paper>
  );
}

// ── Sub-components ───────────────────────────────────────────

function StatBox({ label, value, tip }: { label: string; value: string; tip: string }) {
  return (
    <Tooltip title={tip} arrow>
      <Box sx={{ flex: '1 1 100px', minWidth: 100 }}>
        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7a8ba5', display: 'block', mb: 0.25 }}>
          {label}
        </Typography>
        <Typography variant="h6" fontWeight={700}>
          {value}
        </Typography>
      </Box>
    </Tooltip>
  );
}

function KellyBar({ label, pct, recommended, tip }: { label: string; pct: number | null; recommended: boolean; tip: string }) {
  const color = kellyColor(pct);
  return (
    <Tooltip title={tip} arrow>
      <Box sx={{ flex: '1 1 120px', minWidth: 120 }}>
        <Box display="flex" justifyContent="space-between" mb={0.5}>
          <Typography variant="caption" color={recommended ? 'primary.main' : 'text.secondary'} fontWeight={recommended ? 700 : 400}>
            {label}{recommended ? ' ★' : ''}
          </Typography>
          <Typography variant="caption" fontWeight={700} sx={{ color }}>
            {pct !== null ? `${pct.toFixed(1)}%` : '—'}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.min(pct ?? 0, 100)}
          sx={{
            height: 5,
            borderRadius: 3,
            bgcolor: 'rgba(255,255,255,0.07)',
            '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
          }}
        />
      </Box>
    </Tooltip>
  );
}

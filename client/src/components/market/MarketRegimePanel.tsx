import {
  Box,
  Chip,
  LinearProgress,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material';
import useApi from '../../hooks/useApi';

interface RegimeIndicator {
  label: string;
  value: number;
  displayValue: string;
  direction: 'positive' | 'negative' | 'neutral';
}

interface RegimeResult {
  regime: string;
  regimeColor: 'success' | 'error' | 'warning' | 'default';
  strategyImplication: string;
  indicators: {
    trend:      RegimeIndicator;
    volatility: RegimeIndicator;
    momentum:   RegimeIndicator;
  };
  currentSP500: number;
  sma200:       number;
  computedAt:   string;
}

const panelSx = {
  p: 3,
  mb: 3,
  background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
  border: '1px solid rgba(0,200,5,0.1)',
};

function indicatorColor(direction: RegimeIndicator['direction']): string {
  if (direction === 'positive') return '#00C805';
  if (direction === 'negative') return '#ff5252';
  return '#ffab00';
}

function fmtPrice(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MarketRegimePanel(): JSX.Element | null {
  const { data, loading, error } = useApi<RegimeResult>('/market/regime', undefined, 60_000);

  if (error) return null;

  if (loading || !data) {
    return (
      <Paper variant="outlined" sx={panelSx}>
        <Box mb={2}>
          <Skeleton variant="text" width={130} height={14} sx={{ mb: 1 }} />
          <Box display="flex" alignItems="center" gap={1.5}>
            <Skeleton variant="rounded" width={120} height={28} />
            <Skeleton variant="text" width={200} height={14} />
          </Box>
        </Box>
        <Skeleton variant="text" width="80%" height={14} sx={{ mb: 2 }} />
        {[0, 1, 2].map((i) => (
          <Box key={i} mb={1.5}>
            <Box display="flex" justifyContent="space-between" mb={0.4}>
              <Skeleton variant="text" width={160} height={12} />
              <Skeleton variant="text" width={80} height={12} />
            </Box>
            <Skeleton variant="rectangular" height={5} sx={{ borderRadius: 3 }} />
          </Box>
        ))}
      </Paper>
    );
  }

  const indicators = [
    { key: 'trend'      as const, ...data.indicators.trend },
    { key: 'volatility' as const, ...data.indicators.volatility },
    { key: 'momentum'   as const, ...data.indicators.momentum },
  ];

  return (
    <Paper variant="outlined" sx={panelSx}>
      {/* Header */}
      <Box mb={2}>
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', display: 'block', mb: 0.75 }}
        >
          Market Regime — S&amp;P 500
        </Typography>
        <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
          <Chip
            label={data.regime}
            color={data.regimeColor === 'default' ? undefined : data.regimeColor}
            size="medium"
            sx={{ fontWeight: 700, fontSize: 14 }}
          />
          <Typography variant="body2" color="text.secondary">
            S&amp;P 500: {fmtPrice(data.currentSP500)} · SMA200: {fmtPrice(data.sma200)}
          </Typography>
        </Box>
      </Box>

      {/* Strategy implication */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        {data.strategyImplication}
      </Typography>

      {/* 3 indicator bars */}
      {indicators.map(({ key, label, value, displayValue, direction }) => {
        const barColor = indicatorColor(direction);
        return (
          <Box key={key} mb={1.5}>
            <Box display="flex" justifyContent="space-between" mb={0.4}>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
              <Typography variant="caption" fontWeight={600} sx={{ color: barColor }}>
                {displayValue}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={value}
              sx={{
                height: 5,
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.07)',
                '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 3 },
              }}
            />
          </Box>
        );
      })}

      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
        Based on S&amp;P 500 (^GSPC) 1-year daily history. Updated every 10 min.
      </Typography>
    </Paper>
  );
}

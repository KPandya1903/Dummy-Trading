import {
  Box,
  Chip,
  LinearProgress,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material';
import useApi from '../../hooks/useApi';

interface FactorDetail {
  score: number;
  label: string;
  rawValue: string;
}

interface FactorScores {
  ticker: string;
  value:             FactorDetail;
  momentum:          FactorDetail;
  volatility:        FactorDetail;
  technicalStrength: FactorDetail;
  quality:           FactorDetail;
  composite: number;
  compositeLabelText: string;
  computedAt: string;
}

const FACTORS: { key: keyof Omit<FactorScores, 'ticker' | 'composite' | 'compositeLabelText' | 'computedAt'>; label: string }[] = [
  { key: 'value',             label: 'Value (P/E vs Benchmark)'          },
  { key: 'momentum',          label: 'Momentum (3M / 6M / 12M)'          },
  { key: 'volatility',        label: 'Volatility (Lower = Better)'        },
  { key: 'technicalStrength', label: 'Technical Strength (RSI + MACD)'    },
  { key: 'quality',           label: 'Quality (Trend Consistency R²)'     },
];

const panelSx = {
  p: 3,
  mb: 4,
  background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
  border: '1px solid rgba(0,200,5,0.12)',
};

function scoreColor(score: number): string {
  if (score >= 70) return '#00C805';
  if (score >= 45) return '#ffab00';
  return '#ff5252';
}

function chipColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 70) return 'success';
  if (score >= 45) return 'warning';
  return 'error';
}

export default function FactorScorecard({ ticker }: { ticker: string }): JSX.Element | null {
  const { data, loading, error } = useApi<FactorScores>(`/factors/${ticker}`);

  if (error) return null;

  if (loading || !data) {
    return (
      <Paper variant="outlined" sx={panelSx}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2.5}>
          <Skeleton variant="text" width={160} height={22} />
          <Skeleton variant="rounded" width={100} height={24} />
        </Box>
        {[0, 1, 2, 3, 4].map((i) => (
          <Box key={i} mb={1.5}>
            <Box display="flex" justifyContent="space-between" mb={0.4}>
              <Skeleton variant="text" width={200} height={12} />
              <Skeleton variant="text" width={80} height={12} />
            </Box>
            <Skeleton variant="rectangular" height={6} sx={{ borderRadius: 3 }} />
          </Box>
        ))}
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={panelSx}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2.5} flexWrap="wrap" gap={1}>
        <Typography variant="h6" fontWeight={700}>
          Factor Scorecard
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="caption" color="text.secondary">Composite</Typography>
          <Chip
            label={`${data.composite} — ${data.compositeLabelText}`}
            color={chipColor(data.composite)}
            size="small"
            sx={{ fontWeight: 700 }}
          />
        </Box>
      </Box>

      {/* 5 factor rows */}
      {FACTORS.map(({ key, label }) => {
        const factor = data[key] as FactorDetail;
        const color = scoreColor(factor.score);
        return (
          <Box key={key} mb={1.5}>
            <Box display="flex" justifyContent="space-between" mb={0.4} flexWrap="wrap" gap={0.5}>
              <Typography variant="caption" color="text.secondary" sx={{ flex: '1 1 auto' }}>
                {label}
              </Typography>
              <Box display="flex" gap={1.5} alignItems="center">
                <Typography variant="caption" color="text.secondary">{factor.rawValue}</Typography>
                <Typography variant="caption" fontWeight={700} sx={{ color, minWidth: 70, textAlign: 'right' }}>
                  {factor.label}
                </Typography>
              </Box>
            </Box>
            <LinearProgress
              variant="determinate"
              value={factor.score}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.07)',
                '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
              }}
            />
          </Box>
        );
      })}

      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
        Based on 1-year price history. Value uses S&amp;P 500 avg P/E benchmark (22).
      </Typography>
    </Paper>
  );
}

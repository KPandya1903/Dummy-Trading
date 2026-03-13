// ── Behavioral Bias Tracker ─────────────────────────────────
// Analyzes trade history for cognitive biases:
// - Disposition Effect (Shefrin & Statman, 1985)
// - Overtrading (Odean, 1999)
// - Concentration Risk (Markowitz, 1952)
// Inspired by Kahneman (2011) and Thaler (2015).

import {
  Box,
  Chip,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  Alert,
  Divider,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import useApi from '../hooks/useApi';

interface BiasSignal {
  id: string;
  label: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

interface BehaviorData {
  dispositionScore:    number | null;
  overtradingScore:    number | null;
  concentrationScore:  number | null;
  avgHoldDaysWinners:  number | null;
  avgHoldDaysLosers:   number | null;
  holdingTimeRatio:    number | null;
  tradesPerWeek:       number;
  uniqueTickers:       number;
  tradeCount:          number;
  biases:              BiasSignal[];
  note:                string;
}

const panelSx = {
  p: 3,
  mb: 4,
  background: 'linear-gradient(135deg, #111d31 0%, #162240 100%)',
  border: '1px solid rgba(201,168,76,0.12)',
};

function scoreColor(score: number | null, invert = false): string {
  if (score === null) return '#7a8ba5';
  const adjusted = invert ? 100 - score : score;
  if (adjusted >= 70) return '#00c853';
  if (adjusted >= 40) return '#ffab00';
  return '#ff5252';
}

function severityColor(severity: BiasSignal['severity']): 'error' | 'warning' | 'info' {
  if (severity === 'high')   return 'error';
  if (severity === 'medium') return 'warning';
  return 'info';
}

function fmt(n: number | null, suffix = ''): string {
  if (n === null) return '—';
  return `${n}${suffix}`;
}

interface ScoreRowProps {
  label: string;
  score: number | null;
  display: string;
  tip: string;
  invert?: boolean;
}

function ScoreRow({ label, score, display, tip, invert = false }: ScoreRowProps) {
  const color = scoreColor(score, invert);
  return (
    <Box mb={1.75}>
      <Box display="flex" justifyContent="space-between" mb={0.4} flexWrap="wrap" gap={0.5}>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          <Tooltip title={tip} arrow>
            <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled', cursor: 'help' }} />
          </Tooltip>
        </Box>
        <Typography variant="caption" fontWeight={700} sx={{ color }}>
          {display}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={score ?? 0}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.07)',
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
        }}
      />
    </Box>
  );
}

export default function BehavioralBiasPanel({ portfolioId }: { portfolioId: number }): JSX.Element | null {
  const { data, loading, error } = useApi<BehaviorData>(`/portfolios/${portfolioId}/behavior`);

  if (error) return null;

  if (loading || !data) {
    return (
      <Paper variant="outlined" sx={panelSx}>
        <Skeleton variant="text" width={200} height={22} sx={{ mb: 2 }} />
        {[0, 1, 2].map((i) => (
          <Box key={i} mb={1.5}>
            <Box display="flex" justifyContent="space-between" mb={0.4}>
              <Skeleton variant="text" width={160} height={12} />
              <Skeleton variant="text" width={60} height={12} />
            </Box>
            <Skeleton variant="rectangular" height={6} sx={{ borderRadius: 3 }} />
          </Box>
        ))}
      </Paper>
    );
  }

  const hasBiases = data.biases.length > 0;

  return (
    <Paper variant="outlined" sx={panelSx}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
        <Typography variant="h6" fontWeight={700}>
          Behavioral Analysis
        </Typography>
        <Tooltip
          title="Identifies cognitive biases in your trading. Based on behavioral finance research by Kahneman (2011), Thaler (2015), and Shefrin & Statman (1985)."
          arrow
        >
          <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} />
        </Tooltip>
      </Box>
      <Typography variant="caption" color="text.secondary" display="block" mb={2.5}>
        {data.note}
      </Typography>

      {/* Scores */}
      <ScoreRow
        label="Holding Time Balance"
        score={data.dispositionScore !== null ? 100 - data.dispositionScore : null}
        display={
          data.avgHoldDaysWinners !== null && data.avgHoldDaysLosers !== null
            ? `Winners: ${data.avgHoldDaysWinners}d · Losers: ${data.avgHoldDaysLosers}d`
            : '—'
        }
        tip="Disposition effect: do you hold losers longer than winners? Balanced holding time = higher score."
        invert={false}
      />

      <ScoreRow
        label="Trade Discipline"
        score={data.overtradingScore}
        display={`${data.tradesPerWeek} trades/week`}
        tip="Higher score = fewer trades per week = more disciplined. Excessive trading often destroys returns."
      />

      <ScoreRow
        label="Diversification"
        score={data.concentrationScore}
        display={`${data.uniqueTickers} unique ticker${data.uniqueTickers !== 1 ? 's' : ''}`}
        tip="Higher score = more diversified. Markowitz (1952): portfolio risk decreases with more uncorrelated positions."
      />

      {/* Bias Signals */}
      {hasBiases && (
        <>
          <Divider sx={{ borderColor: 'rgba(201,168,76,0.08)', my: 2.5 }} />
          <Box display="flex" alignItems="center" gap={0.75} mb={1.5}>
            <WarningAmberIcon sx={{ fontSize: 16, color: '#ffab00' }} />
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ffab00', fontWeight: 700 }}>
              Detected Biases
            </Typography>
          </Box>
          <Stack spacing={1.5}>
            {data.biases.map((bias) => (
              <Alert
                key={bias.id}
                severity={severityColor(bias.severity)}
                sx={{
                  py: 0.75,
                  '& .MuiAlert-message': { fontSize: 12 },
                  background: severityColor(bias.severity) === 'error'
                    ? 'rgba(255,82,82,0.08)'
                    : severityColor(bias.severity) === 'warning'
                      ? 'rgba(255,171,0,0.08)'
                      : 'rgba(61,142,247,0.08)',
                }}
                icon={
                  <Chip
                    label={bias.label}
                    size="small"
                    color={severityColor(bias.severity)}
                    sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                  />
                }
              >
                {bias.description}
              </Alert>
            ))}
          </Stack>
        </>
      )}

      {!hasBiases && data.tradeCount >= 5 && (
        <Alert severity="success" sx={{ mt: 2, py: 0.75, '& .MuiAlert-message': { fontSize: 12 } }}>
          No significant behavioral biases detected. Your trading shows good discipline.
        </Alert>
      )}
    </Paper>
  );
}

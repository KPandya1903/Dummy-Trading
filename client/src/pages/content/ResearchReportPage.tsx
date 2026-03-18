import { useState, useEffect, useCallback } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Typography,
  Box,
  Paper,
  Grid,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Fade,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import apiClient from '../../apiClient';
import ResearchProgressBar from '../../components/content/ResearchProgressBar';
import ResearchNarrativeTile from '../../components/content/ResearchNarrativeTile';
import PageLoader from '../../components/ui/PageLoader';
import {
  CHART_COLORS,
  CHART_TOOLTIP_STYLE,
  CHART_GRID_COLOR,
  CHART_AXIS_COLOR,
} from '../../theme';

interface Narrative {
  id: number;
  dimension: string;
  title: string;
  subtitle: string | null;
  sentiment: string;
  impactScore: number | null;
  summary: string;
  fullAnalysis: string;
  eventDate: string | null;
  priceBeforeEvent: number | null;
  priceAfterEvent: number | null;
  priceChangePct: number | null;
  correlationNote: string | null;
  priceWindow: { date: string; close: number }[];
  sources: { title: string; url: string }[];
  sortOrder: number;
}

interface ResearchData {
  id: number;
  ticker: string;
  companyName: string;
  sector: string | null;
  status: string;
  progress: number;
  currentStep: string | null;
  priceAtResearch: number | null;
  marketCap: number | null;
  executiveSummary: string | null;
  overallSentiment: string | null;
  confidenceScore: number | null;
  errorMessage: string | null;
  priceHistory: { date: string; close: number }[];
  narratives: Narrative[];
  createdAt: string;
}

const panelSx = {
  p: 3,
  background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
  border: '1px solid rgba(0,200,5,0.1)',
};

const SENTIMENT_LABEL_COLORS: Record<string, string> = {
  bullish: '#00C805',
  bearish: '#ff5252',
  neutral: '#7a8ba5',
  mixed: '#ffab00',
};

function fmt(n: number | null): string {
  if (n === null) return 'N/A';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ResearchReportPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ResearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sseProgress, setSseProgress] = useState(0);
  const [sseStep, setSseStep] = useState('');
  const [sseStatus, setSseStatus] = useState('PENDING');
  const [expandedNarrative, setExpandedNarrative] = useState<Narrative | null>(null);

  const fetchResearch = useCallback(async () => {
    if (!id) return;
    try {
      const { data: res } = await apiClient.get(`/research/${id}`);
      setData(res);
      setSseStatus(res.status);
      setSseProgress(res.progress);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load research');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Initial fetch
  useEffect(() => {
    fetchResearch();
  }, [fetchResearch]);

  // SSE for progress updates
  useEffect(() => {
    if (!id || sseStatus === 'COMPLETED' || sseStatus === 'FAILED') return;

    const eventSource = new EventSource(`/api/research/${id}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.done) {
          eventSource.close();
          fetchResearch(); // Final fetch to get all data
          return;
        }
        if (parsed.progress !== undefined) setSseProgress(parsed.progress);
        if (parsed.currentStep) setSseStep(parsed.currentStep);
        if (parsed.status) setSseStatus(parsed.status);
        // Refresh data when new narratives are available
        if (parsed.narrativeCount > (data?.narratives.length ?? 0)) {
          fetchResearch();
        }
      } catch { /* ignore parse errors */ }
    };

    eventSource.onerror = () => {
      eventSource.close();
      // Retry fetch after a delay
      setTimeout(fetchResearch, 3000);
    };

    return () => eventSource.close();
  }, [id, sseStatus, data?.narratives.length, fetchResearch]);

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <>
        <Button component={RouterLink} to="/research" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
          Back to Research
        </Button>
        <Alert severity="error">{error}</Alert>
      </>
    );
  }

  if (!data) return null;

  const isInProgress = sseStatus !== 'COMPLETED' && sseStatus !== 'FAILED';

  // ── Expanded Narrative View ────────────────────────────
  if (expandedNarrative) {
    return (
      <>
        <Button onClick={() => setExpandedNarrative(null)} startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
          Back to Overview
        </Button>

        <Typography variant="h5" fontWeight={700} gutterBottom>
          {expandedNarrative.title}
        </Typography>

        <Box display="flex" gap={1} alignItems="center" mb={3} flexWrap="wrap">
          <Chip
            label={expandedNarrative.sentiment}
            color={expandedNarrative.sentiment === 'positive' ? 'success' : expandedNarrative.sentiment === 'negative' ? 'error' : 'default'}
            size="small"
          />
          {expandedNarrative.priceChangePct !== null && (
            <Chip
              label={`Impact: ${expandedNarrative.priceChangePct >= 0 ? '+' : ''}${expandedNarrative.priceChangePct.toFixed(1)}%`}
              color={expandedNarrative.priceChangePct >= 0 ? 'success' : 'error'}
              size="small"
              variant="outlined"
            />
          )}
          {expandedNarrative.eventDate && (
            <Chip label={expandedNarrative.eventDate} size="small" variant="outlined" />
          )}
        </Box>

        {/* Event price chart */}
        {expandedNarrative.priceWindow.length > 2 && (
          <Paper variant="outlined" sx={{ ...panelSx, mb: 3 }}>
            <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', mb: 1, display: 'block' }}>
              Price Movement Around Event
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={expandedNarrative.priceWindow}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} interval="preserveStartEnd" minTickGap={50} tick={{ fill: CHART_AXIS_COLOR }} fontSize={11} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: CHART_AXIS_COLOR }} fontSize={11} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Price']} />
                {expandedNarrative.eventDate && (
                  <ReferenceLine
                    x={expandedNarrative.eventDate}
                    stroke="#00C805"
                    strokeDasharray="3 3"
                    label={{ value: 'Event', fill: '#00C805', fontSize: 11 }}
                  />
                )}
                <Line type="monotone" dataKey="close" stroke={CHART_COLORS[0]} dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </Paper>
        )}

        {/* Correlation note */}
        {expandedNarrative.correlationNote && (
          <Paper variant="outlined" sx={{ ...panelSx, mb: 3 }}>
            <Box display="flex" gap={2} alignItems="center">
              {expandedNarrative.priceBeforeEvent !== null && (
                <Box textAlign="center">
                  <Typography variant="caption" color="text.secondary">Before</Typography>
                  <Typography variant="h6" fontWeight={700}>${fmt(expandedNarrative.priceBeforeEvent)}</Typography>
                </Box>
              )}
              {expandedNarrative.priceChangePct !== null && (
                <Typography
                  variant="h5"
                  fontWeight={700}
                  color={expandedNarrative.priceChangePct >= 0 ? 'success.main' : 'error.main'}
                >
                  {expandedNarrative.priceChangePct >= 0 ? '+' : ''}{expandedNarrative.priceChangePct.toFixed(2)}%
                </Typography>
              )}
              {expandedNarrative.priceAfterEvent !== null && (
                <Box textAlign="center">
                  <Typography variant="caption" color="text.secondary">After</Typography>
                  <Typography variant="h6" fontWeight={700}>${fmt(expandedNarrative.priceAfterEvent)}</Typography>
                </Box>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" mt={1}>
              {expandedNarrative.correlationNote}
            </Typography>
          </Paper>
        )}

        {/* Full analysis */}
        <Paper variant="outlined" sx={{ ...panelSx, mb: 3 }}>
          <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', mb: 2, display: 'block' }}>
            Full Analysis
          </Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
            {expandedNarrative.fullAnalysis}
          </Typography>
        </Paper>

        {/* Sources */}
        {expandedNarrative.sources.length > 0 && (
          <Paper variant="outlined" sx={{ ...panelSx }}>
            <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', mb: 1, display: 'block' }}>
              Sources
            </Typography>
            {expandedNarrative.sources.map((s, i) => (
              <Typography
                key={i}
                variant="body2"
                component="a"
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                display="block"
                sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' }, mb: 0.5 }}
              >
                {s.title}
              </Typography>
            ))}
          </Paper>
        )}
      </>
    );
  }

  // ── Main Report View ───────────────────────────────────
  return (
    <>
      <Button component={RouterLink} to="/research" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
        Back to Research
      </Button>

      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={1} flexWrap="wrap">
        <Typography variant="h4" fontWeight={700}>
          {data.ticker}
        </Typography>
        <Typography variant="h6" color="text.secondary">
          {data.companyName}
        </Typography>
        {data.sector && (
          <Chip label={data.sector} size="small" variant="outlined" />
        )}
      </Box>

      {data.overallSentiment && (
        <Box display="flex" gap={1} alignItems="center" mb={2}>
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{ color: SENTIMENT_LABEL_COLORS[data.overallSentiment] || '#7a8ba5' }}
          >
            {data.overallSentiment.toUpperCase()}
          </Typography>
          {data.confidenceScore !== null && (
            <Chip
              label={`Confidence: ${Math.round(data.confidenceScore * 100)}%`}
              size="small"
              variant="outlined"
            />
          )}
          <Typography variant="caption" color="text.secondary">
            {new Date(data.createdAt).toLocaleDateString()}
          </Typography>
          <Chip label={`${data.narratives.length} narratives`} size="small" variant="outlined" />
        </Box>
      )}

      {/* Progress bar (if still running) */}
      {isInProgress && (
        <ResearchProgressBar progress={sseProgress} currentStep={sseStep || data.currentStep || 'Starting...'} />
      )}

      {sseStatus === 'FAILED' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Research failed: {data.errorMessage || 'Unknown error'}
        </Alert>
      )}

      {/* Executive Summary */}
      {data.executiveSummary && (
        <Paper variant="outlined" sx={{ ...panelSx, mb: 3 }}>
          <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', mb: 2, display: 'block' }}>
            Executive Summary
          </Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
            {data.executiveSummary}
          </Typography>
        </Paper>
      )}

      {/* Full price chart with event markers */}
      {data.priceHistory.length > 0 && (
        <Paper variant="outlined" sx={{ ...panelSx, mb: 3 }}>
          <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', mb: 1, display: 'block' }}>
            1-Year Price History with Event Markers
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data.priceHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
              <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} interval="preserveStartEnd" minTickGap={60} tick={{ fill: CHART_AXIS_COLOR }} fontSize={11} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: CHART_AXIS_COLOR }} fontSize={11} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Price']} />
              <Line type="monotone" dataKey="close" stroke={CHART_COLORS[0]} dot={false} strokeWidth={2} name="Price" />

              {data.narratives
                .filter((n) => n.eventDate)
                .map((n) => (
                  <ReferenceLine
                    key={n.id}
                    x={n.eventDate!}
                    stroke={n.sentiment === 'positive' ? '#00C805' : n.sentiment === 'negative' ? '#ff5252' : '#7a8ba5'}
                    strokeDasharray="3 3"
                  />
                ))}
            </ComposedChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* Narrative Tiles */}
      {data.narratives.length > 0 && (
        <>
          <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', mb: 2, display: 'block' }}>
            Research Narratives ({data.narratives.length})
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {data.narratives.map((n, i) => (
              <Fade in key={n.id} timeout={300 + i * 100}>
                <Grid item xs={12} sm={6} md={4}>
                  <ResearchNarrativeTile
                    narrative={n}
                    onClick={() => setExpandedNarrative(n)}
                  />
                </Grid>
              </Fade>
            ))}
          </Grid>
        </>
      )}

      {/* Loading placeholder tiles */}
      {isInProgress && data.narratives.length === 0 && (
        <Box textAlign="center" py={4}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" mt={2}>
            Generating research narratives...
          </Typography>
        </Box>
      )}
    </>
  );
}

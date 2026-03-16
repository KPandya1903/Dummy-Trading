// ── Stock Screener ──────────────────────────────────────────
// Filter S&P 500 universe by sector, P/E, market cap, momentum,
// and dividend yield. Backed by /api/screener (cached data).

import { useState, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Typography,
  Box,
  Paper,
  Grid,
  TextField,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Divider,
  Stack,
  Tooltip,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import TuneIcon from '@mui/icons-material/Tune';
import apiClient from '../apiClient';
import useApi from '../hooks/useApi';

interface ScreenerResult {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePct: number;
  marketCap: number | null;
  volume: number | null;
  trailingPE: number | null;
  dividendYield: number | null;
  high52w: number | null;
}

interface ScreenerResponse {
  count: number;
  results: ScreenerResult[];
}

type SortField = 'marketCap' | 'changePct' | 'trailingPE' | 'dividendYield' | 'price' | 'volume';

const SECTORS = [
  'Information Technology',
  'Health Care',
  'Financials',
  'Consumer Discretionary',
  'Communication Services',
  'Industrials',
  'Consumer Staples',
  'Energy',
  'Real Estate',
  'Materials',
  'Utilities',
];

// Preset screens inspired by Graham, Lynch, Greenblatt
const PRESETS = [
  {
    label: 'Graham Value',
    description: 'P/E < 15 · Large cap (>$10B)',
    filters: { maxPE: '15', minMarketCap: '10' },
  },
  {
    label: 'Lynch GARP',
    description: 'P/E 10–25 · Positive momentum',
    filters: { minPE: '10', maxPE: '25', minChangePct: '0' },
  },
  {
    label: 'Dividend Income',
    description: 'Dividend yield ≥ 2%',
    filters: { minDividendYield: '2' },
  },
  {
    label: 'Momentum Leaders',
    description: 'Day change ≥ +1.5%',
    filters: { minChangePct: '1.5' },
  },
  {
    label: 'Mega Cap',
    description: 'Market cap > $200B',
    filters: { minMarketCap: '200' },
  },
];

const panelSx = {
  p: 3,
  background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
  border: '1px solid rgba(0,200,5,0.12)',
};

function fmtNum(n: number | null, digits = 2, prefix = '', suffix = ''): string {
  if (n === null) return '—';
  return `${prefix}${n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
}

function PnLText({ value }: { value: number }) {
  const color = value > 0 ? '#00C805' : value < 0 ? '#ff5252' : '#e8eaf0';
  return (
    <Typography variant="body2" sx={{ color, fontWeight: 600 }}>
      {value >= 0 ? '+' : ''}{value.toFixed(2)}%
    </Typography>
  );
}

export default function ScreenerPage() {
  // Filter state
  const [sector, setSector] = useState('');
  const [minPE, setMinPE] = useState('');
  const [maxPE, setMaxPE] = useState('');
  const [minMarketCap, setMinMarketCap] = useState('');
  const [maxMarketCap, setMaxMarketCap] = useState('');
  const [minChangePct, setMinChangePct] = useState('');
  const [maxChangePct, setMaxChangePct] = useState('');
  const [minDividendYield, setMinDividendYield] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('marketCap');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Results state
  const [results, setResults] = useState<ScreenerResult[] | null>(null);
  const [resultCount, setResultCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: sectorsData } = useApi<string[]>('/screener/sectors');

  const runScreen = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { sortBy, sortDir, limit: '100' };
      if (sector)          params.sector          = sector;
      if (minPE)           params.minPE           = minPE;
      if (maxPE)           params.maxPE           = maxPE;
      if (minMarketCap)    params.minMarketCap    = minMarketCap;
      if (maxMarketCap)    params.maxMarketCap    = maxMarketCap;
      if (minChangePct)    params.minChangePct    = minChangePct;
      if (maxChangePct)    params.maxChangePct    = maxChangePct;
      if (minDividendYield) params.minDividendYield = minDividendYield;

      const { data } = await apiClient.get<ScreenerResponse>('/screener', { params });
      setResults(data.results);
      setResultCount(data.count);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Screen failed');
    } finally {
      setLoading(false);
    }
  }, [sector, minPE, maxPE, minMarketCap, maxMarketCap, minChangePct, maxChangePct, minDividendYield, sortBy, sortDir]);

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setMinPE(preset.filters.minPE ?? '');
    setMaxPE(preset.filters.maxPE ?? '');
    setMinMarketCap(preset.filters.minMarketCap ?? '');
    setMaxMarketCap('');
    setMinChangePct(preset.filters.minChangePct ?? '');
    setMaxChangePct('');
    setMinDividendYield(preset.filters.minDividendYield ?? '');
    setSector('');
  };

  const resetFilters = () => {
    setSector(''); setMinPE(''); setMaxPE('');
    setMinMarketCap(''); setMaxMarketCap('');
    setMinChangePct(''); setMaxChangePct('');
    setMinDividendYield('');
  };

  const handleSortChange = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  return (
    <>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Stock Screener
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Filter the S&amp;P 500 universe by fundamentals, momentum, and sector.
        Inspired by Graham value screens, Lynch GARP, and Greenblatt Magic Formula.
      </Typography>

      {/* ── Preset Screens ──────────────────────────────────── */}
      <Box mb={3}>
        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', display: 'block', mb: 1 }}>
          Preset Screens
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {PRESETS.map((p) => (
            <Tooltip key={p.label} title={p.description} arrow>
              <Chip
                label={p.label}
                variant="outlined"
                clickable
                onClick={() => applyPreset(p)}
                sx={{ borderColor: 'rgba(0,200,5,0.3)', '&:hover': { borderColor: 'primary.main' } }}
              />
            </Tooltip>
          ))}
        </Stack>
      </Box>

      {/* ── Filter Panel ────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ ...panelSx, mb: 3 }}>
        <Box display="flex" alignItems="center" gap={1} mb={2.5}>
          <TuneIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={700}>Filters</Typography>
        </Box>

        <Grid container spacing={2.5}>
          {/* Sector */}
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Sector</InputLabel>
              <Select value={sector} onChange={(e) => setSector(e.target.value)} label="Sector">
                <MenuItem value="">All Sectors</MenuItem>
                {(sectorsData ?? SECTORS).map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* P/E Range */}
          <Grid item xs={6} sm={3} md={1.5}>
            <TextField
              label="Min P/E"
              size="small"
              type="number"
              fullWidth
              value={minPE}
              onChange={(e) => setMinPE(e.target.value)}
              inputProps={{ min: 0, step: 1 }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={1.5}>
            <TextField
              label="Max P/E"
              size="small"
              type="number"
              fullWidth
              value={maxPE}
              onChange={(e) => setMaxPE(e.target.value)}
              inputProps={{ min: 0, step: 1 }}
            />
          </Grid>

          {/* Market Cap Range (billions) */}
          <Grid item xs={6} sm={3} md={1.5}>
            <TextField
              label="Min MCap ($B)"
              size="small"
              type="number"
              fullWidth
              value={minMarketCap}
              onChange={(e) => setMinMarketCap(e.target.value)}
              inputProps={{ min: 0, step: 10 }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={1.5}>
            <TextField
              label="Max MCap ($B)"
              size="small"
              type="number"
              fullWidth
              value={maxMarketCap}
              onChange={(e) => setMaxMarketCap(e.target.value)}
              inputProps={{ min: 0, step: 10 }}
            />
          </Grid>

          {/* Day Change % Range */}
          <Grid item xs={6} sm={3} md={1.5}>
            <TextField
              label="Min Change %"
              size="small"
              type="number"
              fullWidth
              value={minChangePct}
              onChange={(e) => setMinChangePct(e.target.value)}
              inputProps={{ step: 0.5 }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={1.5}>
            <TextField
              label="Max Change %"
              size="small"
              type="number"
              fullWidth
              value={maxChangePct}
              onChange={(e) => setMaxChangePct(e.target.value)}
              inputProps={{ step: 0.5 }}
            />
          </Grid>

          {/* Dividend Yield */}
          <Grid item xs={6} sm={3} md={1.5}>
            <TextField
              label="Min Div Yield %"
              size="small"
              type="number"
              fullWidth
              value={minDividendYield}
              onChange={(e) => setMinDividendYield(e.target.value)}
              inputProps={{ min: 0, step: 0.5 }}
            />
          </Grid>

          {/* Sort */}
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                label="Sort By"
              >
                <MenuItem value="marketCap">Market Cap</MenuItem>
                <MenuItem value="changePct">Day Change %</MenuItem>
                <MenuItem value="trailingPE">P/E Ratio</MenuItem>
                <MenuItem value="dividendYield">Dividend Yield</MenuItem>
                <MenuItem value="price">Price</MenuItem>
                <MenuItem value="volume">Volume</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2.5, borderColor: 'rgba(0,200,5,0.08)' }} />

        <Box display="flex" gap={2} alignItems="center">
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <FilterListIcon />}
            onClick={runScreen}
            disabled={loading}
          >
            Run Screen
          </Button>
          <Button variant="text" onClick={resetFilters} color="inherit" sx={{ color: 'text.secondary' }}>
            Reset
          </Button>
          {results !== null && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              {resultCount} result{resultCount !== 1 ? 's' : ''}
            </Typography>
          )}
        </Box>
      </Paper>

      {/* ── Error ───────────────────────────────────────────── */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Results Table ───────────────────────────────────── */}
      {results !== null && (
        <TableContainer component={Paper} variant="outlined" sx={{ background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ticker</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Sector</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortBy === 'changePct'}
                    direction={sortBy === 'changePct' ? sortDir : 'desc'}
                    onClick={() => handleSortChange('changePct')}
                  >
                    Day %
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortBy === 'marketCap'}
                    direction={sortBy === 'marketCap' ? sortDir : 'desc'}
                    onClick={() => handleSortChange('marketCap')}
                  >
                    Mkt Cap ($B)
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortBy === 'trailingPE'}
                    direction={sortBy === 'trailingPE' ? sortDir : 'desc'}
                    onClick={() => handleSortChange('trailingPE')}
                  >
                    P/E
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortBy === 'dividendYield'}
                    direction={sortBy === 'dividendYield' ? sortDir : 'desc'}
                    onClick={() => handleSortChange('dividendYield')}
                  >
                    Div Yield
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary" py={3}>
                      No stocks match these filters. Try relaxing your criteria.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {results.map((s) => (
                <TableRow key={s.ticker} hover>
                  <TableCell>
                    <Chip
                      label={s.ticker}
                      size="small"
                      clickable
                      component={RouterLink}
                      to={`/stocks/${s.ticker}`}
                      sx={{ fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                      {s.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">{s.sector}</Typography>
                  </TableCell>
                  <TableCell align="right">{fmtNum(s.price, 2, '$')}</TableCell>
                  <TableCell align="right">
                    <PnLText value={s.changePct} />
                  </TableCell>
                  <TableCell align="right">{fmtNum(s.marketCap, 1)}</TableCell>
                  <TableCell align="right">{fmtNum(s.trailingPE, 1)}</TableCell>
                  <TableCell align="right">{s.dividendYield !== null ? `${s.dividendYield.toFixed(2)}%` : '—'}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      <Button
                        size="small"
                        variant="outlined"
                        component={RouterLink}
                        to={`/stocks/${s.ticker}`}
                        sx={{ fontSize: 11, py: 0.25, px: 1 }}
                      >
                        View
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        component={RouterLink}
                        to={`/stocks/${s.ticker}/analysis`}
                        sx={{ fontSize: 11, py: 0.25, px: 1 }}
                      >
                        Chart
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Empty state ─────────────────────────────────────── */}
      {results === null && !loading && (
        <Paper variant="outlined" sx={{ ...panelSx, textAlign: 'center', py: 6 }}>
          <FilterListIcon sx={{ fontSize: 48, color: 'rgba(0,200,5,0.3)', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Set your filters and run the screen
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Or pick a preset to start — Graham Value, Lynch GARP, Dividend Income, and more.
          </Typography>
        </Paper>
      )}
    </>
  );
}

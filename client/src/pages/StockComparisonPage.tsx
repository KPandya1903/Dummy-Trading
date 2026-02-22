import { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import apiClient from '../apiClient';
import {
  CHART_COLORS,
  CHART_TOOLTIP_STYLE,
  CHART_GRID_COLOR,
  CHART_AXIS_COLOR,
} from '../theme';

interface SearchResult {
  ticker: string;
  name: string;
}

interface CompareData {
  tickers: string[];
  series: { ticker: string; data: { date: string; returnPct: number }[] }[];
  fundamentals: {
    ticker: string;
    name: string;
    price: number;
    marketCap: number | null;
    pe: number | null;
    dividendYield: number | null;
    high52w: number | null;
    low52w: number | null;
    sector: string | null;
  }[];
}

const PERIODS = ['1W', '1M', '3M', '6M', '1Y'];

function fmt(n: number | null): string {
  if (n == null) return 'N/A';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const panelSx = {
  p: 3,
  background: 'linear-gradient(135deg, #111d31 0%, #162240 100%)',
  border: '1px solid rgba(201,168,76,0.1)',
};

export default function StockComparisonPage() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [period, setPeriod] = useState('3M');
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Search autocomplete
  useEffect(() => {
    if (searchInput.length < 1) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.get<SearchResult[]>('/search', {
          params: { q: searchInput },
        });
        setSearchResults(res.data);
      } catch {
        setSearchResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch comparison data
  useEffect(() => {
    if (tickers.length < 2) {
      setData(null);
      return;
    }

    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError('');
      try {
        const res = await apiClient.get<CompareData>('/compare', {
          params: { tickers: tickers.join(','), period },
        });
        if (!cancelled) setData(res.data);
      } catch {
        if (!cancelled) setError('Failed to load comparison data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [tickers.join(','), period]);

  const addTicker = (ticker: string) => {
    if (ticker && !tickers.includes(ticker) && tickers.length < 5) {
      setTickers([...tickers, ticker]);
    }
    setSearchInput('');
  };

  const removeTicker = (ticker: string) => {
    setTickers(tickers.filter((t) => t !== ticker));
  };

  // Merge all series into chart data
  const chartData: Record<string, any>[] = [];
  if (data) {
    const dateMap = new Map<string, Record<string, number>>();
    for (const series of data.series) {
      for (const point of series.data) {
        const existing = dateMap.get(point.date) || {};
        existing[series.ticker] = point.returnPct;
        dateMap.set(point.date, existing);
      }
    }
    for (const [date, values] of [...dateMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      chartData.push({ date, ...values });
    }
  }

  return (
    <>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        Stock Comparison
      </Typography>

      {/* Ticker input */}
      <Paper variant="outlined" sx={{ ...panelSx, mb: 3 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap" mb={2}>
          <Autocomplete
            freeSolo
            options={searchResults.map((r) => r.ticker)}
            getOptionLabel={(opt) => {
              const match = searchResults.find((r) => r.ticker === opt);
              return match ? `${match.ticker} — ${match.name}` : String(opt);
            }}
            inputValue={searchInput}
            onInputChange={(_e, val) => setSearchInput(val)}
            onChange={(_e, val) => { if (val) addTicker(String(val).toUpperCase()); }}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                placeholder="Add ticker (e.g. AAPL)"
                sx={{ minWidth: 280 }}
              />
            )}
            sx={{ flexGrow: 1, maxWidth: 400 }}
          />
          <IconButton
            color="primary"
            onClick={() => {
              if (searchInput) addTicker(searchInput.toUpperCase());
            }}
            disabled={tickers.length >= 5}
          >
            <AddIcon />
          </IconButton>
          <Typography variant="caption" color="text.secondary">
            {tickers.length}/5 stocks
          </Typography>
        </Box>

        <Box display="flex" gap={1} flexWrap="wrap">
          {tickers.map((t, i) => (
            <Chip
              key={t}
              label={t}
              onDelete={() => removeTicker(t)}
              sx={{
                borderColor: CHART_COLORS[i % CHART_COLORS.length],
                color: CHART_COLORS[i % CHART_COLORS.length],
              }}
              variant="outlined"
            />
          ))}
        </Box>
      </Paper>

      {tickers.length < 2 && (
        <Alert severity="info">Add at least 2 stocks to compare their performance.</Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && (
        <Box textAlign="center" py={4}>
          <CircularProgress size={32} />
        </Box>
      )}

      {data && chartData.length > 0 && (
        <>
          {/* Period selector */}
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <ToggleButtonGroup
              value={period}
              exclusive
              onChange={(_e, v) => { if (v) setPeriod(v); }}
              size="small"
            >
              {PERIODS.map((p) => (
                <ToggleButton key={p} value={p}>{p}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {/* Chart */}
          <Paper variant="outlined" sx={{ ...panelSx, mb: 3 }}>
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', mb: 2, display: 'block' }}
            >
              Normalized Returns (%)
            </Typography>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => d.slice(5)}
                  interval="preserveStartEnd"
                  minTickGap={60}
                  tick={{ fill: CHART_AXIS_COLOR }}
                  fontSize={11}
                />
                <YAxis
                  tick={{ fill: CHART_AXIS_COLOR }}
                  fontSize={11}
                  tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name]}
                />
                <Legend />
                <ReferenceLine y={0} stroke="rgba(201,168,76,0.3)" strokeDasharray="3 3" />
                {data.tickers.map((ticker, i) => (
                  <Line
                    key={ticker}
                    type="monotone"
                    dataKey={ticker}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Paper>

          {/* Fundamentals table */}
          <Paper variant="outlined" sx={{ ...panelSx }}>
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', mb: 2, display: 'block' }}
            >
              Fundamentals Comparison
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Metric</TableCell>
                    {data.fundamentals.map((f) => (
                      <TableCell key={f.ticker} align="right">{f.ticker}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  <CompareRow label="Price" values={data.fundamentals.map((f) => `$${fmt(f.price)}`)} />
                  <CompareRow label="Market Cap" values={data.fundamentals.map((f) => f.marketCap != null ? `$${fmt(f.marketCap)}B` : 'N/A')} />
                  <CompareRow label="P/E Ratio" values={data.fundamentals.map((f) => f.pe != null ? fmt(f.pe) : 'N/A')} />
                  <CompareRow label="Div Yield" values={data.fundamentals.map((f) => f.dividendYield != null ? `${fmt(f.dividendYield)}%` : 'N/A')} />
                  <CompareRow label="52W High" values={data.fundamentals.map((f) => f.high52w != null ? `$${fmt(f.high52w)}` : 'N/A')} />
                  <CompareRow label="52W Low" values={data.fundamentals.map((f) => f.low52w != null ? `$${fmt(f.low52w)}` : 'N/A')} />
                  <CompareRow label="Sector" values={data.fundamentals.map((f) => f.sector || 'N/A')} />
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </>
  );
}

function CompareRow({ label, values }: { label: string; values: string[] }) {
  return (
    <TableRow>
      <TableCell>
        <Typography variant="body2" fontWeight={600}>{label}</Typography>
      </TableCell>
      {values.map((v, i) => (
        <TableCell key={i} align="right">
          <Typography variant="body2">{v}</Typography>
        </TableCell>
      ))}
    </TableRow>
  );
}

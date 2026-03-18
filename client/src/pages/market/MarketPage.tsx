import { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Paper,
  Box,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Link,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import TableChartIcon from '@mui/icons-material/TableChart';
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart';
import SearchIcon from '@mui/icons-material/Search';
import { Link as RouterLink } from 'react-router-dom';
import useApi from '../../hooks/useApi';
import apiClient from '../../apiClient';
import SP500CandlestickChart from '../../components/market/SP500CandlestickChart';
import SP500IndexChart from '../../components/market/SP500IndexChart';
import MarketClassifierTiles from '../../components/market/MarketClassifierTiles';
import MarketRegimePanel from '../../components/market/MarketRegimePanel';
import PageLoader from '../../components/ui/PageLoader';

interface MarketEntry {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  marketState: string;
  marketCap: number | null;
  volume: number | null;
  sector: string;
}

interface MarketResponse {
  data: MarketEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  sectors: string[];
}

interface CellRefs {
  priceEl: HTMLElement;
  changePctEl: HTMLElement;
  volumeEl: HTMLElement;
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtVolume(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

type SortField = 'ticker' | 'name' | 'price' | 'changePct' | 'marketCap' | 'volume' | 'sector';

// ── MarketPage — owns only the view toggle, never re-renders from price polls ─
export default function MarketPage() {
  const [view, setView] = useState<'table' | 'candle'>('table');

  return (
    <>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h4">Market Overview</Typography>
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={(_e, v) => { if (v) setView(v); }}
          size="small"
        >
          <ToggleButton value="table">
            <TableChartIcon fontSize="small" sx={{ mr: 0.5 }} /> Table
          </ToggleButton>
          <ToggleButton value="candle">
            <CandlestickChartIcon fontSize="small" sx={{ mr: 0.5 }} /> Candle
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Paper
        variant="outlined"
        sx={{
          p: 4, mb: 3,
          background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
          border: '1px solid rgba(0,200,5,0.1)',
        }}
      >
        {view === 'candle' ? <SP500CandlestickChart /> : <SP500IndexChart />}
      </Paper>

      <MarketRegimePanel />

      <Box mb={3}>
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a8ba5', mb: 1.5, display: 'block' }}
        >
          Market Classifiers
        </Typography>
        <MarketClassifierTiles />
      </Box>

      {view === 'table' && <StockTable />}
    </>
  );
}

// ── StockTable ─────────────────────────────────────────────────────────────
// Two update paths:
//   1. Structural changes (page/sort/filter) → useApi refetch → React re-render
//   2. Live price poll (every 5s) → direct DOM mutation via cellRefs → zero re-render
function StockTable() {
  const isLoggedIn = !!localStorage.getItem('token');

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [sortField, setSortField] = useState<SortField>('marketCap');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sector, setSector] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [sector, sortField, sortOrder]);

  const apiParams: Record<string, unknown> = {
    page: page + 1, limit: rowsPerPage, sort: sortField, order: sortOrder,
  };
  if (sector) apiParams.sector = sector;
  if (debouncedSearch) apiParams.q = debouncedSearch;

  // Structural fetch only — no poll interval here
  const { data: response, loading, error } = useApi<MarketResponse>('/market', apiParams);

  // Always-current params for the poll closure
  const apiParamsRef = useRef(apiParams);
  useEffect(() => { apiParamsRef.current = apiParams; });

  // ticker → live cell DOM refs
  const cellRefs = useRef<Map<string, CellRefs>>(new Map());

  // Direct DOM poll — fires every 5s, never calls setState
  useEffect(() => {
    if (!response) return;
    const id = setInterval(async () => {
      try {
        const { data: result } = await apiClient.get<MarketResponse>('/market', { params: apiParamsRef.current });
        for (const entry of result.data) {
          const cells = cellRefs.current.get(entry.ticker);
          if (!cells) continue;

          // Price
          const prev = Number(cells.priceEl.dataset.price ?? 0);
          if (prev !== entry.price) {
            cells.priceEl.textContent = `$${fmt(entry.price)}`;
            cells.priceEl.dataset.price = String(entry.price);
            const row = cells.priceEl.closest('tr') as HTMLElement | null;
            if (row) {
              row.classList.remove('flash-up', 'flash-down');
              // Force reflow so animation restarts if the same direction fires twice
              void row.offsetHeight;
              row.classList.add(entry.price > prev ? 'flash-up' : 'flash-down');
              setTimeout(() => row.classList.remove('flash-up', 'flash-down'), 650);
            }
          }

          // Change %
          if (cells.changePctEl.dataset.val !== String(entry.changePct)) {
            cells.changePctEl.dataset.val = String(entry.changePct);
            cells.changePctEl.textContent = `${entry.changePct >= 0 ? '+' : ''}${entry.changePct.toFixed(2)}%`;
            cells.changePctEl.style.color = entry.changePct >= 0 ? '#00C805' : '#ff4d4d';
          }

          // Volume
          if (cells.volumeEl.dataset.val !== String(entry.volume)) {
            cells.volumeEl.dataset.val = String(entry.volume ?? '');
            cells.volumeEl.textContent = fmtVolume(entry.volume);
          }
        }
      } catch { /* ignore poll errors */ }
    }, 5_000);
    return () => clearInterval(id);
  }, [!!response]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'ticker' || field === 'name' || field === 'sector' ? 'asc' : 'desc');
    }
  };

  if (loading && !response) return <PageLoader />;

  const entries = response?.data ?? [];
  const pagination = response?.pagination;
  const sectors = response?.sectors ?? [];
  const marketState = entries[0]?.marketState;

  return (
    <>
      <Box display="flex" alignItems="center" mb={2}>
        <Typography variant="body2" color="text.secondary">
          {marketState === 'REGULAR'
            ? 'Market is open — prices update every 5 sec (15-min delay).'
            : marketState === 'PRE'
              ? 'Pre-market session — prices update every 5 sec.'
              : marketState === 'POST'
                ? 'After-hours session — prices update every 5 sec.'
                : 'Market is closed — showing last closing prices.'}
          {pagination && ` Showing ${pagination.total} stocks.`}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box display="flex" gap={2} mb={2} flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Search ticker or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 240 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Sector</InputLabel>
          <Select value={sector} label="Sector" onChange={(e: SelectChangeEvent) => setSector(e.target.value)}>
            <MenuItem value="">All Sectors</MenuItem>
            {sectors.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <SortableCell field="ticker"    label="Ticker"    current={sortField} order={sortOrder} onSort={handleSort} />
              <SortableCell field="name"      label="Company"   current={sortField} order={sortOrder} onSort={handleSort} />
              <SortableCell field="sector"    label="Sector"    current={sortField} order={sortOrder} onSort={handleSort} />
              <SortableCell field="price"     label="Price"     current={sortField} order={sortOrder} onSort={handleSort} align="right" />
              <SortableCell field="changePct" label="Change %"  current={sortField} order={sortOrder} onSort={handleSort} align="right" />
              <SortableCell field="marketCap" label="Mkt Cap"   current={sortField} order={sortOrder} onSort={handleSort} align="right" />
              <SortableCell field="volume"    label="Volume"    current={sortField} order={sortOrder} onSort={handleSort} align="right" />
              {isLoggedIn && <TableCell align="center">Trade</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((e) => (
              <StockRow
                key={e.ticker}
                ticker={e.ticker}
                name={e.name}
                sector={e.sector}
                price={e.price}
                changePct={e.changePct}
                marketCap={e.marketCap}
                volume={e.volume}
                isLoggedIn={isLoggedIn}
                cellRefs={cellRefs}
              />
            ))}
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={isLoggedIn ? 8 : 7} align="center">
                  {debouncedSearch || sector
                    ? 'No stocks match your filters.'
                    : 'No market data available. Try again later.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {pagination && (
        <TablePagination
          component="div"
          count={pagination.total}
          page={page}
          onPageChange={(_e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[25, 50, 100]}
        />
      )}
    </>
  );
}

// ── StockRow — renders once, registers DOM refs, never re-renders on price polls ─
const StockRow = memo(function StockRow({
  ticker, name, sector, price, changePct, marketCap, volume, isLoggedIn, cellRefs,
}: {
  ticker: string; name: string; sector: string;
  price: number; changePct: number; marketCap: number | null; volume: number | null;
  isLoggedIn: boolean;
  cellRefs: React.MutableRefObject<Map<string, CellRefs>>;
}) {
  const navigate = useNavigate();
  const priceRef    = useRef<HTMLTableCellElement>(null);
  const changePctRef = useRef<HTMLTableCellElement>(null);
  const volumeRef   = useRef<HTMLTableCellElement>(null);

  // Register cell DOM nodes with the parent poll loop on mount; deregister on unmount
  useEffect(() => {
    if (priceRef.current && changePctRef.current && volumeRef.current) {
      cellRefs.current.set(ticker, {
        priceEl: priceRef.current,
        changePctEl: changePctRef.current,
        volumeEl: volumeRef.current,
      });
    }
    return () => { cellRefs.current.delete(ticker); };
  }, [ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TableRow hover>
      <TableCell>
        <Link component={RouterLink} to={`/stocks/${ticker}`} underline="hover" fontWeight="bold">
          {ticker}
        </Link>
      </TableCell>
      <TableCell>{name}</TableCell>
      <TableCell><Chip label={sector} size="small" variant="outlined" /></TableCell>

      {/* data-price stores the current value for the poll loop to compare */}
      <TableCell ref={priceRef} align="right" data-price={price}>
        ${fmt(price)}
      </TableCell>

      {/* data-val stores the current value; direct style used instead of MUI Chip (lighter DOM) */}
      <TableCell
        ref={changePctRef}
        align="right"
        data-val={changePct}
        style={{ color: changePct >= 0 ? '#00C805' : '#ff4d4d', fontWeight: 600 }}
      >
        <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
          {changePct > 0 ? <TrendingUpIcon fontSize="small" /> : changePct < 0 ? <TrendingDownIcon fontSize="small" /> : null}
          {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
        </Box>
      </TableCell>

      <TableCell align="right">{marketCap != null ? `$${fmt(marketCap)}B` : '—'}</TableCell>

      <TableCell ref={volumeRef} align="right" data-val={volume ?? ''}>
        {fmtVolume(volume)}
      </TableCell>

      {isLoggedIn && (
        <TableCell align="center">
          <Tooltip title={`Trade ${ticker}`}>
            <IconButton size="small" color="primary" onClick={() => navigate(`/trade?ticker=${ticker}`)}>
              <ShoppingCartIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </TableCell>
      )}
    </TableRow>
  );
});

// ── Sortable table header cell ──────────────────────────────────────────────
function SortableCell({
  field, label, current, order, onSort, align,
}: {
  field: SortField; label: string; current: SortField; order: 'asc' | 'desc';
  onSort: (f: SortField) => void; align?: 'left' | 'right' | 'center';
}) {
  return (
    <TableCell align={align} sortDirection={current === field ? order : false}>
      <TableSortLabel
        active={current === field}
        direction={current === field ? order : 'asc'}
        onClick={() => onSort(field)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );
}

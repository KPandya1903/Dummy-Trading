import { useState, useEffect } from 'react';
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
import GridViewIcon from '@mui/icons-material/GridView';
import SearchIcon from '@mui/icons-material/Search';
import { Link as RouterLink } from 'react-router-dom';
import useApi from '../hooks/useApi';
import MarketHeatmap from '../components/MarketHeatmap';
import SP500IndexChart from '../components/SP500IndexChart';
import MarketClassifierTiles from '../components/MarketClassifierTiles';
import MarketRegimePanel from '../components/MarketRegimePanel';
import PageLoader from '../components/ui/PageLoader';

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

function fmt(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtVolume(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

type SortField = 'ticker' | 'name' | 'price' | 'changePct' | 'marketCap' | 'volume' | 'sector';

export default function MarketPage() {
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('token');
  const [view, setView] = useState<'table' | 'heatmap'>('table');

  // Pagination, sort, filter state
  const [page, setPage] = useState(0); // 0-indexed for MUI
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [sortField, setSortField] = useState<SortField>('marketCap');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sector, setSector] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [sector, sortField, sortOrder]);

  const apiParams: Record<string, unknown> = {
    page: page + 1, // API is 1-indexed
    limit: rowsPerPage,
    sort: sortField,
    order: sortOrder,
  };
  if (sector) apiParams.sector = sector;
  if (debouncedSearch) apiParams.q = debouncedSearch;

  const { data: response, loading, error } = useApi<MarketResponse>(
    '/market',
    apiParams,
    5_000,
  );

  // Heatmap uses /market/top endpoint
  const { data: heatmapEntries } = useApi<MarketEntry[]>(
    view === 'heatmap' ? '/market/top' : null,
    { by: 'marketCap', limit: 30 },
    5_000,
  );

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
      <Typography variant="h4" gutterBottom>
        Market Overview
      </Typography>

      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
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
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={(_e, v) => { if (v) setView(v); }}
          size="small"
        >
          <ToggleButton value="table">
            <TableChartIcon fontSize="small" sx={{ mr: 0.5 }} /> Table
          </ToggleButton>
          <ToggleButton value="heatmap">
            <GridViewIcon fontSize="small" sx={{ mr: 0.5 }} /> Heatmap
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* S&P 500 Index Chart */}
      <Paper
        variant="outlined"
        sx={{
          p: 4,
          mb: 3,
          background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
          border: '1px solid rgba(0,200,5,0.1)',
        }}
      >
        <SP500IndexChart />
      </Paper>

      {/* Market Regime */}
      <MarketRegimePanel />

      {/* Market Classifier Tiles */}
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

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {view === 'heatmap' && heatmapEntries ? (
        <MarketHeatmap entries={heatmapEntries} />
      ) : view === 'table' ? (
        <>
          {/* Filters */}
          <Box display="flex" gap={2} mb={2} flexWrap="wrap">
            <TextField
              size="small"
              placeholder="Search ticker or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 240 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Sector</InputLabel>
              <Select
                value={sector}
                label="Sector"
                onChange={(e: SelectChangeEvent) => setSector(e.target.value)}
              >
                <MenuItem value="">All Sectors</MenuItem>
                {sectors.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <SortableCell field="ticker" label="Ticker" current={sortField} order={sortOrder} onSort={handleSort} />
                  <SortableCell field="name" label="Company" current={sortField} order={sortOrder} onSort={handleSort} />
                  <SortableCell field="sector" label="Sector" current={sortField} order={sortOrder} onSort={handleSort} />
                  <SortableCell field="price" label="Price" current={sortField} order={sortOrder} onSort={handleSort} align="right" />
                  <SortableCell field="changePct" label="Change %" current={sortField} order={sortOrder} onSort={handleSort} align="right" />
                  <SortableCell field="marketCap" label="Mkt Cap" current={sortField} order={sortOrder} onSort={handleSort} align="right" />
                  <SortableCell field="volume" label="Volume" current={sortField} order={sortOrder} onSort={handleSort} align="right" />
                  {isLoggedIn && <TableCell align="center">Trade</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.ticker} hover>
                    <TableCell>
                      <Link
                        component={RouterLink}
                        to={`/stocks/${e.ticker}`}
                        underline="hover"
                        fontWeight="bold"
                      >
                        {e.ticker}
                      </Link>
                    </TableCell>
                    <TableCell>{e.name}</TableCell>
                    <TableCell>
                      <Chip label={e.sector} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">${fmt(e.price)}</TableCell>
                    <TableCell align="right">
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 0.5,
                        }}
                      >
                        {e.changePct > 0 ? (
                          <TrendingUpIcon fontSize="small" color="success" />
                        ) : e.changePct < 0 ? (
                          <TrendingDownIcon fontSize="small" color="error" />
                        ) : null}
                        <Chip
                          label={`${e.changePct > 0 ? '+' : ''}${e.changePct.toFixed(2)}%`}
                          size="small"
                          color={
                            e.changePct > 0
                              ? 'success'
                              : e.changePct < 0
                                ? 'error'
                                : 'default'
                          }
                          variant="outlined"
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {e.marketCap != null ? `$${fmt(e.marketCap)}B` : '—'}
                    </TableCell>
                    <TableCell align="right">{fmtVolume(e.volume)}</TableCell>
                    {isLoggedIn && (
                      <TableCell align="center">
                        <Tooltip title={`Trade ${e.ticker}`}>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => navigate(`/trade?ticker=${e.ticker}`)}
                          >
                            <ShoppingCartIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
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
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[25, 50, 100]}
            />
          )}
        </>
      ) : null}
    </>
  );
}

// ── Sortable table header cell ──────────────────────────────
function SortableCell({
  field,
  label,
  current,
  order,
  onSort,
  align,
}: {
  field: SortField;
  label: string;
  current: SortField;
  order: 'asc' | 'desc';
  onSort: (f: SortField) => void;
  align?: 'left' | 'right' | 'center';
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

import { useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  MenuItem,
  Skeleton,
} from '@mui/material';
import useApi from '../../hooks/useApi';

export interface OptionChainEntry {
  strike: number;
  expiration: string;
  type: 'CALL' | 'PUT';
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

interface ChainResponse {
  ticker: string;
  spotPrice: number;
  expirations: string[];
  chain: OptionChainEntry[];
}

interface OptionsChainProps {
  ticker: string;
  onSelectOption: (entry: OptionChainEntry) => void;
  selectedExpiration: string;
  onExpirationChange: (exp: string) => void;
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OptionsChain({
  ticker,
  onSelectOption,
  selectedExpiration,
  onExpirationChange,
}: OptionsChainProps) {
  const { data, loading } = useApi<ChainResponse>(
    `/options/chain/${ticker}`,
    selectedExpiration ? { expiration: selectedExpiration } : undefined,
  );

  // Set initial expiration from first available
  const expirations = data?.expirations ?? [];
  const spotPrice = data?.spotPrice ?? 0;

  // Group chain entries by strike
  const strikes = useMemo(() => {
    if (!data?.chain) return [];
    const map = new Map<number, { call?: OptionChainEntry; put?: OptionChainEntry }>();
    for (const entry of data.chain) {
      const existing = map.get(entry.strike) ?? {};
      if (entry.type === 'CALL') existing.call = entry;
      else existing.put = entry;
      map.set(entry.strike, existing);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([strike, sides]) => ({ strike, ...sides }));
  }, [data?.chain]);

  // Find ATM strike (closest to spot)
  const atmStrike = useMemo(() => {
    if (!strikes.length || !spotPrice) return null;
    let closest = strikes[0].strike;
    let minDiff = Math.abs(strikes[0].strike - spotPrice);
    for (const s of strikes) {
      const diff = Math.abs(s.strike - spotPrice);
      if (diff < minDiff) {
        minDiff = diff;
        closest = s.strike;
      }
    }
    return closest;
  }, [strikes, spotPrice]);

  const SIDE_COLS = ['Last', 'Bid', 'Ask', 'Vol', 'OI', 'IV%', 'Delta'];

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Skeleton variant="rectangular" height={40} sx={{ mb: 2 }} />
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={32} sx={{ mb: 0.5 }} />
        ))}
      </Paper>
    );
  }

  return (
    <Box>
      {/* Expiration selector */}
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <TextField
          select
          label="Expiration"
          value={selectedExpiration || (expirations[0] ?? '')}
          onChange={(e) => onExpirationChange(e.target.value)}
          size="small"
          sx={{ minWidth: 200 }}
        >
          {expirations.map((exp) => (
            <MenuItem key={exp} value={exp}>
              {exp}
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="body2" color="text.secondary">
          Spot: <span style={{ color: '#00C805', fontWeight: 600 }}>${fmt(spotPrice)}</span>
        </Typography>
      </Box>

      {/* Chain table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              {/* CALLS header */}
              {SIDE_COLS.map((col) => (
                <TableCell key={`call-${col}`} align="right" sx={{ fontSize: '0.65rem' }}>
                  {col}
                </TableCell>
              ))}
              {/* STRIKE header */}
              <TableCell
                align="center"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  bgcolor: 'rgba(255,255,255,0.03)',
                  borderLeft: '2px solid rgba(0,200,5,0.2)',
                  borderRight: '2px solid rgba(0,200,5,0.2)',
                }}
              >
                STRIKE
              </TableCell>
              {/* PUTS header */}
              {SIDE_COLS.map((col) => (
                <TableCell key={`put-${col}`} align="right" sx={{ fontSize: '0.65rem' }}>
                  {col}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {strikes.map(({ strike, call, put }) => {
              const isATM = strike === atmStrike;
              const callITM = spotPrice > strike;
              const putITM = spotPrice < strike;

              return (
                <TableRow
                  key={strike}
                  sx={{
                    ...(isATM && {
                      border: '2px solid rgba(0,200,5,0.3)',
                    }),
                  }}
                >
                  {/* CALL side */}
                  <SideCell entry={call} field="last" itm={callITM} onClick={() => call && onSelectOption(call)} />
                  <SideCell entry={call} field="bid" itm={callITM} onClick={() => call && onSelectOption(call)} />
                  <SideCell entry={call} field="ask" itm={callITM} onClick={() => call && onSelectOption(call)} />
                  <SideCell entry={call} field="volume" itm={callITM} onClick={() => call && onSelectOption(call)} isInt />
                  <SideCell entry={call} field="openInterest" itm={callITM} onClick={() => call && onSelectOption(call)} isInt />
                  <SideCell entry={call} field="iv" itm={callITM} onClick={() => call && onSelectOption(call)} isPct />
                  <SideCell entry={call} field="delta" itm={callITM} onClick={() => call && onSelectOption(call)} isDelta />

                  {/* STRIKE */}
                  <TableCell
                    align="center"
                    sx={{
                      fontWeight: 700,
                      bgcolor: 'rgba(255,255,255,0.03)',
                      borderLeft: '2px solid rgba(0,200,5,0.2)',
                      borderRight: '2px solid rgba(0,200,5,0.2)',
                      ...(isATM && { color: '#00C805' }),
                    }}
                  >
                    {fmt(strike)}
                  </TableCell>

                  {/* PUT side */}
                  <SideCell entry={put} field="last" itm={putITM} onClick={() => put && onSelectOption(put)} />
                  <SideCell entry={put} field="bid" itm={putITM} onClick={() => put && onSelectOption(put)} />
                  <SideCell entry={put} field="ask" itm={putITM} onClick={() => put && onSelectOption(put)} />
                  <SideCell entry={put} field="volume" itm={putITM} onClick={() => put && onSelectOption(put)} isInt />
                  <SideCell entry={put} field="openInterest" itm={putITM} onClick={() => put && onSelectOption(put)} isInt />
                  <SideCell entry={put} field="iv" itm={putITM} onClick={() => put && onSelectOption(put)} isPct />
                  <SideCell entry={put} field="delta" itm={putITM} onClick={() => put && onSelectOption(put)} isDelta />
                </TableRow>
              );
            })}

            {strikes.length === 0 && (
              <TableRow>
                <TableCell colSpan={15} align="center">
                  No options data available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function SideCell({
  entry,
  field,
  itm,
  onClick,
  isInt,
  isPct,
  isDelta,
}: {
  entry?: OptionChainEntry;
  field: keyof OptionChainEntry;
  itm: boolean;
  onClick: () => void;
  isInt?: boolean;
  isPct?: boolean;
  isDelta?: boolean;
}) {
  const value = entry ? entry[field] : null;

  let display = '-';
  if (value !== null && value !== undefined) {
    if (isPct) display = fmtPct(value as number);
    else if (isDelta) display = (value as number).toFixed(3);
    else if (isInt) display = (value as number).toLocaleString();
    else display = fmt(value as number);
  }

  return (
    <TableCell
      align="right"
      onClick={entry ? onClick : undefined}
      sx={{
        cursor: entry ? 'pointer' : 'default',
        fontSize: '0.8rem',
        ...(itm && { bgcolor: 'rgba(0,200,5,0.06)' }),
        '&:hover': entry ? { bgcolor: 'rgba(0,200,5,0.12)' } : undefined,
      }}
    >
      {display}
    </TableCell>
  );
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

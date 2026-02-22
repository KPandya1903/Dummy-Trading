import { useState, useEffect, FormEvent } from 'react';
import {
  Stack,
  TextField,
  Button,
  MenuItem,
  Alert,
  Typography,
  Paper,
  Box,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Autocomplete,
} from '@mui/material';
import apiClient from '../apiClient';

type OrderType = 'MARKET' | 'LIMIT' | 'STOP';

interface MarketOption {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
}

interface TradeFormProps {
  portfolioId: number;
  onSuccess: () => void;
  initialTicker?: string;
  initialSide?: 'BUY' | 'SELL';
}

interface FieldErrors {
  ticker?: string;
  quantity?: string;
  targetPrice?: string;
}

export default function TradeForm({
  portfolioId,
  onSuccess,
  initialTicker = '',
  initialSide = 'BUY',
}: TradeFormProps) {
  const [ticker, setTicker] = useState(initialTicker);
  const [side, setSide] = useState<'BUY' | 'SELL'>(initialSide);
  const [quantity, setQuantity] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [targetPrice, setTargetPrice] = useState('');

  // Autocomplete search state
  const [searchInput, setSearchInput] = useState(initialTicker);
  const [searchOptions, setSearchOptions] = useState<MarketOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Auto-fetched price state
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Confirmation dialog
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Sync initialTicker prop changes (e.g. from quick trade)
  useEffect(() => {
    if (initialTicker) {
      setTicker(initialTicker);
      setSearchInput(initialTicker);
    }
  }, [initialTicker]);

  useEffect(() => {
    if (initialSide) setSide(initialSide);
  }, [initialSide]);

  // Debounced search for autocomplete (universal Yahoo search)
  useEffect(() => {
    const q = searchInput.trim();
    if (!q) {
      setSearchOptions([]);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        // Try universal search first, fall back to S&P 500 search
        const { data } = await apiClient.get('/search', { params: { q } });
        // Universal search doesn't return price/changePct, so fill defaults
        const mapped = (data as any[]).map((r: any) => ({
          ticker: r.ticker,
          name: r.name,
          price: r.price ?? 0,
          changePct: r.changePct ?? 0,
        }));
        setSearchOptions(mapped);
      } catch {
        // Fall back to S&P 500 search
        try {
          const { data } = await apiClient.get('/market/search', { params: { q } });
          setSearchOptions(data);
        } catch {
          setSearchOptions([]);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch real-time price when ticker changes (debounced) — uses quotes endpoint for any ticker
  useEffect(() => {
    const trimmed = ticker.trim().toUpperCase();
    if (!trimmed || !/^[A-Z.]{1,6}$/.test(trimmed)) {
      setLivePrice(null);
      return;
    }

    setPriceLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await apiClient.get(`/quotes/${trimmed}`);
        setLivePrice(data.price ?? null);
      } catch {
        setLivePrice(null);
      } finally {
        setPriceLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [ticker]);

  const isLimitOrStop = orderType !== 'MARKET';

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    const trimmed = ticker.trim();
    if (!trimmed) {
      errors.ticker = 'Ticker is required';
    } else if (!/^[A-Za-z.]{1,6}$/.test(trimmed)) {
      errors.ticker = '1-6 characters (letters and dots)';
    } else if (livePrice === null) {
      errors.ticker = 'Ticker not found in market data';
    }

    const qty = Number(quantity);
    if (!quantity || isNaN(qty)) {
      errors.quantity = 'Required';
    } else if (!Number.isInteger(qty) || qty <= 0) {
      errors.quantity = 'Must be a whole number > 0';
    }

    if (isLimitOrStop) {
      const tp = Number(targetPrice);
      if (!targetPrice || isNaN(tp)) {
        errors.targetPrice = 'Required';
      } else if (tp <= 0) {
        errors.targetPrice = 'Must be > 0';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setServerError('');
    setSuccessMsg('');
    if (!validate()) return;
    setConfirmOpen(true);
  };

  const executeTrade = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      if (isLimitOrStop) {
        // Create a pending order
        const { data } = await apiClient.post('/orders', {
          portfolioId,
          ticker: ticker.trim().toUpperCase(),
          side,
          quantity: Number(quantity),
          orderType,
          targetPrice: Number(targetPrice),
        });
        setSuccessMsg(
          `${orderType} order placed: ${data.side} ${data.quantity} × ${data.ticker} @ target $${Number(data.targetPrice).toFixed(2)}`,
        );
      } else {
        // Market order — execute immediately
        const { data } = await apiClient.post('/trades', {
          portfolioId,
          ticker: ticker.trim().toUpperCase(),
          side,
          quantity: Number(quantity),
        });
        let msg = `${data.side} ${data.quantity} × ${data.ticker} @ $${data.price.toFixed(2)}`;
        if (data.newBadges && data.newBadges.length > 0) {
          msg += ` | New badge${data.newBadges.length > 1 ? 's' : ''}: ${data.newBadges.join(', ')}`;
        }
        setSuccessMsg(msg);
      }

      setTicker('');
      setSearchInput('');
      setQuantity('');
      setTargetPrice('');
      setOrderType('MARKET');
      setLivePrice(null);
      setFieldErrors({});
      onSuccess();
    } catch (err: any) {
      setServerError(err.response?.data?.error || 'Trade failed');
    } finally {
      setSubmitting(false);
    }
  };

  const displayPrice = isLimitOrStop ? Number(targetPrice) || 0 : (livePrice ?? 0);
  const totalCost = displayPrice * (Number(quantity) || 0);

  const orderTypeLabel = orderType === 'MARKET'
    ? 'market price'
    : orderType === 'LIMIT'
      ? 'limit price'
      : 'stop price';

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        New Trade
      </Typography>

      {serverError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {serverError}
        </Alert>
      )}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      <Stack component="form" onSubmit={handleSubmit} spacing={2}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="flex-start">
          <Autocomplete
            freeSolo
            options={searchOptions}
            getOptionLabel={(opt) =>
              typeof opt === 'string' ? opt : opt.ticker
            }
            inputValue={searchInput}
            onInputChange={(_e, value) => {
              setSearchInput(value);
              if (fieldErrors.ticker) setFieldErrors((p) => ({ ...p, ticker: undefined }));
            }}
            onChange={(_e, value) => {
              if (value && typeof value !== 'string') {
                setTicker(value.ticker);
                setSearchInput(value.ticker);
                setLivePrice(value.price);
              } else if (typeof value === 'string') {
                setTicker(value);
              } else {
                setTicker('');
              }
            }}
            onBlur={() => {
              // If user typed freely without selecting, use the input
              if (!ticker && searchInput.trim()) {
                setTicker(searchInput.trim().toUpperCase());
              }
            }}
            loading={searchLoading}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.ticker}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {option.ticker}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.name}
                    </Typography>
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="body2">
                      ${option.price.toFixed(2)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color={option.changePct >= 0 ? 'success.main' : 'error.main'}
                    >
                      {option.changePct >= 0 ? '+' : ''}
                      {option.changePct.toFixed(2)}%
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Ticker"
                size="small"
                error={!!fieldErrors.ticker}
                helperText={fieldErrors.ticker}
                sx={{ width: 200 }}
              />
            )}
            sx={{ width: 200 }}
          />
          <TextField
            label="Side"
            size="small"
            select
            value={side}
            onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}
            sx={{ width: 100 }}
          >
            <MenuItem value="BUY">BUY</MenuItem>
            <MenuItem value="SELL">SELL</MenuItem>
          </TextField>
          <TextField
            label="Order Type"
            size="small"
            select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as OrderType)}
            sx={{ width: 120 }}
          >
            <MenuItem value="MARKET">Market</MenuItem>
            <MenuItem value="LIMIT">Limit</MenuItem>
            <MenuItem value="STOP">Stop</MenuItem>
          </TextField>
          <TextField
            label="Quantity"
            size="small"
            type="number"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              if (fieldErrors.quantity)
                setFieldErrors((p) => ({ ...p, quantity: undefined }));
            }}
            error={!!fieldErrors.quantity}
            helperText={fieldErrors.quantity}
            sx={{ width: 120 }}
          />
          {isLimitOrStop && (
            <TextField
              label={orderType === 'LIMIT' ? 'Limit Price' : 'Stop Price'}
              size="small"
              type="number"
              value={targetPrice}
              onChange={(e) => {
                setTargetPrice(e.target.value);
                if (fieldErrors.targetPrice)
                  setFieldErrors((p) => ({ ...p, targetPrice: undefined }));
              }}
              error={!!fieldErrors.targetPrice}
              helperText={fieldErrors.targetPrice}
              sx={{ width: 140 }}
              inputProps={{ step: '0.01' }}
            />
          )}
          <TextField
            label="Market Price"
            size="small"
            value={
              priceLoading
                ? 'Loading...'
                : livePrice !== null
                  ? `$${livePrice.toFixed(2)}`
                  : ticker.trim()
                    ? 'N/A'
                    : ''
            }
            disabled
            sx={{ width: 140 }}
            InputProps={{
              endAdornment: priceLoading ? (
                <CircularProgress size={16} />
              ) : null,
            }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || priceLoading || livePrice === null}
            sx={{ height: 40 }}
          >
            {submitting
              ? 'Submitting...'
              : isLimitOrStop
                ? `Place ${orderType} Order`
                : 'Execute Trade'}
          </Button>
        </Stack>
      </Stack>

      {/* ── Confirmation dialog ──────────────────────── */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>
          {isLimitOrStop ? `Confirm ${orderType} Order` : 'Confirm Trade'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>{side}</strong> {quantity} share{Number(quantity) !== 1 ? 's' : ''} of{' '}
            <strong>{ticker.trim().toUpperCase()}</strong> at{' '}
            <strong>
              {isLimitOrStop
                ? `${orderTypeLabel} $${Number(targetPrice).toFixed(2)}`
                : `$${livePrice?.toFixed(2)}`}
            </strong>
          </DialogContentText>
          {isLimitOrStop && livePrice !== null && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Current market price: ${livePrice.toFixed(2)}
            </Typography>
          )}
          <Typography variant="h6" sx={{ mt: 1 }}>
            {isLimitOrStop ? 'Est. ' : ''}Total: $
            {totalCost.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={executeTrade}
            color={side === 'BUY' ? 'primary' : 'error'}
          >
            {isLimitOrStop ? `Place ${orderType} Order` : `Confirm ${side}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

import { useState, useEffect } from 'react';
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
  Autocomplete,
  Stepper,
  Step,
  StepLabel,
  ToggleButtonGroup,
  ToggleButton,
  Collapse,
  Divider,
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

const STEPS = ['Select Stock', 'Configure Order', 'Review & Confirm'];

function fmt(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function TradeForm({
  portfolioId,
  onSuccess,
  initialTicker = '',
  initialSide = 'BUY',
}: TradeFormProps) {
  const [activeStep, setActiveStep] = useState(0);
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
  const [stockName, setStockName] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Sync initialTicker prop changes (e.g. from quick trade)
  useEffect(() => {
    if (initialTicker) {
      setTicker(initialTicker);
      setSearchInput(initialTicker);
      // Skip to step 2 when ticker is pre-filled
      setActiveStep(1);
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
        const { data } = await apiClient.get('/search', { params: { q } });
        const mapped = (data as any[]).map((r: any) => ({
          ticker: r.ticker,
          name: r.name,
          price: r.price ?? 0,
          changePct: r.changePct ?? 0,
        }));
        setSearchOptions(mapped);
      } catch {
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

  // Fetch real-time price when ticker changes (debounced)
  useEffect(() => {
    const trimmed = ticker.trim().toUpperCase();
    if (!trimmed || !/^[A-Z.]{1,6}$/.test(trimmed)) {
      setLivePrice(null);
      setStockName('');
      return;
    }

    setPriceLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await apiClient.get(`/quotes/${trimmed}`);
        setLivePrice(data.price ?? null);
        setStockName(data.name ?? '');
      } catch {
        setLivePrice(null);
        setStockName('');
      } finally {
        setPriceLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [ticker]);

  const isLimitOrStop = orderType !== 'MARKET';

  const validateStep1 = (): boolean => {
    const errors: FieldErrors = {};
    const trimmed = ticker.trim();
    if (!trimmed) {
      errors.ticker = 'Ticker is required';
    } else if (!/^[A-Za-z.]{1,6}$/.test(trimmed)) {
      errors.ticker = '1-6 characters (letters and dots)';
    } else if (livePrice === null) {
      errors.ticker = 'Ticker not found in market data';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errors: FieldErrors = {};
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

  const handleNext = () => {
    if (activeStep === 0) {
      if (!validateStep1()) return;
      setActiveStep(1);
    } else if (activeStep === 1) {
      if (!validateStep2()) return;
      setActiveStep(2);
    }
  };

  const handleBack = () => {
    setFieldErrors({});
    setActiveStep((prev) => Math.max(0, prev - 1));
  };

  const resetForm = () => {
    setActiveStep(0);
    setTicker('');
    setSearchInput('');
    setQuantity('');
    setTargetPrice('');
    setOrderType('MARKET');
    setSide('BUY');
    setLivePrice(null);
    setStockName('');
    setFieldErrors({});
  };

  const executeTrade = async () => {
    setSubmitting(true);
    setServerError('');
    try {
      if (isLimitOrStop) {
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
      resetForm();
      onSuccess();
    } catch (err: any) {
      setServerError(err.response?.data?.error || 'Trade failed');
    } finally {
      setSubmitting(false);
    }
  };

  const displayPrice = isLimitOrStop ? Number(targetPrice) || 0 : (livePrice ?? 0);
  const totalCost = displayPrice * (Number(quantity) || 0);
  const tickerDisplay = ticker.trim().toUpperCase();

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        New Trade
      </Typography>

      {serverError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setServerError('')}>
          {serverError}
        </Alert>
      )}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg('')}>
          {successMsg}
        </Alert>
      )}

      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* ── Step 1: Select Stock ─────────────────────────── */}
      <Collapse in={activeStep === 0} timeout={350} unmountOnExit>
        <Box sx={{ maxWidth: 480, mx: 'auto' }}>
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
                setStockName(value.name);
              } else if (typeof value === 'string') {
                setTicker(value);
              } else {
                setTicker('');
              }
            }}
            onBlur={() => {
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
                label="Search for a stock"
                error={!!fieldErrors.ticker}
                helperText={fieldErrors.ticker}
                fullWidth
              />
            )}
            fullWidth
          />

          {/* Live price display */}
          {ticker.trim() && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                borderRadius: 1,
                bgcolor: 'rgba(201,168,76,0.05)',
                border: '1px solid rgba(201,168,76,0.15)',
              }}
            >
              {priceLoading ? (
                <Box display="flex" alignItems="center" gap={1}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">
                    Fetching price...
                  </Typography>
                </Box>
              ) : livePrice !== null ? (
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      {tickerDisplay}
                    </Typography>
                    {stockName && (
                      <Typography variant="caption" color="text.secondary">
                        {stockName}
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="h5" fontWeight={700}>
                    ${fmt(livePrice)}
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="error.main">
                  Ticker not found
                </Typography>
              )}
            </Box>
          )}

          <Button
            variant="contained"
            fullWidth
            sx={{ mt: 3 }}
            onClick={handleNext}
            disabled={priceLoading || (!ticker.trim())}
          >
            Continue
          </Button>
        </Box>
      </Collapse>

      {/* ── Step 2: Configure Order ──────────────────────── */}
      <Collapse in={activeStep === 1} timeout={350} unmountOnExit>
        <Box sx={{ maxWidth: 400, mx: 'auto' }}>
          {/* Ticker + price reminder */}
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={3}
            px={1}
          >
            <Typography variant="h6" fontWeight={700}>
              {tickerDisplay}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              ${livePrice !== null ? fmt(livePrice) : '—'}
            </Typography>
          </Box>

          {/* Buy / Sell toggle */}
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            SIDE
          </Typography>
          <ToggleButtonGroup
            value={side}
            exclusive
            onChange={(_e, v) => { if (v) setSide(v); }}
            fullWidth
            sx={{ mb: 2.5 }}
          >
            <ToggleButton
              value="BUY"
              sx={{
                '&.Mui-selected': {
                  bgcolor: 'success.main',
                  color: '#fff',
                  '&:hover': { bgcolor: 'success.dark' },
                },
              }}
            >
              BUY
            </ToggleButton>
            <ToggleButton
              value="SELL"
              sx={{
                '&.Mui-selected': {
                  bgcolor: 'error.main',
                  color: '#fff',
                  '&:hover': { bgcolor: 'error.dark' },
                },
              }}
            >
              SELL
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Order type */}
          <TextField
            label="Order Type"
            select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as OrderType)}
            fullWidth
            sx={{ mb: 2.5 }}
          >
            <MenuItem value="MARKET">Market</MenuItem>
            <MenuItem value="LIMIT">Limit</MenuItem>
            <MenuItem value="STOP">Stop</MenuItem>
          </TextField>

          {/* Quantity */}
          <TextField
            label="Quantity"
            type="number"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              if (fieldErrors.quantity)
                setFieldErrors((p) => ({ ...p, quantity: undefined }));
            }}
            error={!!fieldErrors.quantity}
            helperText={fieldErrors.quantity}
            fullWidth
            sx={{ mb: 2.5 }}
          />

          {/* Limit / Stop price */}
          {isLimitOrStop && (
            <TextField
              label={orderType === 'LIMIT' ? 'Limit Price' : 'Stop Price'}
              type="number"
              value={targetPrice}
              onChange={(e) => {
                setTargetPrice(e.target.value);
                if (fieldErrors.targetPrice)
                  setFieldErrors((p) => ({ ...p, targetPrice: undefined }));
              }}
              error={!!fieldErrors.targetPrice}
              helperText={fieldErrors.targetPrice}
              fullWidth
              sx={{ mb: 2.5 }}
              inputProps={{ step: '0.01' }}
            />
          )}

          {/* Estimated total */}
          {Number(quantity) > 0 && displayPrice > 0 && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'rgba(201,168,76,0.05)',
                border: '1px solid rgba(201,168,76,0.15)',
                mb: 2.5,
              }}
            >
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  {isLimitOrStop ? 'Est. Total' : 'Total'}
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  ${fmt(totalCost)}
                </Typography>
              </Box>
            </Box>
          )}

          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={handleBack} fullWidth>
              Back
            </Button>
            <Button variant="contained" onClick={handleNext} fullWidth>
              Review Order
            </Button>
          </Stack>
        </Box>
      </Collapse>

      {/* ── Step 3: Review & Confirm ─────────────────────── */}
      <Collapse in={activeStep === 2} timeout={350} unmountOnExit>
        <Box sx={{ maxWidth: 420, mx: 'auto' }}>
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              background: 'linear-gradient(135deg, #111d31 0%, #162240 100%)',
              border: '1px solid rgba(201,168,76,0.15)',
            }}
          >
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ letterSpacing: '0.1em' }}
            >
              ORDER SUMMARY
            </Typography>

            <Box display="flex" justifyContent="space-between" alignItems="center" mt={1.5} mb={1}>
              <Typography variant="h5" fontWeight={700}>
                {tickerDisplay}
              </Typography>
              <Typography
                variant="h6"
                fontWeight={700}
                color={side === 'BUY' ? 'success.main' : 'error.main'}
              >
                {side}
              </Typography>
            </Box>

            {stockName && (
              <Typography variant="body2" color="text.secondary" mb={2}>
                {stockName}
              </Typography>
            )}

            <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)', mb: 2 }} />

            <Stack spacing={1.5}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Shares
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {quantity}
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Order Type
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {orderType === 'MARKET' ? 'Market' : orderType === 'LIMIT' ? 'Limit' : 'Stop'}
                </Typography>
              </Box>

              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  {isLimitOrStop ? 'Target Price' : 'Market Price'}
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  ${isLimitOrStop ? fmt(Number(targetPrice)) : fmt(livePrice ?? 0)}
                </Typography>
              </Box>

              {isLimitOrStop && livePrice !== null && (
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Current Market Price
                  </Typography>
                  <Typography variant="body1">
                    ${fmt(livePrice)}
                  </Typography>
                </Box>
              )}
            </Stack>

            <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)', my: 2 }} />

            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="body1" color="text.secondary">
                {isLimitOrStop ? 'Est. Total' : 'Total'}
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                ${fmt(totalCost)}
              </Typography>
            </Box>
          </Paper>

          <Stack direction="row" spacing={2} mt={3}>
            <Button variant="outlined" onClick={handleBack} fullWidth>
              Edit
            </Button>
            <Button
              variant="contained"
              onClick={executeTrade}
              fullWidth
              disabled={submitting}
              color={side === 'BUY' ? 'primary' : 'error'}
            >
              {submitting
                ? 'Submitting...'
                : isLimitOrStop
                  ? `Place ${orderType} Order`
                  : `Confirm ${side}`}
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
}

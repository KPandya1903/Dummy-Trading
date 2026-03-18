import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Stepper,
  Step,
  StepLabel,
  Collapse,
  Divider,
  Alert,
} from '@mui/material';
import apiClient from '../../apiClient';
import { useToast } from '../../context/ToastContext';

interface PrefilledOption {
  type: 'CALL' | 'PUT';
  strike: number;
  expiration: string;
  premium: number;
}

interface OptionOrderFormProps {
  portfolioId: number;
  ticker: string;
  prefilledOption?: PrefilledOption;
  onSuccess: () => void;
}

const STEPS = ['Contract Details', 'Order Details', 'Review & Confirm'];

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OptionOrderForm({
  portfolioId,
  ticker,
  prefilledOption,
  onSuccess,
}: OptionOrderFormProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [optionType, setOptionType] = useState<'CALL' | 'PUT'>(prefilledOption?.type ?? 'CALL');
  const [strike, setStrike] = useState(prefilledOption?.strike?.toString() ?? '');
  const [expiration, setExpiration] = useState(prefilledOption?.expiration ?? '');
  const [premium, setPremium] = useState(prefilledOption?.premium?.toString() ?? '');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();

  // Sync prefilled option
  useEffect(() => {
    if (prefilledOption) {
      setOptionType(prefilledOption.type);
      setStrike(prefilledOption.strike.toString());
      setExpiration(prefilledOption.expiration);
      setPremium(prefilledOption.premium.toString());
      setActiveStep(0);
    }
  }, [prefilledOption]);

  const totalCost = (Number(premium) || 0) * (Number(quantity) || 0) * 100;

  const breakeven =
    optionType === 'CALL'
      ? (Number(strike) || 0) + (Number(premium) || 0) * (side === 'BUY' ? 1 : -1)
      : (Number(strike) || 0) - (Number(premium) || 0) * (side === 'BUY' ? 1 : -1);

  const canProceedStep1 = strike && expiration && premium;
  const canProceedStep2 = quantity && Number(quantity) > 0;

  const handleNext = () => {
    if (activeStep < 2) setActiveStep((s) => s + 1);
  };

  const handleBack = () => {
    setActiveStep((s) => Math.max(0, s - 1));
  };

  const resetForm = () => {
    setActiveStep(0);
    setSide('BUY');
    setQuantity('');
    if (!prefilledOption) {
      setOptionType('CALL');
      setStrike('');
      setExpiration('');
      setPremium('');
    }
  };

  const executeOrder = async () => {
    setSubmitting(true);
    try {
      await apiClient.post('/options', {
        portfolioId,
        ticker: ticker.toUpperCase(),
        optionType,
        side,
        strikePrice: Number(strike),
        expirationDate: expiration,
        quantity: Number(quantity),
        premium: Number(premium),
      });
      showToast(
        `${side} ${quantity} ${ticker.toUpperCase()} ${optionType} $${fmt(Number(strike))} @ $${fmt(Number(premium))}`,
      );
      resetForm();
      onSuccess();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Option order failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Options Order — {ticker.toUpperCase()}
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step 1: Contract Details */}
      <Collapse in={activeStep === 0} timeout={350} unmountOnExit>
        <Box sx={{ maxWidth: 440, mx: 'auto' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            OPTION TYPE
          </Typography>
          <ToggleButtonGroup
            value={optionType}
            exclusive
            onChange={(_e, v) => { if (v) setOptionType(v); }}
            fullWidth
            sx={{ mb: 3 }}
          >
            <ToggleButton
              value="CALL"
              sx={{
                '&.Mui-selected': {
                  bgcolor: 'success.main',
                  color: '#fff',
                  '&:hover': { bgcolor: 'success.dark' },
                },
              }}
            >
              CALL
            </ToggleButton>
            <ToggleButton
              value="PUT"
              sx={{
                '&.Mui-selected': {
                  bgcolor: 'error.main',
                  color: '#fff',
                  '&:hover': { bgcolor: 'error.dark' },
                },
              }}
            >
              PUT
            </ToggleButton>
          </ToggleButtonGroup>

          <TextField
            label="Strike Price"
            type="number"
            value={strike}
            onChange={(e) => setStrike(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            inputProps={{ step: '0.5' }}
          />

          <TextField
            label="Expiration Date"
            type="date"
            value={expiration}
            onChange={(e) => setExpiration(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Premium (per share)"
            type="number"
            value={premium}
            onChange={(e) => setPremium(e.target.value)}
            fullWidth
            sx={{ mb: 3 }}
            inputProps={{ step: '0.01' }}
          />

          <Button
            variant="contained"
            fullWidth
            onClick={handleNext}
            disabled={!canProceedStep1}
          >
            Continue
          </Button>
        </Box>
      </Collapse>

      {/* Step 2: Order Details */}
      <Collapse in={activeStep === 1} timeout={350} unmountOnExit>
        <Box sx={{ maxWidth: 440, mx: 'auto' }}>
          {/* Side toggle */}
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            SIDE
          </Typography>
          <ToggleButtonGroup
            value={side}
            exclusive
            onChange={(_e, v) => { if (v) setSide(v); }}
            fullWidth
            sx={{ mb: 3 }}
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

          {side === 'SELL' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Writing options: Covered calls require 100 shares per contract. Naked calls are not allowed.
            </Alert>
          )}

          <TextField
            label="Quantity (contracts)"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            inputProps={{ min: 1 }}
          />

          {Number(quantity) > 0 && Number(premium) > 0 && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'rgba(0,200,5,0.05)',
                border: '1px solid rgba(0,200,5,0.15)',
                mb: 2,
              }}
            >
              <Box display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Total Cost
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  ${fmt(totalCost)}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Breakeven
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  ${fmt(breakeven)}
                </Typography>
              </Box>
            </Box>
          )}

          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={handleBack} fullWidth>
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              fullWidth
              disabled={!canProceedStep2}
            >
              Review Order
            </Button>
          </Stack>
        </Box>
      </Collapse>

      {/* Step 3: Review & Confirm */}
      <Collapse in={activeStep === 2} timeout={350} unmountOnExit>
        <Box sx={{ maxWidth: 440, mx: 'auto' }}>
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
              border: '1px solid rgba(0,200,5,0.15)',
            }}
          >
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.1em' }}>
              OPTIONS ORDER SUMMARY
            </Typography>

            <Box display="flex" justifyContent="space-between" alignItems="center" mt={1.5} mb={1}>
              <Typography variant="h5" fontWeight={700}>
                {ticker.toUpperCase()}
              </Typography>
              <Typography
                variant="h6"
                fontWeight={700}
                color={side === 'BUY' ? 'success.main' : 'error.main'}
              >
                {side}
              </Typography>
            </Box>

            <Divider sx={{ borderColor: 'rgba(0,200,5,0.1)', mb: 2 }} />

            <Stack spacing={1.5}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Type</Typography>
                <Typography variant="body1" fontWeight={600}>{optionType}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Strike</Typography>
                <Typography variant="body1" fontWeight={600}>${fmt(Number(strike))}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Expiration</Typography>
                <Typography variant="body1" fontWeight={600}>{expiration}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Contracts</Typography>
                <Typography variant="body1" fontWeight={600}>{quantity}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Premium</Typography>
                <Typography variant="body1" fontWeight={600}>${fmt(Number(premium))}</Typography>
              </Box>
            </Stack>

            <Divider sx={{ borderColor: 'rgba(0,200,5,0.1)', my: 2 }} />

            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body1" color="text.secondary">Total Cost</Typography>
              <Typography variant="h5" fontWeight={700}>${fmt(totalCost)}</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">Breakeven</Typography>
              <Typography variant="body1" fontWeight={600}>${fmt(breakeven)}</Typography>
            </Box>
          </Paper>

          <Stack direction="row" spacing={2} mt={3}>
            <Button variant="outlined" onClick={handleBack} fullWidth>
              Edit
            </Button>
            <Button
              variant="contained"
              onClick={executeOrder}
              fullWidth
              disabled={submitting}
              color={side === 'BUY' ? 'primary' : 'error'}
            >
              {submitting ? 'Submitting...' : `Confirm ${side}`}
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
}

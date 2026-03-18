import { useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Typography,
  Box,
  Breadcrumbs,
  Link as MuiLink,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import useApi from '../../hooks/useApi';
import PageLoader from '../../components/ui/PageLoader';
import OptionsChain, { OptionChainEntry } from '../../components/trading/OptionsChain';
import OptionOrderForm from '../../components/trading/OptionOrderForm';
import OptionsPnLChart from '../../components/trading/OptionsPnLChart';
import AnimatedNumber from '../../components/trading/AnimatedNumber';

interface QuoteSummary {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
}

export default function OptionsChainPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const { data: quote, loading, error } = useApi<QuoteSummary>(
    ticker ? `/quotes/${ticker}` : null,
  );

  const [selectedOption, setSelectedOption] = useState<OptionChainEntry | null>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [selectedExpiration, setSelectedExpiration] = useState('');

  // Determine portfolioId from localStorage or default
  const portfolioId = Number(localStorage.getItem('lastPortfolioId')) || 1;

  const handleSelectOption = (entry: OptionChainEntry) => {
    setSelectedOption(entry);
    setOrderDialogOpen(true);
  };

  const handleOrderSuccess = () => {
    setOrderDialogOpen(false);
    setSelectedOption(null);
  };

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <>
        <MuiLink component={RouterLink} to="/market" underline="hover">
          &larr; Back to Market
        </MuiLink>
        <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
      </>
    );
  }

  if (!quote || !ticker) return null;

  const isPositive = quote.change >= 0;

  return (
    <>
      {/* Breadcrumbs */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
        <MuiLink component={RouterLink} to="/market" color="inherit" underline="hover">
          Market
        </MuiLink>
        <MuiLink component={RouterLink} to={`/stocks/${ticker}`} color="inherit" underline="hover">
          {ticker.toUpperCase()}
        </MuiLink>
        <Typography color="text.primary">Options</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={1}>
        <Typography variant="h4" fontWeight="bold">
          Options Chain — {ticker.toUpperCase()}
        </Typography>
      </Box>

      <Box display="flex" alignItems="baseline" gap={2} mb={3}>
        <AnimatedNumber
          value={quote.price}
          prefix="$"
          variant="h5"
          sx={{ fontFamily: '"Playfair Display", serif' }}
        />
        <Chip
          label={`${isPositive ? '+' : ''}${quote.change.toFixed(2)} (${isPositive ? '+' : ''}${quote.changePct.toFixed(2)}%)`}
          color={isPositive ? 'success' : 'error'}
          size="small"
        />
      </Box>

      {/* Options Chain */}
      <OptionsChain
        ticker={ticker}
        onSelectOption={handleSelectOption}
        selectedExpiration={selectedExpiration}
        onExpirationChange={setSelectedExpiration}
      />

      {/* Order Dialog */}
      <Dialog
        open={orderDialogOpen}
        onClose={() => setOrderDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Place Options Order</Typography>
            <IconButton onClick={() => setOrderDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedOption && (
            <Box>
              <OptionOrderForm
                portfolioId={portfolioId}
                ticker={ticker}
                prefilledOption={{
                  type: selectedOption.type,
                  strike: selectedOption.strike,
                  expiration: selectedOption.expiration,
                  premium: selectedOption.ask,
                }}
                onSuccess={handleOrderSuccess}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

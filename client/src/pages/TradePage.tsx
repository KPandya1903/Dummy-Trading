import { useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Typography,
  Box,
  Alert,
  Button,
  MenuItem,
  TextField,
  Stack,
} from '@mui/material';
import useApi from '../hooks/useApi';
import TradeForm from '../components/TradeForm';
import { useState } from 'react';
import PageLoader from '../components/ui/PageLoader';

interface Portfolio {
  id: number;
  name: string;
  startingCash: number;
}

export default function TradePage() {
  const [searchParams] = useSearchParams();
  const ticker = searchParams.get('ticker') || '';
  const side = (searchParams.get('side') as 'BUY' | 'SELL') || 'BUY';

  const { data: portfolios, loading, error } = useApi<Portfolio[]>('/portfolios');
  const [selectedId, setSelectedId] = useState<number | ''>('');

  if (loading) return <PageLoader />;

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!portfolios || portfolios.length === 0) {
    return (
      <>
        <Typography variant="h4" gutterBottom>
          Quick Trade
        </Typography>
        <Alert severity="info">
          You need a portfolio first.{' '}
          <Button component={RouterLink} to="/" size="small">
            Create one
          </Button>
        </Alert>
      </>
    );
  }

  const portfolioId = selectedId || portfolios[0].id;

  return (
    <>
      <Button component={RouterLink} to="/market" sx={{ mb: 1 }}>
        &larr; Back to Market
      </Button>

      <Typography variant="h4" gutterBottom>
        Quick Trade {ticker && `— ${ticker}`}
      </Typography>

      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <Typography variant="body2">Portfolio:</Typography>
        <TextField
          select
          size="small"
          value={portfolioId}
          onChange={(e) => setSelectedId(Number(e.target.value))}
          sx={{ minWidth: 200 }}
        >
          {portfolios.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <TradeForm
        portfolioId={portfolioId}
        onSuccess={() => {}}
        initialTicker={ticker}
        initialSide={side}
      />
    </>
  );
}

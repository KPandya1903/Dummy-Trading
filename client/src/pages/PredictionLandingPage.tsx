import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Paper,
  TextField,
  Autocomplete,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Alert,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PsychologyIcon from '@mui/icons-material/Psychology';
import BarChartIcon from '@mui/icons-material/BarChart';
import apiClient from '../apiClient';

interface SearchResult {
  ticker: string;
  name: string;
}

const POPULAR_STOCKS = [
  { ticker: 'AAPL', name: 'Apple Inc.' },
  { ticker: 'MSFT', name: 'Microsoft' },
  { ticker: 'GOOGL', name: 'Alphabet' },
  { ticker: 'AMZN', name: 'Amazon' },
  { ticker: 'NVDA', name: 'NVIDIA' },
  { ticker: 'TSLA', name: 'Tesla' },
  { ticker: 'META', name: 'Meta Platforms' },
  { ticker: 'JPM', name: 'JPMorgan Chase' },
];

const panelSx = {
  p: 3,
  background: 'linear-gradient(135deg, #111d31 0%, #162240 100%)',
  border: '1px solid rgba(201,168,76,0.1)',
};

const MODELS = [
  {
    icon: <TrendingUpIcon sx={{ fontSize: 40, color: '#c9a84c' }} />,
    title: 'Linear Regression',
    desc: 'Fits a trend line through recent prices to project the direction forward.',
  },
  {
    icon: <BarChartIcon sx={{ fontSize: 40, color: '#c9a84c' }} />,
    title: 'Moving Average',
    desc: 'Weighted blend of SMA-20 and EMA-12 with recent momentum adjustment.',
  },
  {
    icon: <PsychologyIcon sx={{ fontSize: 40, color: '#c9a84c' }} />,
    title: 'LSTM Neural Network',
    desc: 'Deep learning model trained on 60-day price windows with confidence bands.',
  },
];

export default function PredictionLandingPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (searchQuery.length < 1) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await apiClient.get('/search', { params: { q: searchQuery } });
        setOptions(data.slice(0, 10));
      } catch {
        setOptions([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Price Prediction
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Select a stock to see ML-powered price forecasts using three different prediction models.
      </Typography>

      <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 3 }}>
        Predictions are for educational purposes only. They do not constitute financial advice.
      </Alert>

      {/* Search */}
      <Paper variant="outlined" sx={{ ...panelSx, mb: 4 }}>
        <Autocomplete
          freeSolo
          options={options}
          getOptionLabel={(opt) =>
            typeof opt === 'string' ? opt : `${opt.ticker} — ${opt.name}`
          }
          onInputChange={(_e, value) => setSearchQuery(value)}
          onChange={(_e, value) => {
            if (value && typeof value !== 'string') {
              navigate(`/predict/${value.ticker}`);
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search for a stock ticker..."
              variant="outlined"
              fullWidth
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  navigate(`/predict/${searchQuery.trim().toUpperCase()}`);
                }
              }}
            />
          )}
        />
      </Paper>

      {/* Model cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {MODELS.map((m) => (
          <Grid item xs={12} md={4} key={m.title}>
            <Paper variant="outlined" sx={{ ...panelSx, textAlign: 'center', height: '100%' }}>
              {m.icon}
              <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
                {m.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {m.desc}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Popular Stocks */}
      <Typography variant="h6" gutterBottom fontWeight={600}>
        Popular Stocks
      </Typography>
      <Grid container spacing={2}>
        {POPULAR_STOCKS.map((s) => (
          <Grid item xs={6} sm={3} key={s.ticker}>
            <Card sx={{ ...panelSx }}>
              <CardActionArea onClick={() => navigate(`/predict/${s.ticker}`)}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h6" fontWeight={700} color="primary.main">
                    {s.ticker}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {s.name}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}

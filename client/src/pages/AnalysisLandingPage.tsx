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
} from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart';
import TimelineIcon from '@mui/icons-material/Timeline';
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

const FEATURES = [
  {
    icon: <ShowChartIcon sx={{ fontSize: 40, color: '#c9a84c' }} />,
    title: 'RSI & MACD',
    desc: 'Momentum oscillators and trend-following indicators to gauge overbought/oversold conditions.',
  },
  {
    icon: <CandlestickChartIcon sx={{ fontSize: 40, color: '#c9a84c' }} />,
    title: 'Bollinger Bands',
    desc: 'Volatility bands around a moving average to identify price breakouts and squeezes.',
  },
  {
    icon: <TimelineIcon sx={{ fontSize: 40, color: '#c9a84c' }} />,
    title: 'SMA & EMA',
    desc: 'Simple and exponential moving averages (20, 50, 200-day) to spot trend direction and crossovers.',
  },
];

export default function AnalysisLandingPage() {
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
        Technical Analysis
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Select a stock to view RSI, MACD, Bollinger Bands, SMA, and EMA indicators with AI-powered insights.
      </Typography>

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
              navigate(`/stocks/${value.ticker}/analysis`);
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
                  navigate(`/stocks/${searchQuery.trim().toUpperCase()}/analysis`);
                }
              }}
            />
          )}
        />
      </Paper>

      {/* Features */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {FEATURES.map((f) => (
          <Grid item xs={12} md={4} key={f.title}>
            <Paper variant="outlined" sx={{ ...panelSx, textAlign: 'center', height: '100%' }}>
              {f.icon}
              <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
                {f.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {f.desc}
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
              <CardActionArea onClick={() => navigate(`/stocks/${s.ticker}/analysis`)}>
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

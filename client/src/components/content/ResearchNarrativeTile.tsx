import { Card, CardActionArea, CardContent, Typography, Chip, Box } from '@mui/material';
import {
  TrendingUp as EarningsIcon,
  RocketLaunch as LaunchIcon,
  DonutLarge as SectorIcon,
  AccountBalance as MacroIcon,
  Groups as CompetitiveIcon,
  LocalShipping as SupplyIcon,
  Gavel as RegulatoryIcon,
  Forum as SocialIcon,
  Assessment as AnalystIcon,
  Public as GeoIcon,
} from '@mui/icons-material';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

const DIMENSION_ICONS: Record<string, React.ReactNode> = {
  earnings: <EarningsIcon sx={{ fontSize: 28, color: '#00C805' }} />,
  product_launches: <LaunchIcon sx={{ fontSize: 28, color: '#00C805' }} />,
  sector_trends: <SectorIcon sx={{ fontSize: 28, color: '#00C805' }} />,
  macro_factors: <MacroIcon sx={{ fontSize: 28, color: '#00C805' }} />,
  competitive_landscape: <CompetitiveIcon sx={{ fontSize: 28, color: '#00C805' }} />,
  supply_chain: <SupplyIcon sx={{ fontSize: 28, color: '#00C805' }} />,
  regulatory: <RegulatoryIcon sx={{ fontSize: 28, color: '#00C805' }} />,
  social_sentiment: <SocialIcon sx={{ fontSize: 28, color: '#00C805' }} />,
  analyst_ratings: <AnalystIcon sx={{ fontSize: 28, color: '#00C805' }} />,
  geopolitical: <GeoIcon sx={{ fontSize: 28, color: '#00C805' }} />,
};

const SENTIMENT_COLORS: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  positive: 'success',
  negative: 'error',
  mixed: 'warning',
  neutral: 'default',
};

interface NarrativeTileProps {
  narrative: {
    id: number;
    dimension: string;
    title: string;
    subtitle: string | null;
    sentiment: string;
    priceChangePct: number | null;
    priceWindow: { date: string; close: number }[];
    summary: string;
  };
  onClick: () => void;
}

export default function ResearchNarrativeTile({ narrative, onClick }: NarrativeTileProps) {
  const icon = DIMENSION_ICONS[narrative.dimension] || <EarningsIcon sx={{ fontSize: 28, color: '#00C805' }} />;
  const sparkColor = (narrative.priceChangePct ?? 0) >= 0 ? '#00C805' : '#ff5252';

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)',
        border: '1px solid rgba(0,200,5,0.1)',
        height: '100%',
        transition: 'border-color 0.2s, transform 0.2s',
        '&:hover': {
          borderColor: 'rgba(0,200,5,0.4)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
        <CardContent sx={{ p: 2 }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            {icon}
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              {narrative.dimension.replace(/_/g, ' ')}
            </Typography>
          </Box>

          <Typography variant="subtitle2" fontWeight={700} color="primary.main" gutterBottom noWrap>
            {narrative.title}
          </Typography>

          {narrative.subtitle && (
            <Typography variant="caption" color="text.secondary" display="block" mb={1} sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}>
              {narrative.subtitle}
            </Typography>
          )}

          {/* Mini sparkline chart */}
          {narrative.priceWindow.length > 2 && (
            <Box sx={{ height: 50, mb: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={narrative.priceWindow}>
                  <Line
                    type="monotone"
                    dataKey="close"
                    stroke={sparkColor}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          )}

          <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
            {narrative.priceChangePct !== null && (
              <Chip
                label={`${narrative.priceChangePct >= 0 ? '+' : ''}${narrative.priceChangePct.toFixed(1)}%`}
                size="small"
                color={narrative.priceChangePct >= 0 ? 'success' : 'error'}
                sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
              />
            )}
            <Chip
              label={narrative.sentiment}
              size="small"
              color={SENTIMENT_COLORS[narrative.sentiment] || 'default'}
              variant="outlined"
              sx={{ height: 20, fontSize: 11 }}
            />
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

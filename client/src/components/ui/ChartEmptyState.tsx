import { Box, Typography } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';

interface ChartEmptyStateProps {
  message?: string;
  height?: number;
}

export default function ChartEmptyState({
  message = 'No data available',
  height = 200,
}: ChartEmptyStateProps) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height={height}
      gap={1}
    >
      <ShowChartIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
      <Typography variant="body2" color="text.disabled">
        {message}
      </Typography>
    </Box>
  );
}

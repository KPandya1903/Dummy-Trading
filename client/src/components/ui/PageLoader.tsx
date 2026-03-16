import { Box, Skeleton, Grid } from '@mui/material';

interface PageLoaderProps {
  variant?: 'default' | 'table' | 'chart' | 'cards';
}

export default function PageLoader({ variant = 'default' }: PageLoaderProps) {
  if (variant === 'table') {
    return (
      <Box>
        <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 2, mb: 1 }} />
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={52} sx={{ borderRadius: 1, mb: 0.5 }} />
        ))}
      </Box>
    );
  }

  if (variant === 'chart') {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" mb={1}>
          <Skeleton variant="rectangular" width={180} height={32} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rectangular" width={100} height={32} sx={{ borderRadius: 1 }} />
        </Box>
        <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  if (variant === 'cards') {
    return (
      <Grid container spacing={2}>
        {[...Array(6)].map((_, i) => (
          <Grid item xs={12} sm={6} md={4} key={i}>
            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  // default
  return (
    <Box>
      <Grid container spacing={3} mb={2}>
        <Grid item xs={12} md={5}>
          <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
        </Grid>
        <Grid item xs={12} md={7}>
          <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
        </Grid>
      </Grid>
      <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2, mb: 2 }} />
      <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
    </Box>
  );
}

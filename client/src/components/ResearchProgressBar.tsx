import { Box, LinearProgress, Typography } from '@mui/material';

interface ResearchProgressBarProps {
  progress: number;
  currentStep: string;
}

export default function ResearchProgressBar({ progress, currentStep }: ResearchProgressBarProps) {
  return (
    <Box sx={{ width: '100%', mb: 3 }}>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 8,
          borderRadius: 4,
          backgroundColor: 'rgba(0,200,5,0.1)',
          '& .MuiLinearProgress-bar': {
            backgroundColor: '#00C805',
            borderRadius: 4,
            transition: 'transform 0.8s ease',
          },
        }}
      />
      <Box display="flex" justifyContent="space-between" mt={0.5}>
        <Typography variant="caption" color="text.secondary">
          {currentStep}
        </Typography>
        <Typography variant="caption" color="primary.main" fontWeight={600}>
          {progress}%
        </Typography>
      </Box>
    </Box>
  );
}

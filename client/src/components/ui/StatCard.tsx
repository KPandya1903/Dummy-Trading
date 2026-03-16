import { Paper, Typography, Tooltip, Box } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

interface StatCardProps {
  label: string;
  value: string;
  valueColor?: string;
  tooltip?: string;
}

export default function StatCard({ label, value, valueColor, tooltip }: StatCardProps) {
  return (
    <Paper
      component="dl"
      variant="outlined"
      sx={{
        p: 2.5,
        textAlign: 'center',
        background: 'linear-gradient(135deg, #111d31 0%, #162240 100%)',
        border: '1px solid rgba(201,168,76,0.1)',
        m: 0,
      }}
    >
      <Box component="dt" display="flex" alignItems="center" justifyContent="center" gap={0.5} mb={0.5}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        {tooltip && (
          <Tooltip title={tooltip} arrow>
            <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled', cursor: 'help' }} />
          </Tooltip>
        )}
      </Box>
      <Typography component="dd" variant="body1" fontWeight="bold" color={valueColor} sx={{ m: 0 }}>
        {value}
      </Typography>
    </Paper>
  );
}

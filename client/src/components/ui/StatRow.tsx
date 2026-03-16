import { Box, Typography, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

interface StatRowProps {
  label: string;
  value: string;
  valueColor?: string;
  tooltip?: string;
  /** 'row' = label left, value right (default). 'stack' = label on top, value below. */
  layout?: 'row' | 'stack';
}

export default function StatRow({ label, value, valueColor, tooltip, layout = 'row' }: StatRowProps) {
  if (layout === 'stack') {
    return (
      <Box>
        <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          {tooltip && (
            <Tooltip title={tooltip} arrow>
              <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled', cursor: 'help' }} />
            </Tooltip>
          )}
        </Box>
        <Typography variant="body1" fontWeight={600} color={valueColor}>
          {value}
        </Typography>
      </Box>
    );
  }

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" py={1}>
      <Box display="flex" alignItems="center" gap={0.5}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        {tooltip && (
          <Tooltip title={tooltip} arrow>
            <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
          </Tooltip>
        )}
      </Box>
      <Typography variant="body1" fontWeight={600} color={valueColor}>
        {value}
      </Typography>
    </Box>
  );
}

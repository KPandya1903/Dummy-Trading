import { Box, Paper, IconButton, Collapse } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { SxProps } from '@mui/material';
import type { ReactNode } from 'react';
import SectionHeader from './SectionHeader';

interface CollapsiblePanelProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  sx?: SxProps;
}

const panelSx = {
  p: 4,
  background: 'linear-gradient(135deg, #111d31 0%, #162240 100%)',
  border: '1px solid rgba(201,168,76,0.1)',
  height: 'auto',
};

export default function CollapsiblePanel({
  title,
  expanded,
  onToggle,
  children,
  sx,
}: CollapsiblePanelProps) {
  return (
    <Paper variant="outlined" sx={{ ...panelSx, ...sx }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <SectionHeader mb={0}>{title}</SectionHeader>
        <IconButton
          size="small"
          onClick={onToggle}
          aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
          aria-expanded={expanded}
        >
          <ExpandMoreIcon
            sx={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease',
              color: 'text.secondary',
            }}
          />
        </IconButton>
      </Box>
      <Collapse in={expanded} timeout={350}>
        <Box sx={{ mt: 2 }}>{children}</Box>
      </Collapse>
    </Paper>
  );
}

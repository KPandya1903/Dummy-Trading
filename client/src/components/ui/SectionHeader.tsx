import { Typography } from '@mui/material';
import type { SxProps } from '@mui/material';
import type { ReactNode } from 'react';

interface SectionHeaderProps {
  children: ReactNode;
  mb?: number;
  sx?: SxProps;
}

export default function SectionHeader({ children, mb = 3, sx }: SectionHeaderProps) {
  return (
    <Typography
      sx={{
        fontWeight: 700,
        fontSize: '0.75rem',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'text.secondary',
        mb,
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
}

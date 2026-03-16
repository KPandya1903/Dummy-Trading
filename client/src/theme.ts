import { createTheme } from '@mui/material/styles';

// ── Chart & Heatmap color constants ─────────────────────────
export const CHART_COLORS = [
  '#00C805', '#3d8ef7', '#ff5252', '#ab47bc',
  '#26c6da', '#ff7043', '#66bb6a', '#42a5f5', '#ffa726',
  '#8d6e63',
];

export const HEATMAP_COLORS = {
  green: ['#003d02', '#005904', '#007a06', '#009e08', '#00C805'],
  red: ['#8c2020', '#a82c2c', '#c43838', '#e04545', '#ff5252'],
};

// ── Shared palette values ───────────────────────────────────
const green = {
  main: '#00C805',
  dark: '#009e04',
  light: '#33d338',
  contrastText: '#000000',
};

const surface = {
  default: '#0a0a0a',
  paper: '#111111',
  elevated: '#1a1a1a',
  appBar: '#0a0a0a',
  ticker: '#0d0d0d',
};

const dividerColor = '#1e1e1e';
const borderSubtle = '#1e1e1e';

// ── Theme ───────────────────────────────────────────────────
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: green,
    secondary: { main: '#3d8ef7' },
    success: { main: '#00C805' },
    error: { main: '#ff5252' },
    warning: { main: '#f5a623' },
    background: {
      default: surface.default,
      paper: surface.paper,
    },
    text: {
      primary: '#ffffff',
      secondary: '#8a8a8a',
    },
    divider: dividerColor,
  },

  typography: {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    h4: { fontWeight: 700, letterSpacing: '-0.5px' },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
    body2: { letterSpacing: '0.01em' },
    caption: { letterSpacing: '0.02em' },
  },

  shape: { borderRadius: 8 },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: surface.default,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      },
    },

    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: surface.appBar,
          borderBottom: `1px solid ${borderSubtle}`,
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: surface.default,
          borderRight: `1px solid ${borderSubtle}`,
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${borderSubtle}`,
        },
        outlined: {
          borderColor: borderSubtle,
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: surface.paper,
          border: `1px solid ${borderSubtle}`,
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          color: '#000000',
          fontWeight: 600,
          '&:hover': {
            backgroundColor: green.dark,
          },
        },
        outlinedPrimary: {
          borderColor: green.main,
          '&:hover': {
            borderColor: green.light,
            backgroundColor: 'rgba(0,200,5,0.08)',
          },
        },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          '&.Mui-selected': {
            color: green.main,
            backgroundColor: 'rgba(0,200,5,0.08)',
            '& .MuiListItemIcon-root': { color: green.main },
            '&:hover': { backgroundColor: 'rgba(0,200,5,0.12)' },
          },
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.04)',
          },
        },
      },
    },

    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: surface.paper,
            color: '#555',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            fontSize: '0.7rem',
            letterSpacing: '0.07em',
          },
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: `rgba(255,255,255,0.02) !important`,
          },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#141414',
          paddingTop: 11,
          paddingBottom: 11,
        },
        sizeSmall: {
          paddingTop: 9,
          paddingBottom: 9,
        },
      },
    },

    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: surface.elevated,
          border: `1px solid ${borderSubtle}`,
        },
      },
    },

    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.04)',
          },
        },
      },
    },

    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '20px',
          '&:last-child': {
            paddingBottom: '20px',
          },
        },
      },
    },

    MuiStepIcon: {
      styleOverrides: {
        root: {
          color: 'rgba(0,200,5,0.2)',
          '&.Mui-active': { color: green.main },
          '&.Mui-completed': { color: green.main },
        },
      },
    },

    MuiStepLabel: {
      styleOverrides: {
        label: {
          color: '#8a8a8a',
          '&.Mui-active': { color: '#ffffff' },
          '&.Mui-completed': { color: green.main },
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#222222',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#333333',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: green.main,
          },
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: surface.elevated,
          border: `1px solid ${borderSubtle}`,
        },
      },
    },

    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: surface.elevated,
          border: `1px solid ${borderSubtle}`,
        },
      },
    },

    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: surface.elevated,
          border: `1px solid ${borderSubtle}`,
        },
      },
    },

    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: '#8a8a8a',
          borderColor: '#222',
          '&.Mui-selected': {
            color: green.main,
            backgroundColor: 'rgba(0,200,5,0.08)',
            borderColor: green.main,
            '&:hover': {
              backgroundColor: 'rgba(0,200,5,0.12)',
            },
          },
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          border: `1px solid ${borderSubtle}`,
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: borderSubtle,
        },
      },
    },
  },
});

// ── Reusable recharts tooltip style ─────────────────────────
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: surface.elevated,
  border: `1px solid ${borderSubtle}`,
  borderRadius: 8,
};

export const CHART_GRID_COLOR = 'rgba(255,255,255,0.04)';
export const CHART_AXIS_COLOR = '#555555';

// ── Gain/loss chart line color utility ──────────────────────
export function getChartLineColor(startValue: number, endValue: number): string {
  if (endValue > startValue) return '#00C805';
  if (endValue < startValue) return '#ff5252';
  return '#00C805';
}

export default theme;

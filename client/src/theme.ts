import { createTheme } from '@mui/material/styles';

// ── Chart & Heatmap color constants ─────────────────────────
export const CHART_COLORS = [
  '#c9a84c', '#3d8ef7', '#00c853', '#ff5252', '#ab47bc',
  '#26c6da', '#ff7043', '#66bb6a', '#42a5f5', '#ffa726',
  '#8d6e63',
];

export const HEATMAP_COLORS = {
  green: ['#004d1c', '#006d29', '#008a36', '#00a844', '#00c853'],
  red: ['#8c2020', '#a82c2c', '#c43838', '#e04545', '#ff5252'],
};

// ── Shared palette values ───────────────────────────────────
const gold = {
  main: '#c9a84c',
  dark: '#a88a3a',
  light: '#dfc06a',
};

const surface = {
  default: '#0b1426',
  paper: '#111d31',
  elevated: '#162240',
  appBar: '#0d1a2d',
  ticker: '#060e1a',
};

const dividerColor = 'rgba(201,168,76,0.12)';
const borderSubtle = 'rgba(201,168,76,0.08)';

// ── Theme ───────────────────────────────────────────────────
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: gold,
    secondary: { main: '#3d8ef7' },
    success: { main: '#00c853' },
    error: { main: '#ff5252' },
    warning: { main: '#ffab00' },
    background: {
      default: surface.default,
      paper: surface.paper,
    },
    text: {
      primary: '#e8eaf0',
      secondary: '#7a8ba5',
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
          borderBottom: `1px solid rgba(201,168,76,0.15)`,
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
          border: `1px solid ${borderSubtle}`,
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          color: '#0b1426',
          fontWeight: 600,
          '&:hover': {
            backgroundColor: gold.dark,
          },
        },
        outlinedPrimary: {
          borderColor: gold.main,
          '&:hover': {
            borderColor: gold.light,
            backgroundColor: 'rgba(201,168,76,0.08)',
          },
        },
      },
    },

    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: surface.appBar,
            color: '#7a8ba5',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
          },
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: `${surface.elevated} !important`,
          },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: dividerColor,
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(201,168,76,0.15)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(201,168,76,0.3)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: gold.main,
          },
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: surface.paper,
          border: `1px solid ${borderSubtle}`,
        },
      },
    },

    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: surface.paper,
          border: `1px solid ${borderSubtle}`,
        },
      },
    },

    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: surface.paper,
          border: `1px solid ${borderSubtle}`,
        },
      },
    },

    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: '#7a8ba5',
          borderColor: 'rgba(201,168,76,0.15)',
          '&.Mui-selected': {
            color: gold.main,
            backgroundColor: 'rgba(201,168,76,0.1)',
            borderColor: gold.main,
            '&:hover': {
              backgroundColor: 'rgba(201,168,76,0.15)',
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
  },
});

// ── Reusable recharts tooltip style ─────────────────────────
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: surface.paper,
  border: '1px solid rgba(201,168,76,0.15)',
  borderRadius: 8,
};

export const CHART_GRID_COLOR = 'rgba(255,255,255,0.06)';
export const CHART_AXIS_COLOR = '#7a8ba5';

export default theme;

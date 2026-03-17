import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline, GlobalStyles } from '@mui/material';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import theme from './theme';
import App from './App';
import { ToastProvider } from './context/ToastContext';
import { GoogleOAuthProvider } from '@react-oauth/google';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <GlobalStyles styles={{
            '@keyframes flash-up':   { from: { backgroundColor: 'rgba(0,200,5,0.15)' },   to: { backgroundColor: 'transparent' } },
            '@keyframes flash-down': { from: { backgroundColor: 'rgba(255,77,77,0.15)' }, to: { backgroundColor: 'transparent' } },
            'tr.flash-up':   { animation: 'flash-up   0.6s ease-out forwards' },
            'tr.flash-down': { animation: 'flash-down 0.6s ease-out forwards' },
          }} />
          <ToastProvider>
            <App />
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>,
);

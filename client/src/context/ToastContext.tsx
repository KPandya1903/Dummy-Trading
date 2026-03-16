import { createContext, useContext, useState } from 'react';
import { Snackbar, Alert } from '@mui/material';

type Severity = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  message: string;
  severity: Severity;
}

interface ToastContextValue {
  showToast: (message: string, severity?: Severity) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (message: string, severity: Severity = 'success') => {
    setToast({ message, severity });
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast(null)}
          severity={toast?.severity ?? 'info'}
          variant="filled"
          sx={{ minWidth: 300 }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

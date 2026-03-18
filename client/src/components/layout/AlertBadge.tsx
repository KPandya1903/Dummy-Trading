import { useState } from 'react';
import {
  Badge,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemText,
  Typography,
  Button,
  Box,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import useApi from '../../hooks/useApi';
import apiClient from '../../apiClient';

interface TriggeredAlert {
  id: number;
  ticker: string;
  alertAbove: number | null;
  alertBelow: number | null;
}

export default function AlertBadge() {
  const { data: alerts, refetch } = useApi<TriggeredAlert[]>('/alerts', undefined, 30_000);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const count = alerts?.length ?? 0;

  const dismiss = async (id: number) => {
    try {
      await apiClient.post(`/alerts/${id}/dismiss`);
      refetch();
    } catch { /* ignore */ }
  };

  return (
    <>
      <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}>
        <Badge badgeContent={count} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ width: 300, maxHeight: 400, overflow: 'auto' }}>
          {count === 0 ? (
            <Typography variant="body2" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
              No alerts triggered
            </Typography>
          ) : (
            <List dense>
              {alerts?.map((a) => (
                <ListItem
                  key={a.id}
                  secondaryAction={
                    <Button size="small" onClick={() => dismiss(a.id)}>
                      Dismiss
                    </Button>
                  }
                >
                  <ListItemText
                    primary={a.ticker}
                    secondary={
                      a.alertAbove
                        ? `Price rose above $${a.alertAbove.toFixed(2)}`
                        : a.alertBelow
                          ? `Price fell below $${a.alertBelow.toFixed(2)}`
                          : 'Alert triggered'
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Popover>
    </>
  );
}

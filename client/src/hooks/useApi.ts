import { useEffect, useState, useCallback, useRef } from 'react';
import apiClient from '../apiClient';

/**
 * Lightweight data-fetching hook.
 * Returns { data, loading, error, refetch }.
 *
 * `url`    — the API path (relative to /api)
 * `params` — optional query params object
 *
 * Refetch on url/params change, or call refetch() manually after mutations.
 */
export default function useApi<T>(
  url: string | null,
  params?: Record<string, unknown>,
  pollInterval?: number,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasData = useRef(false);

  const serializedParams = params ? JSON.stringify(params) : '';

  const fetch = useCallback(async () => {
    if (!url) return;
    setLoading((prev) => hasData.current ? prev : true);
    setError('');
    try {
      const parsed = serializedParams ? JSON.parse(serializedParams) : undefined;
      const { data: result } = await apiClient.get(url, { params: parsed });
      setData(result);
      hasData.current = true;
    } catch (err: any) {
      // Only set error if we have no existing data (don't blank out stale data on poll failure)
      if (!hasData.current) {
        setError(err.response?.data?.error || 'Request failed');
      }
    } finally {
      setLoading(false);
    }
  }, [url, serializedParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Optional polling
  useEffect(() => {
    if (!pollInterval || !url) return;
    const id = setInterval(fetch, pollInterval);
    return () => clearInterval(id);
  }, [fetch, pollInterval, url]);

  return { data, loading, error, refetch: fetch };
}

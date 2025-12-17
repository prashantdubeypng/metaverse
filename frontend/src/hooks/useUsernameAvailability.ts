import { useState, useEffect, useCallback, useRef } from 'react';

interface UsernameCheckResult {
  available: boolean | null;
  checking: boolean;
  error: string | null;
  checkedWithDb: boolean;
}

/**
 * Custom hook for real-time username availability checking
 * Uses debouncing to avoid excessive API calls
 */
export function useUsernameAvailability(username: string, debounceMs: number = 500) {
  const [result, setResult] = useState<UsernameCheckResult>({
    available: null,
    checking: false,
    error: null,
    checkedWithDb: false
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const checkUsername = useCallback(async (usernameToCheck: string) => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Don't check if username is too short
    if (!usernameToCheck || usernameToCheck.length < 3) {
      setResult({
        available: null,
        checking: false,
        error: usernameToCheck.length > 0 ? 'Username must be at least 3 characters' : null,
        checkedWithDb: false
      });
      return;
    }

    setResult(prev => ({ ...prev, checking: true, error: null }));

    try {
      abortControllerRef.current = new AbortController();
      
      const response = await fetch(
        `http://localhost:8000/api/v1/auth/check-username/${encodeURIComponent(usernameToCheck)}`,
        { signal: abortControllerRef.current.signal }
      );

      if (!response.ok) {
        throw new Error('Failed to check username availability');
      }

      const data = await response.json();
      
      setResult({
        available: data.available,
        checking: false,
        error: null,
        checkedWithDb: data.checkedWithDb
      });
    } catch (error: unknown) {
      const err = error as { name?: string };
      if (err.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      
      setResult({
        available: null,
        checking: false,
        error: 'Failed to check username availability',
        checkedWithDb: false
      });
    }
  }, []);

  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for debounced check
    debounceTimerRef.current = setTimeout(() => {
      checkUsername(username);
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [username, debounceMs, checkUsername]);

  return result;
}

import { useState, useCallback, useRef, useEffect } from 'react';

export type AsyncFeedbackStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseAsyncActionFeedbackOptions {
  /** Message shown on success (for UI). */
  successMessage?: string;
  /** Message shown on error when none from throw. */
  errorMessage?: string;
  /** Auto-reset success back to idle after this many ms. Default 3000. */
  successResetMs?: number;
}

export interface UseAsyncActionFeedbackResult {
  status: AsyncFeedbackStatus;
  message: string | null;
  loading: boolean;
  success: boolean;
  error: string | null;
  run: <T>(asyncFn: () => Promise<T>) => Promise<T | undefined>;
  reset: () => void;
}

export function useAsyncActionFeedback(
  options: UseAsyncActionFeedbackOptions = {}
): UseAsyncActionFeedbackResult {
  const {
    successMessage = 'Guardado',
    errorMessage = 'Error al guardar',
    successResetMs = 3000,
  } = options;

  const [status, setStatus] = useState<AsyncFeedbackStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    setStatus('idle');
    setMessage(null);
  }, []);

  const run = useCallback(
    async <T,>(asyncFn: () => Promise<T>): Promise<T | undefined> => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
      setStatus('loading');
      setMessage(null);
      try {
        const result = await asyncFn();
        setStatus('success');
        setMessage(successMessage);
        if (successResetMs > 0) {
          successTimeoutRef.current = setTimeout(() => {
            successTimeoutRef.current = null;
            setStatus((s) => (s === 'success' ? 'idle' : s));
            setMessage(null);
          }, successResetMs);
        }
        return result;
      } catch (err: any) {
        const msg = err?.message || err?.error || errorMessage;
        setStatus('error');
        setMessage(msg);
        return undefined;
      }
    },
    [successMessage, errorMessage, successResetMs]
  );

  return {
    status,
    message,
    loading: status === 'loading',
    success: status === 'success',
    error: status === 'error' ? message : null,
    run,
    reset,
  };
}

type FetchWithTimeoutOptions = {
  timeoutMs?: number;
  retries?: number;
  retryOnStatuses?: number[];
};

const DEFAULT_RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504];

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: FetchWithTimeoutOptions
): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? 12000;
  const retries = options?.retries ?? 1;
  const retryOnStatuses = options?.retryOnStatuses ?? DEFAULT_RETRY_STATUSES;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const externalSignal = init?.signal;
    let removeExternalAbortListener: (() => void) | null = null;

    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timer);
        throw new Error('Fetch aborted');
      }
      const onExternalAbort = () => controller.abort();
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      removeExternalAbortListener = () =>
        externalSignal.removeEventListener('abort', onExternalAbort);
    }

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timer);
      removeExternalAbortListener?.();

      if (retryOnStatuses.includes(response.status) && attempt < retries) {
        continue;
      }
      return response;
    } catch (error) {
      clearTimeout(timer);
      removeExternalAbortListener?.();
      lastError = error;
      if (attempt >= retries) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Fetch failed');
}

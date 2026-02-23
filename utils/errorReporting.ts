type ErrorContext = Record<string, unknown>;

const toError = (value: unknown): Error => {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value : 'Unknown error');
};

export const reportError = (errorLike: unknown, context?: ErrorContext) => {
  const error = toError(errorLike);
  const payload = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    context: context || {},
    timestamp: new Date().toISOString(),
  };

  // Keep this lightweight for now. We can later pipe it to Sentry or another backend.
  console.error('[app-error]', payload);
};

export const installGlobalErrorHandler = () => {
  const maybeErrorUtils = (globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
      setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
    };
  }).ErrorUtils;

  if (!maybeErrorUtils?.setGlobalHandler) return;

  const defaultHandler = maybeErrorUtils.getGlobalHandler?.();
  maybeErrorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, { isFatal: !!isFatal, scope: 'global_handler' });
    if (defaultHandler) defaultHandler(error, isFatal);
  });
};

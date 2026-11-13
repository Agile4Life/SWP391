/**
 * Id for one user action that writes data. Resend the same id when retrying that action after a network error so
 * the server can recognise the retry and not apply the action twice.
 */
export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

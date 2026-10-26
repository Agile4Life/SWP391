import { z } from 'zod';

const KEY = 'scms_pending_registration';
const pendingSchema = z.object({
  username: z.string().min(3), email: z.string().email(),
  createdAt: z.number().finite(), resendAt: z.number().finite(),
});
export type PendingRegistration = z.infer<typeof pendingSchema>;

export function readPendingRegistration(): PendingRegistration | null {
  try {
    const parsed = pendingSchema.safeParse(JSON.parse(sessionStorage.getItem(KEY) || 'null'));
    if (parsed.success && parsed.data.createdAt <= Date.now() && Date.now() - parsed.data.createdAt < 86_400_000) return parsed.data;
    sessionStorage.removeItem(KEY);
  } catch { /* Verification still works when browser storage is unavailable. */ }
  return null;
}

export function savePendingRegistration(value: PendingRegistration | null) {
  try {
    if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
    else sessionStorage.removeItem(KEY);
  } catch { /* The current screen keeps its in-memory state. */ }
}

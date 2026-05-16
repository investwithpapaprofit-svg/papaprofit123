import { UserProfile } from '../types';

export function sanitizeProfileForWrite(profile: any, currentTrustedState: Partial<UserProfile> | null): Partial<UserProfile> {
  const sanitized = { ...profile };

  // Strip protected fields entirely from the incoming untrusted payload
  delete sanitized.isPremium;
  delete sanitized.role;
  delete sanitized.adminFields; // anything else?

  // Restore protected fields solely from the server's trusted state if available
  if (currentTrustedState) {
    if (currentTrustedState.isPremium !== undefined) {
      sanitized.isPremium = currentTrustedState.isPremium;
    }
    if (currentTrustedState.role !== undefined) {
      sanitized.role = currentTrustedState.role;
    }
  }

  return sanitized;
}

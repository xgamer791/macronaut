export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  image?: string;
  provider?: 'google' | 'apple' | 'email';
}

/** Human-readable display name for a user, falling back to the email local
 * part. Provider metadata is user-controlled, so treat it as untrusted text. */
export function displayNameFromUser(user: AuthUser | null | undefined): string | undefined {
  if (!user) return undefined;
  const name = user.name?.trim();
  if (name) return name.slice(0, 60);
  const local = user.email?.split('@')[0];
  if (!local) return undefined;
  return (local.charAt(0).toUpperCase() + local.slice(1)).slice(0, 60);
}

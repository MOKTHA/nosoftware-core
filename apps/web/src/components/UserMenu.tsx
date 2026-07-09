'use client';

/**
 * UserMenu — header widget that shows the current user's avatar/name
 * with a sign-out button, or a "Sign in" link when unauthenticated.
 *
 * Server side reads the session via `auth()` in the root layout and
 * passes the user into this component. Keeping the sign-out action
 * client-side (via `next-auth/react`'s `signOut`) avoids a custom
 * sign-out route in Phase 1 — Auth.js ships `/api/auth/signout`
 * ready-made.
 *
 * Styling stays inline and minimal — matches the root layout header
 * which this sits inside. When a design system arrives (Phase 6+) this
 * component will get real theming via shared UI primitives.
 *
 * See docs/adr/0008-auth-library-and-provider.md for background.
 */
import { signOut } from 'next-auth/react';

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type UserMenuProps = {
  user: SessionUser | null;
};

/**
 * Two-letter initials from a display name, falling back to the first
 * letter of the email. Used when the user has no avatar URL.
 */
function initialsFor(user: SessionUser): string {
  const fromName = user.name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
  if (fromName && fromName.length >= 1) return fromName;
  if (user.email && user.email.length > 0) {
    return (user.email[0] ?? '?').toUpperCase();
  }
  return '?';
}

function handleSignOut(): void {
  // `callbackUrl: '/'` returns the user to the landing page after
  // Auth.js clears the session cookie. Matches the middleware's
  // public-route allowlist so the post-sign-out landing works without
  // a redirect loop.
  void signOut({ callbackUrl: '/' });
}

export function UserMenu({ user }: UserMenuProps) {
  if (!user) {
    return (
      <a
        href="/api/auth/signin"
        style={{
          color: '#0070f3',
          textDecoration: 'none',
          fontWeight: 500,
        }}
      >
        Sign in
      </a>
    );
  }

  const displayName = user.name ?? user.email ?? 'User';
  const initials = initialsFor(user);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.875rem',
      }}
    >
      {user.image ? (
        <img
          src={user.image}
          alt={displayName}
          width={28}
          height={28}
          style={{
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <span
          aria-label={`Avatar for ${displayName}`}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#eaeaea',
            color: '#111',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        >
          {initials}
        </span>
      )}
      <span style={{ fontWeight: 500 }}>{displayName}</span>
      <button
        type="button"
        onClick={handleSignOut}
        style={{
          background: 'none',
          border: 'none',
          color: '#0070f3',
          cursor: 'pointer',
          padding: 0,
          font: 'inherit',
          textDecoration: 'underline',
        }}
      >
        Sign out
      </button>
    </div>
  );
}

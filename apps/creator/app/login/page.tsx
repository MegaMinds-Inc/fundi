import { redirect } from 'next/navigation';
import type { AuthFlowProps } from '@fundi/ui';
import { getDeviceStatus, hasDeviceCookie } from '../lib/bff';
import { LoginClient } from './LoginClient';

type Step = NonNullable<AuthFlowProps['initialStep']>;

// Server-side `/login` resolver (feature 0010 §12.1). The browser CANNOT read
// the httpOnly refresh/device cookies, so the first-screen decision must run on
// the server BEFORE paint — otherwise AuthFlow would flash the phone screen and
// snap to PIN. This is a Server Component: it reads the cookies and pins
// `initialStep` as a prop; the interactive AuthFlow is a `'use client'` child.
//
// Division of labour with the middleware (§6/§12.1): the "valid session →
// straight in" case is owned entirely by the middleware — it proactively
// refreshes (access cookie absent, refresh cookie valid) and redirects to '/'
// BEFORE this resolver renders, and it is the only place on a top-level
// navigation that can SET cookies (a Server Component cannot). So by the time
// this runs, no mintable session exists; we only choose between the two
// no-session entry screens, but from the SERVER-VALIDATED device state (not mere
// cookie presence — a revoked/expired device leaves its cookie in the jar and
// must NOT strand the user on a dead pin-entry screen):
//   • device is trusted (a live row) AND its account has a PIN → `pin-entry`
//     (the returning-user step-up). Covers refresh rejections
//     (`reauth_required`/`session_expired`) and a plain expired access token.
//   • otherwise → `phone` (enrollment OTP). If a device cookie is nonetheless
//     present, it is stale/invalid: redirect through the clear route so it is
//     removed server-side (JS cannot delete an httpOnly cookie — Fix 4). The
//     clear route drops the cookie and returns here; the second pass finds no
//     device cookie and renders `phone` with no further redirect (no loop).
//
// `displayName` (§12.8) can only be server-resolved and is not cheaply
// available here (no bearer post-lapse; `/auth/me` needs one), so it is omitted
// → the generic "Welcome back" greeting.
export default async function LoginPage() {
  const { trusted, hasPin } = await getDeviceStatus();
  if (trusted && hasPin) {
    return <LoginClient initialStep="pin-entry" />;
  }
  // Not a usable device. If a stale cookie is still present, clear it server-side
  // (Fix 4) before falling to phone entry, so it can't keep re-triggering here.
  if (await hasDeviceCookie()) {
    redirect('/api/auth/device/clear');
  }
  const initialStep: Step = 'phone';
  return <LoginClient initialStep={initialStep} />;
}

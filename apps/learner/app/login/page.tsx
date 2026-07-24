import type { AuthFlowProps } from '@fundi/ui';
import { hasDeviceCookie } from '../lib/bff';
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
// no-session entry screens:
//   • trusted-device cookie present → `pin-entry` (the returning-user step-up).
//     Covers both refresh rejections (`reauth_required`/`session_expired`, idle
//     or absolute-cap) and a plain expired access token on a trusted device.
//   • otherwise → `phone` (enrollment OTP).
//
// `displayName` (§12.8) can only be server-resolved and is not cheaply
// available here (no bearer post-lapse; `/auth/me` needs one), so it is omitted
// → the generic "Welcome back" greeting.
export default async function LoginPage() {
  const deviceTrusted = await hasDeviceCookie();
  const initialStep: Step = deviceTrusted ? 'pin-entry' : 'phone';
  return <LoginClient initialStep={initialStep} />;
}

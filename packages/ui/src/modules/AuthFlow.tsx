'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Button } from '../components/Button';
import { OtpInput } from './OtpInput';
import { PinInput } from './PinInput';
import { PhoneInput } from './PhoneInput';

/**
 * Screens the flow can show. The *router* is the server (`/login` resolver,
 * 0010 §12.1) — it reads the httpOnly refresh/device cookies before paint and
 * pins the entry screen via `initialStep`. AuthFlow stays a dumb prop-driven
 * machine and only ever transitions between these client-side.
 */
export type Step = 'phone' | 'otp' | 'pin-entry' | 'pin-setup' | 'success';

export interface AuthFlowProps {
  /** What the user is signing in to, e.g. "your Creator dashboard". */
  appName: string;
  /** Fired ~1.4s after the success state renders. */
  onSuccess: () => void;
  /**
   * Verify the entered code. Injected by the app (Sprint 1 Identity & Auth
   * US-002); defaults to a demo check (`000000`) so the flow is exercisable in
   * Storybook with no backend. Resolve `true` to advance, `false` to show the
   * retry error.
   */
  onVerifyOtp?: (code: string) => Promise<boolean>;
  /** Request (or resend) a code for the phone number. Defaults to a no-op. */
  onRequestOtp?: (phone: string) => Promise<void>;
  /** Number of OTP digits. Default 6. */
  otpLength?: number;
  /**
   * Which screen to render first. Set by the server-side `/login` resolver
   * (0010 §12.1) once it has read the refresh/device cookies; also how
   * Storybook pins the OTP/PIN screens in isolation. Seeds the machine. Default
   * `'phone'`.
   */
  initialStep?: Step;
  /**
   * Step-up re-auth (0010 §12.4). Verify the entered PIN against an
   * already-trusted device. Resolve `true` to advance, `false` for the generic
   * wrong-PIN error. Defaults to a demo check (`135790`).
   */
  onVerifyPin?: (pin: string) => Promise<boolean>;
  /**
   * Post-reset PIN setup (0010 §12.5). Persist the confirmed PIN. Resolve
   * `true` to advance; `false` is treated as a server-side weak-PIN rejection
   * (§7.3 is authoritative — the client guard is UX only). Defaults to accept.
   */
  onSetPin?: (pin: string) => Promise<boolean>;
  /**
   * "Forgot PIN?" — server-driven OTP send for reset (0010 §12.6). The client
   * holds no phone on this path; the BFF resolves it. Defaults to a no-op.
   * Rejecting keeps the user on `pin-entry` (e.g. offline / send failed).
   */
  onForgotPin?: () => Promise<void>;
  /**
   * Forgot-PIN reset submit (0010 §4.6/§12.6). When provided, "Forgot PIN?"
   * drives an OTP-entry (reset mode) → new-PIN sub-flow that captures the SMS'd
   * code and the new PIN entirely client-side (no phone shown, no second OTP
   * send, no server verify of the code alone), then submits BOTH here in ONE
   * call. Resolve `true` to advance to success (signed in); `false` on a weak/
   * invalid PIN (422) or a rejected reset (401) re-prompts the new-PIN entry —
   * the app surfaces the specifics. Absent → "Forgot PIN?" only fires
   * `onForgotPin` (legacy no-reset behavior).
   */
  onResetPin?: (code: string, pin: string) => Promise<boolean>;
  /**
   * "Not you?" — clears the httpOnly trusted-device cookie server-side
   * (`/auth/device/forget`, 0010 §12.4) before returning to phone entry. A
   * client-only flag would leave the cookie in place. Defaults to a no-op.
   */
  onForgetDevice?: () => Promise<void>;
  /**
   * Optional returning-user name for the PIN-entry greeting. Can only come from
   * the server resolver (0010 §12.8) — never a client fetch. When absent the
   * greeting stays the generic "Welcome back".
   */
  displayName?: string;
  /** Number of PIN digits (min 6 per 0010 §7.3). Default 6. */
  pinLength?: number;
}

const RESEND_SECONDS = 30;
const SUCCESS_REDIRECT_MS = 1400;

/**
 * Client-side weak-PIN guard for setup (0010 §7.3). UX-only fast feedback — the
 * server blocklist + pepper is authoritative. Rejects all-identical digits,
 * strict ascending/descending runs (with 9→0 / 0→9 wrap), and a few notorious
 * sequences.
 */
function isWeakPin(pin: string): boolean {
  if (/^(\d)\1*$/.test(pin)) return true; // all identical, e.g. 000000 / 111111
  const nums = pin.split('').map(Number);
  const ascending = nums.every((n, i) => i === 0 || n === (nums[i - 1] + 1) % 10);
  const descending = nums.every((n, i) => i === 0 || n === (nums[i - 1] + 9) % 10);
  if (ascending || descending) return true; // 123456, 654321, 456789 …
  return false;
}

const column: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  width: '100%',
  maxWidth: 360,
  fontFamily: 'var(--font-body)',
};

const heading: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 22,
  letterSpacing: '-0.02em',
  color: 'var(--color-text-heading)',
  margin: 0,
  // Focus target on step transitions (plan B.7) — programmatic focus only, so
  // suppress the ring the -1 tabindex would otherwise paint.
  outline: 'none',
};

const sub: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--color-text-muted)',
  margin: '6px 0 0',
};

function digitsOf(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Canonical phone → OTP → success authentication flow — one implementation
 * consumed identically by both `apps/creator` and `apps/learner`, differing only
 * by `appName`, `onSuccess`, and the injected `onVerifyOtp`/`onRequestOtp`.
 * Composes `Input`, `Button`, and the `OtpInput` module. UI/state-machine only;
 * the real phone/OTP backend (ADR-001) is wired via the injected callbacks.
 */
export function AuthFlow({
  appName,
  onSuccess,
  onVerifyOtp,
  onRequestOtp,
  otpLength = 6,
  initialStep = 'phone',
  onVerifyPin,
  onSetPin,
  onForgotPin,
  onResetPin,
  onForgetDevice,
  displayName,
  pinLength = 6,
}: AuthFlowProps) {
  const [step, setStep] = useState<Step>(initialStep);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // PIN state (0010 §12.4/§12.5). `pin` is the current entry for both the
  // pin-entry and pin-setup screens; setup adds an enter→confirm sub-stage.
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [setupStage, setSetupStage] = useState<'enter' | 'confirm'>('enter');
  const [firstPin, setFirstPin] = useState('');

  // Forgot-PIN reset sub-flow (0010 §4.6/§12.6). `resetMode` re-routes the OTP
  // step to stash the code and advance to `pin-setup` (instead of verifying the
  // code alone), and `pin-setup` submit to `onResetPin(stashedCode, newPin)` —
  // one call that carries both. `false` (the enrollment default) leaves every
  // existing path untouched.
  const [resetMode, setResetMode] = useState(false);
  const [resetCode, setResetCode] = useState('');

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  // A11y focus management (plan B.7): move focus to the step heading on each
  // transition so screen readers announce the new context. The OTP step is the
  // exception — it hands focus to the first code box (OtpInput autoFocus).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const prevStepRef = useRef<Step | null>(null);

  // Hand off to the app exactly once, whether via the timer or the Continue
  // button — never twice.
  const handedOffRef = useRef(false);
  const finish = useCallback(() => {
    if (handedOffRef.current) return;
    handedOffRef.current = true;
    onSuccessRef.current();
  }, []);

  // Resend cooldown: tick down one second at a time until zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    const prev = prevStepRef.current;
    prevStepRef.current = step;
    if (prev === null || prev === step) return; // don't steal focus on first mount
    // OTP + both PIN screens hand focus to their first box (autoFocus), so the
    // heading must not fight it (0010 §12.7).
    if (step !== 'otp' && step !== 'pin-entry' && step !== 'pin-setup') {
      headingRef.current?.focus();
    }
  }, [step]);

  // On success, hand off to the app after a beat so the confirmation is seen —
  // but the visible "Continue" button is the a11y fallback (plan B.7), so a
  // screen-reader / keyboard user is never at the mercy of the timer.
  useEffect(() => {
    if (step !== 'success') return;
    const id = setTimeout(finish, SUCCESS_REDIRECT_MS);
    return () => clearTimeout(id);
  }, [step, finish]);

  async function requestCode(): Promise<void> {
    const d = digitsOf(phone);
    if (d.length < 9 || d.length > 12) {
      setPhoneError('Enter a valid phone number (9–12 digits).');
      return;
    }
    setPhoneError(null);
    await onRequestOtp?.(d);
    setCode('');
    setOtpError(null);
    setStep('otp');
    setCooldown(RESEND_SECONDS);
  }

  async function resend(): Promise<void> {
    if (cooldown > 0 || verifying) return;
    await onRequestOtp?.(digitsOf(phone));
    setCode('');
    setOtpError(null);
    setCooldown(RESEND_SECONDS);
  }

  async function verify(entered: string): Promise<void> {
    // Reset sub-flow (0010 §12.6): the OTP is NOT verified alone here — stash the
    // code and advance to new-PIN setup; both are submitted together via
    // `onResetPin` at the confirm stage.
    if (resetMode) {
      setResetCode(entered);
      setCode('');
      setOtpError(null);
      setPin('');
      setPinError(null);
      setFirstPin('');
      setSetupStage('enter');
      setStep('pin-setup');
      return;
    }
    // Double-submit lock (plan B.4): auto-submit-on-complete + a slow network is
    // a double-fire trap — drop a second onComplete while a verify is in flight.
    if (verifying) return;
    setVerifying(true);
    setOtpError(null);
    const check = onVerifyOtp ?? ((c: string) => Promise.resolve(c === '000000'));
    const ok = await check(entered);
    setVerifying(false);
    if (ok) {
      setStep('success');
    } else {
      setOtpError("That code isn't right. Check it and try again.");
      setCode('');
    }
  }

  async function verifyPin(entered: string): Promise<void> {
    // Same double-submit lock as OTP verify (0010 §12.5): auto-submit-on-complete
    // plus a slow network is a double-fire trap.
    if (verifying) return;
    setVerifying(true);
    setPinError(null);
    const check = onVerifyPin ?? ((p: string) => Promise.resolve(p === '135790'));
    const ok = await check(entered);
    setVerifying(false);
    if (ok) {
      setStep('success');
    } else {
      // Generic message: the boolean callback surfaces no attempt count (§12.4).
      setPinError("That PIN isn't right.");
      setPin('');
    }
  }

  async function submitSetupPin(entered: string): Promise<void> {
    if (verifying) return;
    if (setupStage === 'enter') {
      // Client-side weak-PIN guard is UX only; the server blocklist is
      // authoritative (0010 §7.3).
      if (isWeakPin(entered)) {
        setPinError('Pick something harder to guess.');
        setPin('');
        return;
      }
      setFirstPin(entered);
      setPin('');
      setPinError(null);
      setSetupStage('confirm');
      return;
    }
    // confirm stage
    if (entered !== firstPin) {
      setPinError("Those didn't match — try again.");
      setFirstPin('');
      setPin('');
      setSetupStage('enter');
      return;
    }
    setVerifying(true);
    setPinError(null);
    // Reset mode submits the stashed OTP + the new PIN in ONE call; normal setup
    // persists the new PIN under session auth. Both resolve `true` to advance.
    const ok = resetMode
      ? await (onResetPin ?? (() => Promise.resolve(true)))(resetCode, entered)
      : await (onSetPin ?? (() => Promise.resolve(true)))(entered);
    setVerifying(false);
    if (ok) {
      setStep('success');
    } else {
      // Server rejected — restart the enter→confirm cycle. In reset mode the
      // boolean can be a weak/invalid PIN (422) OR a bad/expired code (401); the
      // app surfaces the specifics (e.g. "request a new code"), so keep neutral.
      setPinError(
        resetMode
          ? "That didn't work. Try again, or request a new code."
          : 'Pick something harder to guess.',
      );
      setFirstPin('');
      setPin('');
      setSetupStage('enter');
    }
  }

  async function forgotPin(): Promise<void> {
    if (verifying) return;
    // Fire the server-driven reset SMS. A rejection (offline / send failed /
    // rate-limited) keeps the user on pin-entry — the app shows the reason.
    setVerifying(true);
    try {
      await (onForgotPin ?? (() => Promise.resolve()))();
    } catch {
      setVerifying(false);
      return;
    }
    setVerifying(false);
    // With a reset handler wired, drive the OTP(reset) → new-PIN sub-flow in-
    // place (0010 §12.6): no phone shown, no second send. Without one, "Forgot
    // PIN?" keeps its legacy no-op-after-send behavior.
    if (onResetPin) {
      setResetMode(true);
      setResetCode('');
      setCode('');
      setOtpError(null);
      setPin('');
      setPinError(null);
      setFirstPin('');
      setSetupStage('enter');
      setStep('otp');
    }
  }

  async function forgetDevice(): Promise<void> {
    if (verifying) return;
    await (onForgetDevice ?? (() => Promise.resolve()))();
    setPin('');
    setPinError(null);
    setStep('phone');
  }

  if (step === 'success') {
    return (
      <div style={{ ...column, alignItems: 'center', textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--color-accent-primary-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <i
            className="ph ph-check"
            style={{ fontSize: 30, color: 'var(--color-accent-primary)' }}
          />
        </div>
        <div role="status" aria-live="polite">
          <h2 ref={headingRef} tabIndex={-1} style={heading}>
            You&apos;re in
          </h2>
          <p style={sub}>Taking you to {appName}…</p>
        </div>
        <Button variant="ghost" onClick={finish}>
          Continue
        </Button>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div style={column}>
        <div>
          <h2 ref={headingRef} tabIndex={-1} style={heading}>
            Enter your code
          </h2>
          <p style={sub}>
            {resetMode
              ? // Reset mode (0010 §12.3): no client-held phone → no number shown,
                // no "Change number", no resend.
                `Enter the ${otpLength}-digit code we texted you to reset your PIN.`
              : `We sent a ${otpLength}-digit code to ${phone.trim()}.`}
          </p>
        </div>
        <OtpInput
          length={otpLength}
          groupLabel={`Enter the ${otpLength}-digit code we sent`}
          value={code}
          error={!!otpError}
          autoFocus
          disabled={verifying}
          onChange={(v) => {
            setCode(v);
            if (otpError) setOtpError(null);
          }}
          onComplete={verify}
        />
        {otpError && (
          <p
            role="alert"
            aria-live="assertive"
            style={{ ...sub, marginTop: 0, color: 'var(--color-status-danger-text)' }}
          >
            {otpError}
          </p>
        )}
        {!resetMode && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Button
              variant="ghost"
              onClick={() => {
                setStep('phone');
                setCode('');
                setOtpError(null);
              }}
            >
              Change number
            </Button>
            <Button variant="ghost" disabled={cooldown > 0 || verifying} onClick={resend}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (step === 'pin-entry') {
    // Step-up re-auth (0010 §12.4): the returning-user screen. No SMS
    // affordances at all — that absence signals the path is free.
    return (
      <div style={column}>
        <div>
          <h2 ref={headingRef} tabIndex={-1} style={heading}>
            {displayName ? `Welcome back, ${displayName}` : 'Welcome back'}
          </h2>
          <p style={sub}>Enter your PIN to continue to {appName}.</p>
        </div>
        <PinInput
          length={pinLength}
          groupLabel={`Enter your ${pinLength}-digit PIN`}
          value={pin}
          error={!!pinError}
          autoFocus
          disabled={verifying}
          onChange={(v) => {
            setPin(v);
            if (pinError) setPinError(null);
          }}
          onComplete={verifyPin}
        />
        {pinError && (
          <p
            role="alert"
            aria-live="assertive"
            style={{ ...sub, marginTop: 0, color: 'var(--color-status-danger-text)' }}
          >
            {pinError}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button variant="ghost" disabled={verifying} onClick={forgetDevice}>
            Not you?
          </Button>
          <Button variant="ghost" disabled={verifying} onClick={forgotPin}>
            Forgot PIN?
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'pin-setup') {
    // Post-reset PIN setup (0010 §12.5): enter → confirm, remounted per stage so
    // the field clears and re-autoFocuses.
    const confirming = setupStage === 'confirm';
    return (
      <div style={column}>
        <div>
          <h2 ref={headingRef} tabIndex={-1} style={heading}>
            Create your PIN
          </h2>
          <p style={sub}>
            {confirming
              ? 'Re-enter your PIN to confirm.'
              : `Choose a ${pinLength}-digit PIN to secure this device.`}
          </p>
        </div>
        <PinInput
          // Remount on stage change so autoFocus fires and boxes reset.
          key={setupStage}
          length={pinLength}
          groupLabel={confirming ? 'Confirm your PIN' : `Choose a ${pinLength}-digit PIN`}
          value={pin}
          error={!!pinError}
          autoFocus
          disabled={verifying}
          onChange={(v) => {
            setPin(v);
            if (pinError) setPinError(null);
          }}
          onComplete={submitSetupPin}
        />
        {pinError && (
          <p
            role="alert"
            aria-live="assertive"
            style={{ ...sub, marginTop: 0, color: 'var(--color-status-danger-text)' }}
          >
            {pinError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={column}>
      <div>
        <h2 ref={headingRef} tabIndex={-1} style={heading}>
          Sign in
        </h2>
        <p style={sub}>Enter your phone number to get a one-time code for {appName}.</p>
      </div>
      <PhoneInput
        value={phone}
        error={phoneError ?? undefined}
        onChange={(v) => {
          setPhone(v);
          if (phoneError) setPhoneError(null);
        }}
      />
      <Button onClick={requestCode}>Send code</Button>
    </div>
  );
}

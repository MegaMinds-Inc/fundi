'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Button } from '../components/Button';
import { OtpInput } from './OtpInput';
import { PhoneInput } from './PhoneInput';

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
}

type Step = 'phone' | 'otp' | 'success';

const RESEND_SECONDS = 30;
const SUCCESS_REDIRECT_MS = 1400;

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
}: AuthFlowProps) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

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
    if (step !== 'otp') headingRef.current?.focus();
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
            We sent a {otpLength}-digit code to {phone.trim()}.
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

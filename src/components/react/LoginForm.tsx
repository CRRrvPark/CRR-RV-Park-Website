/**
 * LoginForm — React component for /admin/login.
 *
 * Wraps itself in AdminProviders so it's self-contained. On success, reads
 * ?next= from the URL (validated against open-redirect attacks) and sends
 * the user there (default /admin).
 *
 * Features
 *   - Show/hide password toggle
 *   - "Forgot password" flow via Supabase's resetPasswordForEmail
 *   - Clear error messaging with actionable hints
 *   - Env-var missing diagnostic (so a blank .env on Netlify surfaces loudly)
 */

import { useEffect, useState } from 'react';
import { AdminProviders } from './AdminProviders';
import { useAuth } from './AuthContext';
import { useToast } from './Toast';
import { Button } from './ui/Button';
import { TextInput } from './ui/Field';
import { IconEye, IconEyeOff, IconMail, IconAlert, IconLock } from './ui/Icon';
import { browserClient } from '@lib/supabase';

type Mode = 'signin' | 'forgot' | 'set-password';

function LoginFormInner() {
  const { signIn } = useAuth();
  const { toast } = useToast();

  // Capture the URL hash ONCE, synchronously, before Supabase's autodetect
  // consumes it. Invite/recovery links arrive with `type=invite` or
  // `type=recovery` in the hash alongside an access_token. Supabase
  // auto-signs-in the user from that token, but the user has never set a
  // password — the normal sign-in form is useless to them. Detect that here
  // and flip into "set-password" mode.
  const [initialHashType] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const params = new URLSearchParams(window.location.hash.slice(1));
      return params.get('type');
    } catch {
      return null;
    }
  });

  const [mode, setMode] = useState<Mode>(
    initialHashType === 'invite' || initialHashType === 'recovery'
      ? 'set-password'
      : 'signin',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envCheck, setEnvCheck] = useState<'checking' | 'ok' | 'missing'>('checking');

  // Diagnostic: probe whether the Supabase client can be created. If env vars
  // are missing (common on first Netlify deploy), show a visible banner
  // instead of silently failing mid-submit.
  useEffect(() => {
    try {
      // browserClient() throws if PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY
      // are empty — which is exactly what we want to detect here.
      browserClient();
      setEnvCheck('ok');
    } catch {
      setEnvCheck('missing');
    }
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      toast.success('Signed in');
      const rawNext = new URL(window.location.href).searchParams.get('next') ?? '/admin';
      const safeNext = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/admin';
      setTimeout(() => { window.location.href = safeNext; }, 350);
    } catch (err: any) {
      setError(friendlyError(err?.message ?? 'Sign in failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const sb = browserClient();
      const origin = window.location.origin;
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/admin/login?reset=1`,
      });
      if (error) throw error;
      toast.success('Reset email sent', { detail: 'Check your inbox for a link to set a new password.' });
      setMode('signin');
    } catch (err: any) {
      setError(err?.message ?? 'Could not send reset email');
    } finally {
      setSubmitting(false);
    }
  };

  // Invite flow: Supabase auto-signed the user in via the URL hash and brought
  // them here with type=invite (or type=recovery). They need to set a real
  // password so they can sign in normally next time.
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const sb = browserClient();
      // Confirm Supabase actually put a session on us from the URL hash.
      // If not, something upstream went wrong and we can't update the
      // password — bounce them back to sign-in with an explanation.
      const { data: sessionData } = await sb.auth.getSession();
      if (!sessionData.session) {
        throw new Error(
          'Your invite link has expired or was already used. Ask an owner to send a fresh invite.',
        );
      }
      const { error: updateErr } = await sb.auth.updateUser({ password });
      if (updateErr) throw updateErr;
      toast.success('Password set', { detail: 'Welcome! Signing you in…' });
      setTimeout(() => { window.location.href = '/admin'; }, 350);
    } catch (err: any) {
      setError(err?.message ?? 'Could not set password');
    } finally {
      setSubmitting(false);
    }
  };

  if (envCheck === 'missing') {
    return (
      <div className="alert alert-danger" style={{ marginBottom: 'var(--sp-4)' }}>
        <IconAlert size={18} />
        <div>
          <div className="alert-title">Supabase configuration is missing</div>
          <div className="alert-body">
            The server does not have <code>PUBLIC_SUPABASE_URL</code> or{' '}
            <code>PUBLIC_SUPABASE_ANON_KEY</code>. Set these in your Netlify
            dashboard under <strong>Site configuration → Environment variables</strong>,
            then trigger a new deploy. See the <code>NETLIFY-DEPLOY.md</code> file in the project for details.
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'set-password') {
    return (
      <form onSubmit={handleSetPassword}>
        <div
          className="alert"
          style={{
            marginBottom: 'var(--sp-4)',
            background: 'var(--c-surface-alt, #fafaf7)',
            borderLeft: '3px solid var(--c-rust, #C4622D)',
            padding: 'var(--sp-3) var(--sp-4)',
            borderRadius: '3px',
          }}
        >
          <div style={{ fontWeight: 500, marginBottom: 'var(--sp-1)' }}>Welcome to CRR Admin</div>
          <div className="text-sm text-muted">
            Your invite is active. Set a password to finish activating your account —
            you'll use this password to sign in from now on.
          </div>
        </div>
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 'var(--sp-4)' }}>
            <IconAlert size={18} />
            <div><div className="alert-body">{error}</div></div>
          </div>
        )}
        <div className="form-field">
          <label className="form-label" htmlFor="set-pw">
            New password<span className="req" aria-hidden>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="set-pw"
              type={showPw ? 'text' : 'password'}
              required
              minLength={12}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              disabled={submitting}
              style={{ paddingRight: '2.4rem' }}
            />
            <button
              type="button"
              className="icon-btn"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--c-text-muted)',
              }}
            >
              {showPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
          </div>
          <div className="text-xs text-muted" style={{ marginTop: 'var(--sp-1)' }}>
            At least 12 characters. Mix of letters, numbers, and symbols recommended.
          </div>
        </div>
        <TextInput
          label="Confirm password"
          type={showPw ? 'text' : 'password'}
          required
          minLength={12}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={submitting}
        />
        <Button type="submit" block loading={submitting} leading={<IconLock size={16} />}>
          Set password and continue
        </Button>
      </form>
    );
  }

  if (mode === 'forgot') {
    return (
      <form onSubmit={handleForgot}>
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 'var(--sp-4)' }}>
            <IconAlert size={18} />
            <div><div className="alert-body">{error}</div></div>
          </div>
        )}
        <p className="text-sm text-muted mb-4">
          Enter the email you sign in with. We'll send you a link to set a new
          password.
        </p>
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
        />
        <Button type="submit" block loading={submitting} leading={<IconMail size={16} />}>
          Email me a reset link
        </Button>
        <button
          type="button"
          onClick={() => { setMode('signin'); setError(null); }}
          className="btn btn-ghost btn-sm btn-block"
          style={{ marginTop: 'var(--sp-2)' }}
          disabled={submitting}
        >
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSignIn}>
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 'var(--sp-4)' }}>
          <IconAlert size={18} />
          <div><div className="alert-body">{error}</div></div>
        </div>
      )}

      <TextInput
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={submitting}
        placeholder="you@example.com"
      />

      <div className="form-field">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <label className="form-label" htmlFor="login-password">
            Password<span className="req" aria-hidden>*</span>
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ padding: 0, fontSize: 'var(--fs-xs)' }}
            onClick={() => { setMode('forgot'); setError(null); }}
          >
            Forgot?
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            id="login-password"
            type={showPw ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            disabled={submitting}
            style={{ paddingRight: '2.4rem' }}
          />
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
            style={{
              position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--c-text-muted)',
            }}
          >
            {showPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </button>
        </div>
      </div>

      <Button type="submit" block loading={submitting} leading={<IconLock size={16} />}>
        Sign in
      </Button>
    </form>
  );
}

export function LoginForm() {
  return (
    <AdminProviders>
      <LoginFormInner />
    </AdminProviders>
  );
}

/** Turn Supabase auth errors into something the HOA can understand. */
function friendlyError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes('invalid login credentials')) {
    return 'Email or password doesn\'t match our records. Double-check and try again.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Check your inbox for a verification email before signing in.';
  }
  if (msg.includes('inactive')) {
    return 'Your account is inactive. An owner needs to reactivate it.';
  }
  if (msg.includes('no app_users row')) {
    return 'Your login works, but an owner hasn\'t finished adding you. Ask them to invite you from Users.';
  }
  if (msg.includes('supabase not configured')) {
    return 'This site isn\'t connected to a database yet. Check the environment variables (see NETLIFY-DEPLOY.md).';
  }
  return raw;
}

import { useState } from 'react';
import { api } from '../api';
import type { AuthAccount } from '../types';

export function Login({ onAuthenticated, initialError }: { onAuthenticated: (account: AuthAccount) => void; initialError?: string }) {
  const [audience, setAudience] = useState<'customer' | 'admin'>('customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const account = await api.login({ email, password });
      if (account.role !== audience) {
        await api.logout();
        throw new Error(`This account is registered as ${account.role}. Choose the matching sign-in option.`);
      }
      onAuthenticated(account);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-layout" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(280px, 0.85fr) minmax(360px, 1fr)', background: '#f3f5f2', color: '#17211c' }}>
      <section className="auth-brand" style={{ background: '#163a32', color: '#f1f5ed', padding: 'clamp(32px, 7vw, 88px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, letterSpacing: 1.4, fontWeight: 700, textTransform: 'uppercase' }}>FraudGuard · Tax Portal</div>
          <h1 style={{ maxWidth: 480, margin: '90px 0 16px', fontSize: 44, lineHeight: 1.08 }}>Tax records, reviewed with care.</h1>
          <p style={{ maxWidth: 420, color: '#c8d8ce', lineHeight: 1.7, fontSize: 15 }}>A secure workspace for customers to follow tax filings and submit documents, and for administrators to manage review.</p>
        </div>
        <p style={{ color: '#a7c0b2', fontSize: 12, lineHeight: 1.6, maxWidth: 420 }}>Automated checks are review signals, not findings of wrongdoing. Final decisions remain with a human reviewer.</p>
      </section>

      <section style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ width: 'min(100%, 430px)' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #cfd8d1', marginBottom: 32 }}>
            {(['customer', 'admin'] as const).map((role) => (
              <button key={role} type="button" onClick={() => { setAudience(role); setError(''); }}
                style={{ flex: 1, padding: '13px 8px', border: 0, borderBottom: audience === role ? '3px solid #276b56' : '3px solid transparent', background: 'transparent', color: audience === role ? '#163a32' : '#65736b', fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                {role} sign in
              </button>
            ))}
          </div>

          <h2 style={{ margin: '0 0 6px', fontSize: 26 }}>{`${audience === 'admin' ? 'Administrator' : 'Customer'} sign in`}</h2>
          <p style={{ margin: '0 0 24px', color: '#64736a', fontSize: 14, lineHeight: 1.6 }}>
            {audience === 'admin' ? 'Use the administrator credentials configured for this service.' : 'Access your tax history, submitted documents, and review updates.'}
          </p>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="username" />
            <Field label="Password" value={password} onChange={setPassword} type="password" autoComplete="current-password" />
            {error && <p role="alert" style={{ margin: 0, color: '#a43d32', fontSize: 13 }}>{error}</p>}
            <button type="submit" disabled={busy} style={{ marginTop: 4, padding: '12px 16px', background: '#276b56', color: '#fff', border: 0, borderRadius: 5, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? 'Please wait…' : 'Sign in'}
            </button>
          </form>

          {audience === 'customer' && <p style={{ marginTop: 20, color: '#64736a', fontSize: 13, textAlign: 'center' }}>Need portal access? Contact your administrator.</p>}
        </div>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, type = 'text', autoComplete, minLength }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string; minLength?: number }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 650 }}>
      {label}
      <input required value={value} onChange={(event) => onChange(event.target.value)} type={type} autoComplete={autoComplete} minLength={minLength}
        style={{ width: '100%', minHeight: 42, padding: '9px 11px', border: '1px solid #becbc2', borderRadius: 4, background: '#fff', font: 'inherit', fontWeight: 400 }} />
    </label>
  );
}
import { useEffect, useState } from 'react';
import { api } from './api';
import type { AuthAccount } from './types';
import { Dashboard } from './pages/Dashboard';
import { Taxpayers } from './pages/Taxpayers';
import { Returns } from './pages/Returns';
import { ReturnDetail } from './pages/ReturnDetail';
import { Appeals } from './pages/Appeals';
import { AdminDocuments } from './pages/AdminDocuments';
import { CustomerPortal } from './pages/CustomerPortal';
import { Login } from './pages/Login';

type Page = 'dashboard' | 'taxpayers' | 'returns' | 'return-detail' | 'appeals' | 'documents';

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard',   icon: '📊' },
  { id: 'taxpayers', label: 'Taxpayers',   icon: '👤' },
  { id: 'returns',   label: 'Tax Returns', icon: '📋' },
  { id: 'documents', label: 'Documents',   icon: '📁' },
  { id: 'appeals',   label: 'Appeals',     icon: '📩' },
];

export default function App() {
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [page, setPage]                         = useState<Page>('dashboard');
  const [returnDetailId, setReturnDetailId]     = useState<number | null>(null);
  const [filterTaxpayerId, setFilterTaxpayerId] = useState<number | undefined>();
  const [filterTaxpayerName, setFilterTaxpayerName] = useState<string | undefined>();

  useEffect(() => {
    let active = true;
    api.getSession()
      .then((session) => { if (active) setAccount(session); })
      .catch((error: unknown) => {
        if (active && error instanceof Error && error.message !== 'Authentication required') setAuthError(error.message);
      })
      .finally(() => { if (active) setAuthReady(true); });
    return () => { active = false; };
  }, []);

  const signOut = async () => {
    try { await api.logout(); } catch { /* Expired sessions are already invalid. */ }
    setAccount(null);
    setPage('dashboard');
  };

  const goToReturn = (id: number) => {
    setReturnDetailId(id);
    setPage('return-detail');
  };

  const goToReturnsForTaxpayer = (id: number, name: string) => {
    setFilterTaxpayerId(id);
    setFilterTaxpayerName(name);
    setPage('returns');
  };

  const isReturnsActive = page === 'returns' || page === 'return-detail';

  if (!authReady) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#52645a', background: '#f3f5f2' }}>Loading secure workspace…</div>;
  if (!account) return <Login onAuthenticated={setAccount} initialError={authError} />;
  if (account.role === 'customer') return <CustomerPortal account={account} onLogout={() => void signOut()} />;

  return (
    <div className="admin-shell" style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Sidebar */}
      <aside className="admin-sidebar" style={{
        width: 220,
        background: '#111827',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #1f2937' }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>🛡️ FraudGuard</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Tax Fraud Detection</div>
        </div>
        <nav style={{ padding: '12px 8px', flex: 1 }}>
          {NAV.map((item) => {
            const active = page === item.id || (item.id === 'returns' && isReturnsActive);
            return (
              <button
                key={item.id}
                onClick={() => {
                  setPage(item.id);
                  if (item.id === 'returns') {
                    setFilterTaxpayerId(undefined);
                    setFilterTaxpayerName(undefined);
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: 'none', background: active ? '#1f2937' : 'transparent',
                  color: active ? '#fff' : '#9ca3af',
                  cursor: 'pointer', fontSize: 14, fontWeight: 600, textAlign: 'left',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div style={{ padding: '14px 16px', borderTop: '1px solid #1f2937' }}>
          <div style={{ color: '#d1d5db', fontSize: 12, marginBottom: 9 }}>{account.display_name}</div>
          <button onClick={() => void signOut()} style={{ width: '100%', padding: '7px 9px', border: '1px solid #4b5563', borderRadius: 5, background: 'transparent', color: '#e5e7eb', textAlign: 'left', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 10 }}>v2.0.0 — Responsible AI</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="admin-main" style={{ flex: 1, padding: '32px', overflowY: 'auto', maxWidth: 1200 }}>
        {page === 'dashboard' && (
          <Dashboard onViewReturn={goToReturn} />
        )}
        {page === 'returns' && (
          <Returns
            filterTaxpayerId={filterTaxpayerId}
            filterTaxpayerName={filterTaxpayerName}
            onViewDetail={goToReturn}
            onClearFilter={() => { setFilterTaxpayerId(undefined); setFilterTaxpayerName(undefined); }}
          />
        )}
        {page === 'taxpayers' && (
          <Taxpayers onViewReturns={goToReturnsForTaxpayer} />
        )}
        {page === 'documents' && <AdminDocuments />}
        {page === 'return-detail' && returnDetailId !== null && (
          <ReturnDetail
            returnId={returnDetailId}
            onBack={() => setPage('returns')}
          />
        )}
        {page === 'appeals' && (
          <Appeals onViewReturn={goToReturn} />
        )}
      </main>
    </div>
  );
}

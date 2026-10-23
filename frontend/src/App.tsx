import { useState } from 'react';
import { Dashboard } from './pages/Dashboard';
import { Taxpayers } from './pages/Taxpayers';
import { Returns } from './pages/Returns';
import { ReturnDetail } from './pages/ReturnDetail';
import { Appeals } from './pages/Appeals';

type Page = 'dashboard' | 'taxpayers' | 'returns' | 'return-detail' | 'appeals';

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard',   icon: '📊' },
  { id: 'taxpayers', label: 'Taxpayers',   icon: '👤' },
  { id: 'returns',   label: 'Tax Returns', icon: '📋' },
  { id: 'appeals',   label: 'Appeals',     icon: '📩' },
];

export default function App() {
  const [page, setPage]                         = useState<Page>('dashboard');
  const [returnDetailId, setReturnDetailId]     = useState<number | null>(null);
  const [filterTaxpayerId, setFilterTaxpayerId] = useState<number | undefined>();
  const [filterTaxpayerName, setFilterTaxpayerName] = useState<string | undefined>();

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
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
        <div style={{ padding: '16px 20px', borderTop: '1px solid #1f2937', fontSize: 11, color: '#4b5563' }}>
          v2.0.0 — Responsible AI
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto', maxWidth: 1200 }}>
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

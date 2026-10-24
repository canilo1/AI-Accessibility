import { Fragment, useEffect, useState } from 'react';
import { api } from '../api';
import type { Taxpayer, PortalAccount } from '../types';

const card = {
  background: '#fff',
  borderRadius: 12,
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  border: '1px solid #e5e7eb',
};

const BUSINESS_TYPES = ['individual', 'sole_proprietor', 'corporation', 'partnership'] as const;

const emptyForm: Omit<Taxpayer, 'id' | 'registered_at'> = {
  tin: '', name: '', email: '', business_type: 'individual',
};

export function Taxpayers({ onViewReturns }: { onViewReturns: (id: number, name: string) => void }) {
  const [list, setList] = useState<Taxpayer[]>([]);
  const [portalAccounts, setPortalAccounts] = useState<PortalAccount[]>([]);
  const [form, setForm] = useState<Omit<Taxpayer, 'id' | 'registered_at'>>(emptyForm);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [provisioningId, setProvisioningId] = useState<number | null>(null);
  const [portalMessage, setPortalMessage] = useState('');
  const [portalInviteUrl, setPortalInviteUrl] = useState('');

  const load = () => {
    api.getTaxpayers().then(setList).catch((e) => setError(e.message));
    api.getPortalAccounts().then(setPortalAccounts).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editing !== null) {
        await api.updateTaxpayer(editing, form);
      } else {
        await api.createTaxpayer(form);
      }
      setForm(emptyForm);
      setEditing(null);
      setShowForm(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleEdit = (t: Taxpayer) => {
    setForm({ tin: t.tin, name: t.name, email: t.email, business_type: t.business_type });
    setEditing(t.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete ${name}? This will remove all their tax returns.`)) return;
    await api.deleteTaxpayer(id);
    load();
  };

  const handleProvision = async (taxpayerId: number) => {
    setError('');
    setPortalMessage('');
    setPortalInviteUrl('');
    try {
      const invitation = await api.createPortalInvitation(taxpayerId);
      setPortalInviteUrl(invitation.invite_url);
      setPortalMessage(`Invitation created for ${invitation.email}. Share the link securely; it expires in 72 hours.`);
      setProvisioningId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to provision portal account');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Taxpayers</h2>
        <button
          onClick={() => { setShowForm(!showForm); setEditing(null); setForm(emptyForm); }}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
        >
          {showForm ? 'Cancel' : '+ Add Taxpayer'}
        </button>
      </div>

      {error && <p role="alert" style={{ color: '#dc2626', margin: 0 }}>{error}</p>}
      {portalMessage && <p role="status" style={{ color: '#276b56', margin: 0 }}>{portalMessage}</p>}

      {showForm && (
        <div style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
            {editing !== null ? 'Edit Taxpayer' : 'New Taxpayer'}
          </h3>
          {error && <p style={{ color: '#dc2626', marginBottom: 12 }}>{error}</p>}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {(['tin', 'name', 'email'] as const).map((field) => (
              <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{field.replace('_', ' ')}</span>
                <input
                  required
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
                />
              </label>
            ))}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Business Type</span>
              <select
                value={form.business_type}
                onChange={(e) => setForm((f) => ({ ...f, business_type: e.target.value as Taxpayer['business_type'] }))}
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
              >
                {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </label>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
              <button type="submit" style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                {editing !== null ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm); }}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={card}>
        {list.length === 0 ? (
          <p style={{ color: '#6b7280', margin: 0 }}>No taxpayers yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                {['TIN', 'Name', 'Email', 'Type', 'Registered', 'Portal', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <Fragment key={t.id}>
                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12 }}>{t.tin}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t.name}</td>
                  <td style={{ padding: '8px 10px', color: '#6b7280' }}>{t.email}</td>
                  <td style={{ padding: '8px 10px' }}>{t.business_type.replace('_', ' ')}</td>
                  <td style={{ padding: '8px 10px', color: '#6b7280' }}>{t.registered_at.slice(0, 10)}</td>
                  <td style={{ padding: '8px 10px', color: portalAccounts.some((account) => account.taxpayer_id === t.id) ? '#276b56' : '#78857d', whiteSpace: 'nowrap' }}>
                    {portalAccounts.some((account) => account.taxpayer_id === t.id) ? 'Active' : 'Not set up'}
                  </td>
                  <td style={{ padding: '8px 10px', display: 'flex', gap: 6 }}>
                    <button onClick={() => onViewReturns(t.id, t.name)}
                      style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #2563eb', color: '#2563eb', cursor: 'pointer', background: '#eff6ff' }}>
                      Returns
                    </button>
                    <button onClick={() => handleEdit(t)}
                      style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', background: '#fff' }}>
                      Edit
                    </button>
                    {!portalAccounts.some((account) => account.taxpayer_id === t.id) && (
                      <button onClick={() => { setProvisioningId(provisioningId === t.id ? null : t.id); setPortalMessage(''); setPortalInviteUrl(''); }}
                        style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #276b56', color: '#276b56', cursor: 'pointer', background: '#edf5ef', whiteSpace: 'nowrap' }}>
                        Invite to portal
                      </button>
                    )}
                    <button onClick={() => handleDelete(t.id, t.name)}
                      style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #fca5a5', color: '#dc2626', cursor: 'pointer', background: '#fef2f2' }}>
                      Delete
                    </button>
                  </td>
                </tr>
                {provisioningId === t.id && (
                  <tr><td colSpan={7} style={{ padding: '12px 10px', background: '#f5f8f5', borderBottom: '1px solid #dfe5df' }}>
                    <form onSubmit={(event) => { event.preventDefault(); void handleProvision(t.id); }} style={{ display: 'flex', alignItems: 'end', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ color: '#52645a', fontSize: 13, marginRight: 8 }}>Invitation will be issued to <strong>{t.email}</strong>. The customer will choose their password.</div>
                      <button type="submit" style={{ padding: '8px 12px', border: 0, borderRadius: 4, background: '#276b56', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Create invitation</button>
                      <button type="button" onClick={() => setProvisioningId(null)} style={{ padding: '7px 10px', border: '1px solid #becbc2', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>Cancel</button>
                    </form>
                  </td></tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {portalInviteUrl && <div role="status" style={{ ...card, borderColor: '#a8c9b3', marginTop: -8 }}>
        <div style={{ color: '#276b56', fontSize: 13, fontWeight: 700, marginBottom: 7 }}>{portalMessage}</div>
        <a href={portalInviteUrl} style={{ color: '#205540', fontSize: 13, overflowWrap: 'anywhere' }}>{portalInviteUrl}</a>
      </div>}
    </div>
  );
}

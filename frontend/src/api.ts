const BASE = 'http://localhost:4000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export const api = {
  // Dashboard
  getDashboard: () => request<import('./types').DashboardData>('/dashboard'),

  // Taxpayers
  getTaxpayers: () => request<import('./types').Taxpayer[]>('/taxpayers'),
  getTaxpayer:  (id: number) => request<import('./types').Taxpayer>(`/taxpayers/${id}`),
  createTaxpayer: (data: Omit<import('./types').Taxpayer, 'id' | 'registered_at'>) =>
    request<import('./types').Taxpayer>('/taxpayers', { method: 'POST', body: JSON.stringify(data) }),
  updateTaxpayer: (id: number, data: Partial<import('./types').Taxpayer>) =>
    request<import('./types').Taxpayer>(`/taxpayers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTaxpayer: (id: number) => request<void>(`/taxpayers/${id}`, { method: 'DELETE' }),

  // Returns
  getReturns: (taxpayer_id?: number) =>
    request<import('./types').TaxReturn[]>(`/returns${taxpayer_id ? `?taxpayer_id=${taxpayer_id}` : ''}`),
  getReturn: (id: number) => request<import('./types').TaxReturn>(`/returns/${id}`),
  createReturn: (data: Partial<import('./types').TaxReturn>) =>
    request<import('./types').TaxReturn>('/returns', { method: 'POST', body: JSON.stringify(data) }),
  analyzeReturn: (id: number) =>
    request<import('./types').FraudAnalysisResult>(`/returns/${id}/analyze`, { method: 'POST' }),
  updateReturnStatus: (id: number, status: import('./types').TaxReturn['status']) =>
    request<{ id: number; status: string }>(`/returns/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  actionReturn: (id: number, action: string, investigator?: string, notes?: string) =>
    request<import('./types').TaxReturn>(`/returns/${id}/action`, { method: 'POST', body: JSON.stringify({ action, investigator, notes }) }),

  // Appeals
  getAppeals: () => request<import('./types').Appeal[]>('/appeals'),
  createAppeal: (data: { tax_return_id: number; taxpayer_id: number; statement: string }) =>
    request<import('./types').Appeal>('/appeals', { method: 'POST', body: JSON.stringify(data) }),
  resolveAppeal: (id: number, status: 'accepted' | 'rejected', resolved_by?: string, resolution_notes?: string) =>
    request<import('./types').Appeal>(`/appeals/${id}/resolve`, { method: 'POST', body: JSON.stringify({ status, resolved_by, resolution_notes }) }),
};

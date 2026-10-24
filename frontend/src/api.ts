const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!(options?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers,
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
  // Authentication
  getSession: () => request<import('./types').AuthAccount>('/auth/me'),
  login: (data: { email: string; password: string }) =>
    request<import('./types').AuthAccount>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getInvitation: (token: string) => request<import('./types').InvitationPreview>(`/auth/invitation/${encodeURIComponent(token)}`),
  acceptInvitation: (token: string, password: string) =>
    request<import('./types').AuthAccount>('/auth/accept-invitation', { method: 'POST', body: JSON.stringify({ token, password }) }),
  changePassword: (current_password: string, new_password: string) =>
    request<{ message: string }>('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  // Customer portal
  getCustomerDashboard: () => request<import('./types').CustomerDashboardData>('/customer/dashboard'),
  uploadDocument: (form: FormData) =>
    request<import('./types').CustomerDocument>('/customer/documents', { method: 'POST', body: form }),
  submitCustomerAppeal: (tax_return_id: number, statement: string) =>
    request<import('./types').Appeal>('/customer/appeals', { method: 'POST', body: JSON.stringify({ tax_return_id, statement }) }),
  getAdminDocuments: () => request<import('./types').CustomerDocument[]>('/admin/documents'),
  updateDocument: (id: number, status: import('./types').CustomerDocument['status'], review_notes: string) =>
    request<import('./types').CustomerDocument>(`/admin/documents/${id}`, { method: 'PATCH', body: JSON.stringify({ status, review_notes }) }),
  getPortalAccounts: () => request<import('./types').PortalAccount[]>('/admin/customer-accounts'),
  provisionPortalAccount: (taxpayer_id: number, password: string) =>
    request<import('./types').PortalAccount>('/admin/customer-accounts', { method: 'POST', body: JSON.stringify({ taxpayer_id, password }) }),
  createPortalInvitation: (taxpayer_id: number) =>
    request<import('./types').PortalInvitation>('/admin/customer-accounts/invitations', { method: 'POST', body: JSON.stringify({ taxpayer_id }) }),
  getAdminAccounts: () => request<import('./types').AdminAccount[]>('/admin/customer-accounts/admins'),
  createAdminAccount: (data: { name: string; email: string; password: string }) =>
    request<import('./types').AdminAccount>('/admin/customer-accounts/admins', { method: 'POST', body: JSON.stringify(data) }),
  downloadDocument: async (id: number) => {
    const response = await fetch(`${BASE}/documents/${id}/download`, { credentials: 'include' });
    if (!response.ok) throw new Error('Unable to download document');
    return response.blob();
  },

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

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'wouter'

function DemoDataPanel() {
  const queryClient = useQueryClient()
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [confirmClean, setConfirmClean] = useState(false)

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['demo-status'],
    queryFn: async () => {
      const res = await fetch('/api/admin/demo-data/status', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<{ exists: boolean; member_count: number; loan_count: number; staff_count: number }>
    },
    refetchOnWindowFocus: false,
  })

  const call = async (path: string) => {
    setMsg(null)
    const res = await fetch(path, { method: 'POST', credentials: 'include' })
    const data = await res.json()
    setMsg({ text: data.message || data.detail || (res.ok ? 'Done.' : 'Error'), ok: res.ok })
    queryClient.invalidateQueries({ queryKey: ['demo-status'] })
    queryClient.invalidateQueries({ queryKey: ['organizations'] })
  }

  const populateMutation = useMutation({ mutationFn: () => call('/api/admin/demo-data/populate') })
  const resetMutation    = useMutation({ mutationFn: () => call('/api/admin/demo-data/reset') })
  const cleanMutation    = useMutation({ mutationFn: () => call('/api/admin/demo-data/clean').then(() => setConfirmClean(false)) })

  const busy = populateMutation.isPending || resetMutation.isPending || cleanMutation.isPending

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Demo Data</h3>
          <p className="text-sm text-gray-500 mt-0.5">Populate the system with one demo organization, 15 members, loans, and transactions for testing or showcasing.</p>
        </div>
        {!statusLoading && status?.exists && (
          <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Active
          </span>
        )}
      </div>

      {!statusLoading && status?.exists && (
        <div className="flex gap-6 mb-4 text-sm text-gray-600">
          <span><strong className="text-gray-900">{status.staff_count}</strong> staff</span>
          <span><strong className="text-gray-900">{status.member_count}</strong> members</span>
          <span><strong className="text-gray-900">{status.loan_count}</strong> loans</span>
        </div>
      )}

      {msg && (
        <div className={`mb-4 px-3 py-2 rounded-lg text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
          {msg.ok && status?.exists && <span className="ml-2 text-xs">Login: <code>demo@demo.bankykit</code> / <code>Demo@1234</code></span>}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {!status?.exists ? (
          <button
            onClick={() => populateMutation.mutate()}
            disabled={busy || statusLoading}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
          >
            {populateMutation.isPending ? 'Creating...' : 'Create Demo Data'}
          </button>
        ) : (
          <>
            <button
              onClick={() => resetMutation.mutate()}
              disabled={busy}
              className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 transition"
            >
              {resetMutation.isPending ? 'Resetting...' : 'Reset to Fresh Data'}
            </button>

            {!confirmClean ? (
              <button
                onClick={() => setConfirmClean(true)}
                disabled={busy}
                className="px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 transition"
              >
                Remove Demo Data
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">Are you sure?</span>
                <button
                  onClick={() => cleanMutation.mutate()}
                  disabled={busy}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {cleanMutation.isPending ? 'Removing...' : 'Yes, Remove'}
                </button>
                <button
                  onClick={() => setConfirmClean(false)}
                  className="px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

interface Plan {
  id: string
  name: string
  plan_type: string
  pricing_model: string
  monthly_price: number
}

export default function Organizations() {
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    staff_email_domain: '',
    owner_email: '',
    owner_first_name: '',
    owner_last_name: '',
    owner_password: '',
    plan_id: '',
    subscription_status: 'trial'
  })
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const { data: orgs, isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await fetch('/api/admin/organizations', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load organizations')
      return res.json()
    }
  })

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await fetch('/api/admin/plans', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load plans')
      return res.json()
    }
  })

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Failed to create organization')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      setShowModal(false)
      setFormData({
        name: '', code: '', email: '', phone: '', staff_email_domain: '',
        owner_email: '', owner_first_name: '', owner_last_name: '',
        owner_password: '', plan_id: '', subscription_status: 'trial'
      })
      setError('')
    },
    onError: (err: Error) => {
      setError(err.message)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    createMutation.mutate(formData)
  }

  const saasPlans = plans?.filter(p => p.pricing_model === 'saas') || []

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
  }

  return (
    <div>
      <DemoDataPanel />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Organizations</h1>
          <p className="text-sm text-gray-500">{orgs?.length || 0} total organizations</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center gap-2 text-sm sm:text-base w-full sm:w-auto justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Organization
        </button>
      </div>

      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orgs?.map((org: any) => (
                <tr key={org.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{org.name}</div>
                    <div className="text-sm text-gray-500">{org.code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{org.owner?.name || '-'}</div>
                    <div className="text-sm text-gray-500">{org.owner?.email || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      org.subscription?.plan === 'professional' ? 'bg-purple-100 text-purple-800' :
                      org.subscription?.plan === 'growth' ? 'bg-blue-100 text-blue-800' :
                      org.subscription?.plan === 'enterprise' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {org.subscription?.plan || 'None'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      org.subscription?.status === 'active' ? 'bg-green-100 text-green-800' :
                      org.subscription?.status === 'trial' ? 'bg-blue-100 text-blue-800' :
                      org.subscription?.status === 'expired' ? 'bg-red-100 text-red-800' :
                      org.subscription?.status === 'past_due' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {org.subscription?.status || 'None'}
                    </span>
                    {org.subscription?.status === 'trial' && org.subscription?.trial_ends_at && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({Math.max(0, Math.ceil((new Date(org.subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days left)
                      </span>
                    )}
                    {!org.is_active && (
                      <span className="ml-2 px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Disabled</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{org.usage?.members || 0} members</div>
                    <div>{org.usage?.staff || 0} staff</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {org.created_at ? new Date(org.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/organizations/${org.id}`} className="text-primary-600 hover:text-primary-900">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(!orgs || orgs.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            No organizations yet. Click "Create Organization" to add one.
          </div>
        )}
      </div>

      <div className="md:hidden space-y-3">
        {orgs?.map((org: any) => (
          <Link key={org.id} href={`/organizations/${org.id}`} className="block bg-white rounded-lg shadow p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-medium text-gray-900">{org.name}</div>
                <div className="text-xs text-gray-500">{org.code}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                  org.subscription?.status === 'active' ? 'bg-green-100 text-green-800' :
                  org.subscription?.status === 'trial' ? 'bg-blue-100 text-blue-800' :
                  org.subscription?.status === 'expired' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {org.subscription?.status || 'No status'}
                </span>
                {!org.is_active && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">Disabled</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
              <span>Plan: {org.subscription?.plan || 'None'}</span>
              <span>Members: {org.usage?.members || 0}</span>
              <span>Staff: {org.usage?.staff || 0}</span>
            </div>
            {org.owner?.email && (
              <div className="text-xs text-gray-400 mt-1">Owner: {org.owner.email}</div>
            )}
          </Link>
        ))}

        {(!orgs || orgs.length === 0) && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
            No organizations yet. Tap "Create Organization" to add one.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Create New Organization</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Organization Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="e.g. Umoja Sacco"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Organization Code</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="e.g. UMOJA (auto-generated if empty)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="info@sacco.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="+254712345678"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Staff Email Domain</label>
                  <div className="flex items-center">
                    <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-500">@</span>
                    <input
                      type="text"
                      value={formData.staff_email_domain}
                      onChange={e => setFormData({ ...formData, staff_email_domain: e.target.value.replace('@', '') })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="e.g. umojasacco.co.ke"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Staff login emails will use this domain (e.g. john@umojasacco.co.ke). If left empty, a default domain is generated from the organization name.</p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Owner Account</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={formData.owner_first_name}
                      onChange={e => setFormData({ ...formData, owner_first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={formData.owner_last_name}
                      onChange={e => setFormData({ ...formData, owner_last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Kamau"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.owner_email}
                      onChange={e => setFormData({ ...formData, owner_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="owner@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      value={formData.owner_password}
                      onChange={e => setFormData({ ...formData, owner_password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Minimum 8 characters"
                      minLength={8}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Subscription</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                    <select
                      value={formData.plan_id}
                      onChange={e => setFormData({ ...formData, plan_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Select a plan</option>
                      {saasPlans.map(plan => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} (${plan.monthly_price}/mo)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.subscription_status}
                      onChange={e => setFormData({ ...formData, subscription_status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="trial">Trial</option>
                      <option value="active">Active</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 flex items-center gap-2 justify-center w-full sm:w-auto"
                >
                  {createMutation.isPending && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  Create Organization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'wouter'
import { useState } from 'react'
import { toast } from 'sonner'

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [selectedPlan, setSelectedPlan] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization', id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/organizations/${id}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load organization')
      return res.json()
    }
  })

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await fetch('/api/admin/plans', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load plans')
      return res.json()
    }
  })

  const updateSubscription = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/organizations/${id}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          plan_type: selectedPlan || undefined,
          status: selectedStatus || undefined
        })
      })
      if (!res.ok) throw new Error('Failed to update subscription')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', id] })
      toast.success('Subscription updated')
    }
  })

  const toggleStatus = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/organizations/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !org?.is_active })
      })
      if (!res.ok) throw new Error('Failed to update status')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', id] })
      toast.success(org?.is_active ? 'Organization disabled' : 'Organization enabled')
    }
  })

  const resetPassword = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/organizations/${id}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ new_password: newPassword })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Failed to reset password')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Password reset successfully')
      setNewPassword('')
      setShowResetPassword(false)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    }
  })

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    resetPassword.mutate()
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
  }

  if (!org) {
    return <div className="text-center py-12 text-gray-500">Organization not found</div>
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-6">
        <Link href="/organizations" className="text-primary-600 hover:underline text-sm">&larr; Back</Link>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{org.name}</h1>
          {!org.is_active && <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">Disabled</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Organization Details</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500 text-sm">Code</dt>
              <dd className="font-medium text-sm">{org.code}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 text-sm">Email</dt>
              <dd className="font-medium text-sm truncate ml-4">{org.email || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 text-sm">Phone</dt>
              <dd className="font-medium text-sm">{org.phone || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 text-sm">Owner</dt>
              <dd className="font-medium text-sm truncate ml-4">{org.owner?.email || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 text-sm">Created</dt>
              <dd className="font-medium text-sm">{org.created_at ? new Date(org.created_at).toLocaleDateString() : '-'}</dd>
            </div>
          </dl>

          <div className="mt-6 pt-6 border-t space-y-3">
            <button
              onClick={() => setShowResetPassword(!showResetPassword)}
              className="w-full py-2 rounded-lg text-sm bg-amber-100 text-amber-700 hover:bg-amber-200 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Reset Owner Password
            </button>

            {showResetPassword && (
              <form onSubmit={handleResetPassword} className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
                <p className="text-xs text-amber-700">
                  Set a new password for <strong>{org.owner?.email || 'the owner'}</strong>
                </p>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="New password (min 8 characters)"
                  minLength={8}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowResetPassword(false); setNewPassword('') }}
                    className="flex-1 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetPassword.isPending || newPassword.length < 8}
                    className="flex-1 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {resetPassword.isPending && (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    )}
                    Reset
                  </button>
                </div>
              </form>
            )}

            <button
              onClick={() => toggleStatus.mutate()}
              className={`w-full py-2 rounded-lg text-sm ${org.is_active 
                ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
            >
              {org.is_active ? 'Disable Organization' : 'Enable Organization'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Usage Statistics</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
              <div className="text-xl sm:text-2xl font-bold text-gray-800">{org.usage?.members || 0}</div>
              <div className="text-xs sm:text-sm text-gray-500">Members</div>
            </div>
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
              <div className="text-xl sm:text-2xl font-bold text-gray-800">{org.usage?.staff || 0}</div>
              <div className="text-xs sm:text-sm text-gray-500">Staff</div>
            </div>
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
              <div className="text-xl sm:text-2xl font-bold text-gray-800">{org.usage?.branches || 0}</div>
              <div className="text-xs sm:text-sm text-gray-500">Branches</div>
            </div>
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
              <div className="text-xl sm:text-2xl font-bold text-gray-800">{org.usage?.loans || 0}</div>
              <div className="text-xs sm:text-sm text-gray-500">Loans</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Subscription Management</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Plan</label>
              <div className="text-lg font-medium text-primary-600 capitalize mb-4">
                {org.subscription?.plan || 'No Plan'}
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-1">Change Plan</label>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">-- Select Plan --</option>
                {plans?.map((plan: any) => (
                  <option key={plan.id} value={plan.plan_type}>
                    {plan.name} (${plan.monthly_price}/mo)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Status</label>
              <div className={`text-lg font-medium capitalize mb-4 ${
                org.subscription?.status === 'active' ? 'text-green-600' :
                org.subscription?.status === 'trial' ? 'text-blue-600' :
                org.subscription?.status === 'past_due' ? 'text-red-600' :
                'text-gray-600'
              }`}>
                {org.subscription?.status || 'None'}
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-1">Change Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">-- Select Status --</option>
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="past_due">Past Due</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={() => updateSubscription.mutate()}
              disabled={!selectedPlan && !selectedStatus}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              Update Subscription
            </button>
          </div>

          {org.subscription?.trial_ends_at && (
            <div className="mt-4 text-sm text-gray-500">
              Trial ends: {new Date(org.subscription.trial_ends_at).toLocaleDateString()}
            </div>
          )}
          {org.subscription?.current_period_end && (
            <div className="mt-2 text-sm text-gray-500">
              Current period ends: {new Date(org.subscription.current_period_end).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

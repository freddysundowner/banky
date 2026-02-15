import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

const ALL_FEATURES = [
  { id: 'core_banking', name: 'Core Banking', group: 'Core' },
  { id: 'members', name: 'Members Management', group: 'Core' },
  { id: 'savings', name: 'Savings Accounts', group: 'Core' },
  { id: 'shares', name: 'Share Accounts', group: 'Core' },
  { id: 'loans', name: 'Loans', group: 'Core' },
  { id: 'teller_station', name: 'Teller Station', group: 'Operations', requires: ['float_management'], requiredBy: ['float_management'] },
  { id: 'float_management', name: 'Float Management', group: 'Operations', requires: ['teller_station'], requiredBy: ['teller_station'] },
  { id: 'fixed_deposits', name: 'Fixed Deposits', group: 'Products' },
  { id: 'dividends', name: 'Dividends', group: 'Products' },
  { id: 'analytics', name: 'Analytics', group: 'Reporting', requiredBy: ['analytics_export'] },
  { id: 'analytics_export', name: 'Analytics Export', group: 'Reporting', requires: ['analytics'] },
  { id: 'sms_notifications', name: 'SMS Notifications', group: 'Communication', requiredBy: ['bulk_sms'] },
  { id: 'bulk_sms', name: 'Bulk SMS', group: 'Communication', requires: ['sms_notifications'] },
  { id: 'expenses', name: 'Expenses Management', group: 'HR' },
  { id: 'leave_management', name: 'Leave Management', group: 'HR' },
  { id: 'payroll', name: 'Payroll', group: 'HR' },
  { id: 'accounting', name: 'Accounting', group: 'Finance' },
  { id: 'audit_logs', name: 'Audit Logs', group: 'Security' },
  { id: 'multiple_branches', name: 'Multiple Branches', group: 'Advanced' },
  { id: 'api_access', name: 'API Access', group: 'Advanced' },
  { id: 'white_label', name: 'White Label', group: 'Advanced' },
  { id: 'custom_reports', name: 'Custom Reports', group: 'Reporting' },
  { id: 'mpesa_integration', name: 'M-Pesa Integration', group: 'Integrations' },
  { id: 'bank_integration', name: 'Bank Integration', group: 'Integrations' },
]

const FEATURE_GROUPS = ['Core', 'Operations', 'Products', 'Finance', 'Reporting', 'Communication', 'HR', 'Security', 'Advanced', 'Integrations']

type PricingModel = 'saas' | 'enterprise'

interface Plan {
  id: string
  name: string
  plan_type: string
  pricing_model: PricingModel
  monthly_price: number
  annual_price: number
  one_time_price: number
  max_members: number | null
  max_staff: number | null
  max_branches: number | null
  sms_credits_monthly: number
  support_years: number
  features: { enabled?: string[] }
  is_active: boolean
  sort_order: number
}

export default function Plans() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<PricingModel>('saas')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Plan>>({})
  const [editingFeatures, setEditingFeatures] = useState<string | null>(null)
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [newPlan, setNewPlan] = useState<Partial<Plan>>({
    name: '',
    plan_type: 'custom',
    pricing_model: 'saas',
    monthly_price: 0,
    annual_price: 0,
    one_time_price: 0,
    max_members: 1000,
    max_staff: 10,
    max_branches: 5,
    sms_credits_monthly: 100,
    support_years: 1,
  })

  const { data: allPlans, isLoading } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await fetch('/api/admin/plans', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load plans')
      return res.json()
    }
  })


  const plans = allPlans?.filter((p) => (p.pricing_model || 'saas') === activeTab) || []

  const createPlan = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...newPlan, pricing_model: activeTab })
      })
      if (!res.ok) throw new Error('Failed to create plan')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      setShowCreateModal(false)
      setNewPlan({ name: '', plan_type: 'custom', pricing_model: activeTab, monthly_price: 0, annual_price: 0, one_time_price: 0, max_members: 1000, max_staff: 10, max_branches: 5, sms_credits_monthly: 100, support_years: 1 })
      toast.success('Plan created successfully')
    },
    onError: () => toast.error('Failed to create plan')
  })

  const deletePlan = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(`/api/admin/plans/${planId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to delete plan')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      setShowDeleteModal(null)
      toast.success('Plan deleted')
    },
    onError: (e: Error) => toast.error(e.message)
  })

  const updatePlan = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(`/api/admin/plans/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editData)
      })
      if (!res.ok) throw new Error('Failed to update plan')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      setEditing(null)
      setEditData({})
      toast.success('Plan updated')
    }
  })

  const updatePlanFeatures = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(`/api/admin/plans/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ features: { enabled: selectedFeatures } })
      })
      if (!res.ok) throw new Error('Failed to update plan features')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      queryClient.invalidateQueries({ queryKey: ['features'] })
      setEditingFeatures(null)
      setSelectedFeatures([])
      toast.success('Features updated')
    }
  })

  const resetFeatures = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/plans/reset-features', {
        method: 'POST',
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to reset features')
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      queryClient.invalidateQueries({ queryKey: ['features'] })
      setShowResetConfirm(false)
      toast.success(data.message || 'Features reset to defaults')
    },
    onError: () => toast.error('Failed to reset features to defaults')
  })

  const startEditingFeatures = (plan: Plan) => {
    setEditingFeatures(plan.id)
    const currentFeatures = plan.features?.enabled || []
    setSelectedFeatures(currentFeatures)
  }

  const toggleFeature = (featureId: string) => {
    const feature = ALL_FEATURES.find(f => f.id === featureId)
    setSelectedFeatures(prev => {
      if (prev.includes(featureId)) {
        let toRemove = [featureId]
        if (feature?.requiredBy) {
          toRemove = [...toRemove, ...feature.requiredBy.filter(dep => prev.includes(dep))]
        }
        return prev.filter(f => !toRemove.includes(f))
      } else {
        let toAdd = [featureId]
        if (feature?.requires) {
          toAdd = [...toAdd, ...feature.requires.filter(dep => !prev.includes(dep))]
        }
        return [...prev, ...toAdd]
      }
    })
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Subscription Plans</h1>
          <p className="text-sm text-gray-500">Manage pricing plans for SaaS and Enterprise customers</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            data-testid="button-reset-features"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset Features to Defaults
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            data-testid="button-create-plan"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Plan
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('saas')}
              className={`flex-1 py-4 px-6 text-center font-medium ${
                activeTab === 'saas' ? 'border-b-2 border-primary-500 text-primary-600 bg-primary-50' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
                SaaS Plans (Monthly/Annual)
              </div>
            </button>
            <button
              onClick={() => setActiveTab('enterprise')}
              className={`flex-1 py-4 px-6 text-center font-medium ${
                activeTab === 'enterprise' ? 'border-b-2 border-primary-500 text-primary-600 bg-primary-50' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Enterprise Plans (One-Time License)
              </div>
            </button>
          </nav>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-lg font-medium text-gray-700 mb-2">No {activeTab === 'saas' ? 'SaaS' : 'Enterprise'} Plans</h3>
          <p className="text-gray-500 mb-4">Create your first plan to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Create Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div key={plan.id} className={`bg-white rounded-lg shadow overflow-hidden ${plan.plan_type === 'professional' || plan.plan_type === 'premium' ? 'ring-2 ring-primary-500' : ''}`}>
              {editing === plan.id ? (
                <div className="p-6 space-y-4">
                  <input type="text" value={editData.name ?? plan.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="Plan name" />
                  {activeTab === 'saas' ? (
                    <>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Pricing (USD)</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-xs text-gray-500">Monthly (USD)</label><input type="number" step="0.01" value={editData.monthly_price ?? plan.monthly_price} onChange={(e) => setEditData({ ...editData, monthly_price: parseFloat(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" /></div>
                        <div><label className="text-xs text-gray-500">Annual (USD)</label><input type="number" step="0.01" value={editData.annual_price ?? plan.annual_price} onChange={(e) => setEditData({ ...editData, annual_price: parseFloat(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" /></div>
                      </div>
                      <p className="text-xs text-gray-400 italic">Other currencies are auto-converted from USD at payment time</p>
                      <div><label className="text-xs text-gray-500">SMS Credits/mo</label><input type="number" value={editData.sms_credits_monthly ?? plan.sms_credits_monthly} onChange={(e) => setEditData({ ...editData, sms_credits_monthly: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" /></div>
                    </>
                  ) : (
                    <>
                      <div><label className="text-xs text-gray-500">One-time Price $</label><input type="number" value={editData.one_time_price ?? plan.one_time_price} onChange={(e) => setEditData({ ...editData, one_time_price: parseFloat(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" /></div>
                      <div><label className="text-xs text-gray-500">Support Years</label><input type="number" value={editData.support_years ?? plan.support_years} onChange={(e) => setEditData({ ...editData, support_years: parseInt(e.target.value) || 1 })} className="w-full px-3 py-2 border rounded-lg" /></div>
                    </>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="text-xs text-gray-500">Members</label><input type="number" value={editData.max_members ?? plan.max_members ?? ''} onChange={(e) => setEditData({ ...editData, max_members: parseInt(e.target.value) || null })} className="w-full px-2 py-1 border rounded text-sm" /></div>
                    <div><label className="text-xs text-gray-500">Staff</label><input type="number" value={editData.max_staff ?? plan.max_staff ?? ''} onChange={(e) => setEditData({ ...editData, max_staff: parseInt(e.target.value) || null })} className="w-full px-2 py-1 border rounded text-sm" /></div>
                    <div><label className="text-xs text-gray-500">Branches</label><input type="number" value={editData.max_branches ?? plan.max_branches ?? ''} onChange={(e) => setEditData({ ...editData, max_branches: parseInt(e.target.value) || null })} className="w-full px-2 py-1 border rounded text-sm" /></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updatePlan.mutate(plan.id)} className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700">Save</button>
                    <button onClick={() => { setEditing(null); setEditData({}) }} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h2 className="text-xl font-bold text-gray-800">{plan.name}</h2>
                      <button onClick={() => setShowDeleteModal(plan.id)} className="text-gray-400 hover:text-red-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                    {activeTab === 'saas' ? (
                      <div className="mb-4 space-y-1">
                        <div className="text-2xl font-bold text-primary-600">${plan.monthly_price?.toLocaleString()}<span className="text-sm text-gray-500">/mo</span></div>
                        {plan.annual_price > 0 && <div className="text-xs text-gray-500">${plan.annual_price?.toLocaleString()}/yr</div>}
                        <div className="text-xs text-gray-400">Other currencies auto-converted</div>
                      </div>
                    ) : (
                      <div className="mb-4">
                        <div className="text-3xl font-bold text-primary-600">${plan.one_time_price?.toLocaleString()}</div>
                        <div className="text-sm text-gray-500">One-time license</div>
                      </div>
                    )}
                    <div className="space-y-2 text-sm border-t pt-4">
                      <div className="flex justify-between"><span className="text-gray-600">Members</span><span className="font-medium">{plan.max_members?.toLocaleString() || '∞'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Staff</span><span className="font-medium">{plan.max_staff || '∞'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Branches</span><span className="font-medium">{plan.max_branches || '∞'}</span></div>
                      {activeTab === 'saas' ? (
                        <div className="flex justify-between"><span className="text-gray-600">SMS/month</span><span className="font-medium">{plan.sms_credits_monthly || 0}</span></div>
                      ) : (
                        <div className="flex justify-between"><span className="text-gray-600">Support</span><span className="font-medium">{plan.support_years || 1} year{(plan.support_years || 1) > 1 ? 's' : ''}</span></div>
                      )}
                    </div>
                  </div>
                  <div className="border-t p-4 bg-gray-50 space-y-2">
                    <button onClick={() => { setEditing(plan.id); setEditData({}) }} className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50">Edit Plan</button>
                    <button onClick={() => startEditingFeatures(plan)} className="w-full bg-primary-100 text-primary-700 py-2 rounded-lg hover:bg-primary-200">Edit Features ({plan.features?.enabled?.length || 0})</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Create {activeTab === 'saas' ? 'SaaS' : 'Enterprise'} Plan</h2>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label><input type="text" value={newPlan.name} onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Professional" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Plan Type (slug)</label><input type="text" value={newPlan.plan_type} onChange={(e) => setNewPlan({ ...newPlan, plan_type: e.target.value.toLowerCase().replace(/\s/g, '_') })} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. professional" /></div>
              {activeTab === 'saas' ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase">Pricing (USD)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Monthly (USD)</label><input type="number" step="0.01" value={newPlan.monthly_price} onChange={(e) => setNewPlan({ ...newPlan, monthly_price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Annual (USD)</label><input type="number" step="0.01" value={newPlan.annual_price} onChange={(e) => setNewPlan({ ...newPlan, annual_price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" /></div>
                  </div>
                  <p className="text-xs text-gray-400 italic">M-Pesa, Paystack prices auto-converted from USD at payment time</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">One-time Price ($)</label><input type="number" value={newPlan.one_time_price} onChange={(e) => setNewPlan({ ...newPlan, one_time_price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Support Years</label><input type="number" value={newPlan.support_years} onChange={(e) => setNewPlan({ ...newPlan, support_years: parseInt(e.target.value) || 1 })} className="w-full px-3 py-2 border rounded-lg" /></div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Max Members</label><input type="number" value={newPlan.max_members ?? ''} onChange={(e) => setNewPlan({ ...newPlan, max_members: parseInt(e.target.value) || null })} className="w-full px-3 py-2 border rounded-lg" placeholder="∞" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Max Staff</label><input type="number" value={newPlan.max_staff ?? ''} onChange={(e) => setNewPlan({ ...newPlan, max_staff: parseInt(e.target.value) || null })} className="w-full px-3 py-2 border rounded-lg" placeholder="∞" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Max Branches</label><input type="number" value={newPlan.max_branches ?? ''} onChange={(e) => setNewPlan({ ...newPlan, max_branches: parseInt(e.target.value) || null })} className="w-full px-3 py-2 border rounded-lg" placeholder="∞" /></div>
              </div>
              {activeTab === 'saas' && (
                <div><label className="block text-sm font-medium text-gray-700 mb-1">SMS Credits/Month</label><input type="number" value={newPlan.sms_credits_monthly} onChange={(e) => setNewPlan({ ...newPlan, sms_credits_monthly: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" /></div>
              )}
            </div>
            <div className="p-6 border-t flex gap-3 justify-end">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
              <button onClick={() => createPlan.mutate()} disabled={!newPlan.name || createPlan.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">{createPlan.isPending ? 'Creating...' : 'Create Plan'}</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Plan?</h3>
            <p className="text-gray-600 mb-4">This cannot be undone. Plans with active organizations cannot be deleted.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteModal(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
              <button onClick={() => deletePlan.mutate(showDeleteModal)} disabled={deletePlan.isPending} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">{deletePlan.isPending ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {editingFeatures && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Edit Features - {allPlans?.find((p) => p.id === editingFeatures)?.name}</h2>
              <p className="text-sm text-gray-500">Select which features are included in this plan</p>
            </div>
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              {FEATURE_GROUPS.map(group => {
                const groupFeatures = ALL_FEATURES.filter(f => f.group === group)
                if (groupFeatures.length === 0) return null
                return (
                  <div key={group} className="mb-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{group}</h3>
                    <div className="grid grid-cols-2 gap-1">
                      {groupFeatures.map(feature => {
                        const isChecked = selectedFeatures.includes(feature.id)
                        const deps = (feature as any).requires as string[] | undefined
                        const depNames = deps?.map(d => ALL_FEATURES.find(f => f.id === d)?.name).filter(Boolean)
                        return (
                          <label key={feature.id} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input type="checkbox" checked={isChecked} onChange={() => toggleFeature(feature.id)} className="w-4 h-4 text-primary-600 rounded mt-0.5" />
                            <div>
                              <span className="text-sm">{feature.name}</span>
                              {depNames && depNames.length > 0 && (
                                <span className="block text-xs text-amber-600">Requires: {depNames.join(', ')}</span>
                              )}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="p-6 border-t flex gap-3 justify-end">
              <button onClick={() => { setEditingFeatures(null); setSelectedFeatures([]) }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
              <button onClick={() => updatePlanFeatures.mutate(editingFeatures)} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700" disabled={updatePlanFeatures.isPending}>{updatePlanFeatures.isPending ? 'Saving...' : 'Save Features'}</button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-gray-800">Reset Features to Defaults</h2>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                This will reset the features for <strong>all plans</strong> (both SaaS and Enterprise) back to the factory defaults. Any custom feature changes you've made will be lost.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  data-testid="button-cancel-reset"
                >
                  Cancel
                </button>
                <button
                  onClick={() => resetFeatures.mutate()}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                  disabled={resetFeatures.isPending}
                  data-testid="button-confirm-reset"
                >
                  {resetFeatures.isPending ? 'Resetting...' : 'Reset to Defaults'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

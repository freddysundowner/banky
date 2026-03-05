import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

async function fetchBranding() {
  const res = await fetch('/api/public/branding')
  if (!res.ok) return { platform_name: 'BANKYKIT' }
  return res.json()
}

function formatPlanType(planType: string): string {
  const labels: Record<string, string> = {
    chama_small_licence: 'Chama Small',
    chama_large_licence: 'Chama Large',
    sacco_small_licence: 'SACCO Small',
    sacco_large_licence: 'SACCO Large',
    mfi_small_licence: 'MFI Small',
    mfi_large_licence: 'MFI Large',
    bank_small_licence: 'Bank Small',
    bank_large_licence: 'Bank Large',
  }
  return labels[planType] || planType
}

function planBadgeClass(planType: string): string {
  if (planType?.startsWith('chama')) return 'bg-green-100 text-green-800'
  if (planType?.startsWith('sacco')) return 'bg-blue-100 text-blue-800'
  if (planType?.startsWith('mfi')) return 'bg-purple-100 text-purple-800'
  if (planType?.startsWith('bank')) return 'bg-yellow-100 text-yellow-800'
  return 'bg-gray-100 text-gray-800'
}

function licenseStatus(license: any): { label: string; className: string } {
  if (!license.is_active) return { label: 'Revoked', className: 'bg-red-100 text-red-800' }
  if (!license.perpetual && license.expires_at && new Date(license.expires_at) < new Date()) {
    return { label: 'Expired', className: 'bg-orange-100 text-orange-800' }
  }
  return { label: 'Active', className: 'bg-green-100 text-green-800' }
}

export default function Licenses() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [isPerpetual, setIsPerpetual] = useState(false)
  const [formData, setFormData] = useState({
    plan_type: 'sacco_small_licence',
    organization_name: '',
    contact_email: '',
    expires_in_years: 1,
    notes: ''
  })

  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: fetchBranding,
  })

  const platformName = branding?.platform_name || 'BANKYKIT'

  const { data: enterprisePlans } = useQuery({
    queryKey: ['enterprise-plans'],
    queryFn: async () => {
      const res = await fetch('/api/admin/enterprise-plans', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load enterprise plans')
      return res.json()
    }
  })

  const { data: licenses, isLoading } = useQuery({
    queryKey: ['licenses'],
    queryFn: async () => {
      const res = await fetch('/api/admin/licenses', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load licenses')
      return res.json()
    }
  })

  const createLicense = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        perpetual: isPerpetual,
        expires_in_years: isPerpetual ? null : formData.expires_in_years
      }
      const res = await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Failed to create license')
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] })
      setShowCreate(false)
      setFormData({ plan_type: 'sacco_small_licence', organization_name: '', contact_email: '', expires_in_years: 1, notes: '' })
      setIsPerpetual(false)
      toast.success(`License created: ${data.license_key}`)
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create license')
    }
  })

  const toggleLicense = useMutation({
    mutationFn: async ({ id, is_active }: { id: string, is_active: boolean }) => {
      const res = await fetch(`/api/admin/licenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active })
      })
      if (!res.ok) throw new Error('Failed to update license')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] })
    }
  })

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Enterprise Licenses</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          Generate License
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Generate New License</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Institution Plan</label>
              <select
                value={formData.plan_type}
                onChange={(e) => setFormData({ ...formData, plan_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {enterprisePlans ? enterprisePlans.map((p: any) => (
                  <option key={p.plan_type} value={p.plan_type}>
                    {p.name} {p.price ? `(KES ${p.price.toLocaleString()})` : ''}
                  </option>
                )) : (
                  <>
                    <option value="chama_small_licence">Chama Small</option>
                    <option value="chama_large_licence">Chama Large</option>
                    <option value="sacco_small_licence">SACCO Small</option>
                    <option value="sacco_large_licence">SACCO Large</option>
                    <option value="mfi_small_licence">MFI Small</option>
                    <option value="mfi_large_licence">MFI Large</option>
                    <option value="bank_small_licence">Bank Small</option>
                    <option value="bank_large_licence">Bank Large</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
              <select
                value={isPerpetual ? 'perpetual' : formData.expires_in_years}
                onChange={(e) => {
                  if (e.target.value === 'perpetual') {
                    setIsPerpetual(true)
                  } else {
                    setIsPerpetual(false)
                    setFormData({ ...formData, expires_in_years: parseInt(e.target.value) })
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value={1}>1 Year</option>
                <option value={2}>2 Years</option>
                <option value={3}>3 Years</option>
                <option value={5}>5 Years</option>
                <option value="perpetual">Perpetual</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
              <input
                type="text"
                value={formData.organization_name}
                onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Customer organization"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="customer@example.com"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={2}
                placeholder="Internal notes about this license"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => createLicense.mutate()}
              disabled={createLicense.isPending}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {createLicense.isPending ? 'Generating...' : 'Generate License'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">License Key</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issued</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {licenses?.map((license: any) => {
              const status = licenseStatus(license)
              return (
                <tr key={license.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm">{license.license_key}</code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${planBadgeClass(license.plan_type)}`}>
                      {formatPlanType(license.plan_type)}
                    </span>
                    {license.perpetual && (
                      <span className="ml-1 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">Perpetual</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{license.organization_name || '-'}</div>
                    <div className="text-sm text-gray-500">{license.contact_email || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {license.issued_at ? new Date(license.issued_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {license.perpetual ? 'Never' : license.expires_at ? new Date(license.expires_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => toggleLicense.mutate({ id: license.id, is_active: !license.is_active })}
                      className={`text-sm ${license.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                    >
                      {license.is_active ? 'Revoke' : 'Activate'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {(!licenses || licenses.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            No licenses generated yet
          </div>
        )}
      </div>

      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="font-semibold text-blue-800 mb-2">How Enterprise Licenses Work</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>1. Generate a license key for your customer, selecting the institution type and plan size</li>
          <li>2. Customer installs {platformName} on their own server</li>
          <li>3. Customer sets DEPLOYMENT_MODE=enterprise in their environment</li>
          <li>4. Customer enters the license key in the app on first login</li>
          <li>5. The system validates the key and enables features based on the institution plan</li>
          <li>6. Features always reflect the current plan definition — no stale snapshots</li>
        </ul>
      </div>
    </div>
  )
}

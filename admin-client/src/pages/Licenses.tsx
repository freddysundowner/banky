import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

async function fetchBranding() {
  const res = await fetch('/api/public/branding')
  if (!res.ok) return { platform_name: 'BANKY' }
  return res.json()
}

export default function Licenses() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [formData, setFormData] = useState({
    edition: 'standard',
    organization_name: '',
    contact_email: '',
    expires_in_years: 1,
    notes: ''
  })

  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: fetchBranding,
  })

  const platformName = branding?.platform_name || 'BANKY'

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
      const res = await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      })
      if (!res.ok) throw new Error('Failed to create license')
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] })
      setShowCreate(false)
      setFormData({ edition: 'standard', organization_name: '', contact_email: '', expires_in_years: 1, notes: '' })
      toast.success(`License created: ${data.license_key}`)
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Edition</label>
              <select
                value={formData.edition}
                onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="basic">Basic ($10,000)</option>
                <option value="standard">Standard ($20,000)</option>
                <option value="premium">Premium ($35,000)</option>
                <option value="enterprise">Enterprise ($50,000+)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expires In (Years)</label>
              <select
                value={formData.expires_in_years}
                onChange={(e) => setFormData({ ...formData, expires_in_years: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value={1}>1 Year</option>
                <option value={2}>2 Years</option>
                <option value={3}>3 Years</option>
                <option value={5}>5 Years</option>
                <option value={99}>Perpetual</option>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Edition</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issued</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {licenses?.map((license: any) => (
              <tr key={license.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">{license.license_key}</code>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium capitalize ${
                    license.edition === 'enterprise' ? 'bg-yellow-100 text-yellow-800' :
                    license.edition === 'premium' ? 'bg-purple-100 text-purple-800' :
                    license.edition === 'standard' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {license.edition}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{license.organization_name || '-'}</div>
                  <div className="text-sm text-gray-500">{license.contact_email || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {license.issued_at ? new Date(license.issued_at).toLocaleDateString() : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {license.expires_at ? new Date(license.expires_at).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    license.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {license.is_active ? 'Active' : 'Revoked'}
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
            ))}
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
          <li>1. Generate a license key for your customer</li>
          <li>2. Customer installs {platformName} on their own server</li>
          <li>3. Customer sets LICENSE_KEY={platformName.toUpperCase()}-XXX-XXXX-XXXX in their environment</li>
          <li>4. Customer sets DEPLOYMENT_MODE=enterprise in their environment</li>
          <li>5. The system validates the license and enables features based on edition</li>
        </ul>
      </div>
    </div>
  )
}

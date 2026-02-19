import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface Setting {
  key: string
  value: string
  type: string
  description: string
}

interface Plan {
  id: string
  name: string
  plan_type: string
}

type TabType = 'general' | 'payments' | 'email' | 'appearance' | 'legal'

async function fetchSettings() {
  const res = await fetch('/api/admin/settings', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

async function updateSettings(updates: Record<string, string>) {
  const res = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updates)
  })
  if (!res.ok) throw new Error('Failed to update settings')
  return res.json()
}

export default function Settings() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('general')
  const [paymentSubTab, setPaymentSubTab] = useState<'mpesa' | 'stripe' | 'paystack'>('mpesa')

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setHasChanges(false)
      toast.success('Settings saved successfully!')
    }
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const settings: Setting[] = data?.settings || []
  const plans: Plan[] = data?.plans || []

  const getValue = (key: string) => {
    if (formData[key] !== undefined) return formData[key]
    const setting = settings.find(s => s.key === key)
    return setting?.value || ''
  }

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = () => {
    mutation.mutate(formData)
  }

  const tabs = [
    { id: 'general' as TabType, label: 'General', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )},
    { id: 'payments' as TabType, label: 'Payments', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )},
    { id: 'email' as TabType, label: 'Email', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )},
    { id: 'appearance' as TabType, label: 'Appearance', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    )},
    { id: 'legal' as TabType, label: 'Legal Pages', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure your platform settings and preferences</p>
        </div>
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="bg-primary-600 text-white px-5 py-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2 font-medium shadow-sm"
          >
            {mutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Changes
              </>
            )}
          </button>
        )}
      </div>

      <div className="flex gap-6">
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6">
            {activeTab === 'general' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Platform Identity
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Basic platform configuration</p>
                </div>

                <div className="grid gap-6">
                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Platform Name
                    </label>
                    <input
                      type="text"
                      value={getValue('platform_name')}
                      onChange={(e) => handleChange('platform_name', e.target.value)}
                      placeholder="BANKY"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                    />
                    <p className="text-sm text-gray-500 mt-2">Displayed across all parts of the system</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-8">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Subscription Defaults
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Default settings for new organizations</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Plan
                    </label>
                    <select
                      value={getValue('default_plan_id')}
                      onChange={(e) => handleChange('default_plan_id', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                    >
                      <option value="">Select a plan...</option>
                      {plans.map(plan => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} ({plan.plan_type})
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-gray-500 mt-2">Auto-assigned to new organizations</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Trial Period
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={getValue('trial_days')}
                        onChange={(e) => handleChange('trial_days', e.target.value)}
                        min="0"
                        max="365"
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                      />
                      <span className="text-gray-500 text-sm font-medium">days</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Free trial before billing starts</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="space-y-6">
                <div className="border-b border-gray-200">
                  <nav className="flex gap-1" aria-label="Payment tabs">
                    {[
                      { id: 'mpesa' as const, label: 'M-Pesa', color: 'text-green-600' },
                      { id: 'stripe' as const, label: 'Stripe', color: 'text-blue-600' },
                      { id: 'paystack' as const, label: 'Paystack', color: 'text-teal-600' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setPaymentSubTab(tab.id)}
                        className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                          paymentSubTab === tab.id
                            ? `${tab.color} border-b-2 border-current bg-white`
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </nav>
                </div>

                {paymentSubTab === 'mpesa' && (() => {
                  const mpesaEnabled = getValue('gateway_mpesa_enabled') === 'true' || getValue('gateway_mpesa_enabled') === '';
                  return (
                  <div className="space-y-6">
                    <div className={`rounded-lg border-2 p-4 transition-all ${mpesaEnabled ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">Enable M-Pesa Gateway</h3>
                          <p className="text-xs text-gray-500">KES - Show M-Pesa as a payment option on the upgrade page</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleChange('gateway_mpesa_enabled', mpesaEnabled ? 'false' : 'true')}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${mpesaEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${mpesaEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </div>

                    <div className="bg-green-50 rounded-lg p-5 border border-green-100">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-green-900">About SunPay</h4>
                          <p className="text-sm text-green-700 mt-1">
                            SunPay provides a simplified M-Pesa integration for processing subscription payments. 
                            This is a <strong>platform-level</strong> API key, separate from individual organization M-Pesa settings.
                            Get your API key at <a href="https://sunpay.co.ke" target="_blank" rel="noopener noreferrer" className="underline font-medium">sunpay.co.ke</a>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6">
                      <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                        <label className="block text-sm font-medium text-gray-700 mb-2">SunPay API Key</label>
                        <input
                          type="password"
                          value={getValue('subscription_sunpay_api_key')}
                          onChange={(e) => handleChange('subscription_sunpay_api_key', e.target.value)}
                          placeholder="Enter your SunPay API key..."
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white font-mono text-sm"
                        />
                        <p className="text-sm text-gray-500 mt-2">Used to process M-Pesa STK Push payments when organizations subscribe or upgrade their plans</p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                        <label className="block text-sm font-medium text-gray-700 mb-2">M-Pesa Paybill / Till Number</label>
                        <input
                          type="text"
                          value={getValue('subscription_mpesa_paybill')}
                          onChange={(e) => handleChange('subscription_mpesa_paybill', e.target.value)}
                          placeholder="e.g. 174379"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                        />
                        <p className="text-sm text-gray-500 mt-2">Displayed to customers on payment receipts (optional)</p>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-6">
                      <h3 className="text-md font-semibold text-gray-900 mb-3">How M-Pesa Works</h3>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                        <li>An organization owner goes to <strong>Subscription Plans</strong> and selects a plan</li>
                        <li>They choose <strong>M-Pesa</strong> as payment method and enter their phone number</li>
                        <li>An STK Push prompt is sent to their phone via SunPay</li>
                        <li>After entering their M-Pesa PIN, a webhook confirms the payment</li>
                        <li>The subscription is automatically activated for the plan's billing period</li>
                      </ol>
                    </div>
                  </div>
                  );
                })()}

                {paymentSubTab === 'stripe' && (() => {
                  const stripeEnabled = getValue('gateway_stripe_enabled') === 'true' || getValue('gateway_stripe_enabled') === '';
                  return (
                  <div className="space-y-6">
                    <div className={`rounded-lg border-2 p-4 transition-all ${stripeEnabled ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">Enable Stripe Gateway</h3>
                          <p className="text-xs text-gray-500">USD - Show Stripe card payments on the upgrade page</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleChange('gateway_stripe_enabled', stripeEnabled ? 'false' : 'true')}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${stripeEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${stripeEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-6">
                      <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Stripe Secret Key</label>
                        <input
                          type="password"
                          value={getValue('stripe_secret_key')}
                          onChange={(e) => handleChange('stripe_secret_key', e.target.value)}
                          placeholder="sk_live_..."
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white font-mono text-sm"
                        />
                        <p className="text-sm text-gray-500 mt-2">Get your API keys from <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="underline font-medium text-blue-600">Stripe Dashboard</a></p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Stripe Publishable Key</label>
                        <input
                          type="text"
                          value={getValue('stripe_publishable_key')}
                          onChange={(e) => handleChange('stripe_publishable_key', e.target.value)}
                          placeholder="pk_live_..."
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white font-mono text-sm"
                        />
                        <p className="text-sm text-gray-500 mt-2">Used on the frontend for Stripe checkout (optional)</p>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-6">
                      <h3 className="text-md font-semibold text-gray-900 mb-3">How Stripe Works</h3>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                        <li>An organization owner selects a plan and chooses <strong>Card Payment</strong></li>
                        <li>They are redirected to Stripe's secure checkout page</li>
                        <li>After entering card details and completing payment, a webhook confirms it</li>
                        <li>The subscription is automatically activated for the plan's billing period</li>
                      </ol>
                    </div>
                  </div>
                  );
                })()}

                {paymentSubTab === 'paystack' && (() => {
                  const paystackEnabled = getValue('gateway_paystack_enabled') === 'true' || getValue('gateway_paystack_enabled') === '';
                  return (
                  <div className="space-y-6">
                    <div className={`rounded-lg border-2 p-4 transition-all ${paystackEnabled ? 'border-teal-300 bg-teal-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">Enable Paystack Gateway</h3>
                          <p className="text-xs text-gray-500">Show Paystack as a payment option on the upgrade page</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleChange('gateway_paystack_enabled', paystackEnabled ? 'false' : 'true')}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${paystackEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${paystackEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-6">
                      <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Paystack Currency</label>
                        <select
                          value={getValue('paystack_currency') || 'NGN'}
                          onChange={(e) => handleChange('paystack_currency', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                        >
                          <option value="NGN">NGN - Nigerian Naira</option>
                          <option value="KES">KES - Kenyan Shilling</option>
                          <option value="GHS">GHS - Ghanaian Cedi</option>
                          <option value="ZAR">ZAR - South African Rand</option>
                          <option value="USD">USD - US Dollar</option>
                        </select>
                        <p className="text-sm text-gray-500 mt-2">Currency used for all Paystack transactions. Prices are auto-converted from USD at current exchange rates.</p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Paystack Secret Key</label>
                        <input
                          type="password"
                          value={getValue('paystack_secret_key')}
                          onChange={(e) => handleChange('paystack_secret_key', e.target.value)}
                          placeholder="sk_live_..."
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white font-mono text-sm"
                        />
                        <p className="text-sm text-gray-500 mt-2">Get your API keys from <a href="https://dashboard.paystack.com/#/settings/developer" target="_blank" rel="noopener noreferrer" className="underline font-medium text-teal-600">Paystack Dashboard</a></p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Paystack Public Key</label>
                        <input
                          type="text"
                          value={getValue('paystack_public_key')}
                          onChange={(e) => handleChange('paystack_public_key', e.target.value)}
                          placeholder="pk_live_..."
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white font-mono text-sm"
                        />
                        <p className="text-sm text-gray-500 mt-2">Used on the frontend for Paystack inline checkout (optional)</p>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-6">
                      <h3 className="text-md font-semibold text-gray-900 mb-3">How Paystack Works</h3>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                        <li>An organization owner selects a plan and chooses <strong>Paystack</strong></li>
                        <li>They are redirected to Paystack's secure payment page</li>
                        <li>After completing payment (card, bank transfer, or USSD), a webhook confirms it</li>
                        <li>The subscription is automatically activated for the plan's billing period</li>
                      </ol>
                    </div>
                  </div>
                  );
                })()}
              </div>
            )}

            {activeTab === 'email' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                    </svg>
                    Contact Addresses
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Email addresses for customer communications</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Support Email
                    </label>
                    <input
                      type="email"
                      value={getValue('support_email')}
                      onChange={(e) => handleChange('support_email', e.target.value)}
                      placeholder="support@example.com"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                    />
                    <p className="text-sm text-gray-500 mt-2">For customer support inquiries</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Sales Email
                    </label>
                    <input
                      type="email"
                      value={getValue('sales_email')}
                      onChange={(e) => handleChange('sales_email', e.target.value)}
                      placeholder="sales@example.com"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                    />
                    <p className="text-sm text-gray-500 mt-2">For enterprise sales inquiries</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-8">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Email Service (Brevo)
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Configure email delivery for notifications and inquiries</p>
                </div>

                <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-blue-900">About Brevo</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Brevo (formerly Sendinblue) is used to send transactional emails like sales inquiries and notifications. 
                        Get a free API key at <a href="https://brevo.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">brevo.com</a>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brevo API Key
                  </label>
                  <input
                    type="password"
                    value={getValue('brevo_api_key')}
                    onChange={(e) => handleChange('brevo_api_key', e.target.value)}
                    placeholder="xkeysib-..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white font-mono text-sm"
                  />
                  <p className="text-sm text-gray-500 mt-2">Required for sending emails via Brevo</p>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    Theme Colors
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Customize the color scheme of the platform</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Primary Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={getValue('theme_primary_color') || '#2563eb'}
                        onChange={(e) => handleChange('theme_primary_color', e.target.value)}
                        className="w-14 h-10 rounded-lg border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={getValue('theme_primary_color') || '#2563eb'}
                        onChange={(e) => handleChange('theme_primary_color', e.target.value)}
                        placeholder="#2563eb"
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white font-mono text-sm"
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Buttons, links, and primary actions</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Secondary Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={getValue('theme_secondary_color') || '#64748b'}
                        onChange={(e) => handleChange('theme_secondary_color', e.target.value)}
                        className="w-14 h-10 rounded-lg border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={getValue('theme_secondary_color') || '#64748b'}
                        onChange={(e) => handleChange('theme_secondary_color', e.target.value)}
                        placeholder="#64748b"
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white font-mono text-sm"
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Secondary elements and text</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Accent Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={getValue('theme_accent_color') || '#10b981'}
                        onChange={(e) => handleChange('theme_accent_color', e.target.value)}
                        className="w-14 h-10 rounded-lg border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={getValue('theme_accent_color') || '#10b981'}
                        onChange={(e) => handleChange('theme_accent_color', e.target.value)}
                        placeholder="#10b981"
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white font-mono text-sm"
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Success states and highlights</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Sidebar Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={getValue('theme_sidebar_color') || '#1e293b'}
                        onChange={(e) => handleChange('theme_sidebar_color', e.target.value)}
                        className="w-14 h-10 rounded-lg border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={getValue('theme_sidebar_color') || '#1e293b'}
                        onChange={(e) => handleChange('theme_sidebar_color', e.target.value)}
                        placeholder="#1e293b"
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white font-mono text-sm"
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Navigation sidebar background</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-8">
                  <h3 className="text-md font-semibold text-gray-900 mb-4">Color Preview</h3>
                  <div className="bg-gray-100 rounded-xl p-6">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex flex-col items-center gap-2">
                        <div 
                          className="w-20 h-12 rounded-lg shadow-sm flex items-center justify-center text-white text-xs font-medium"
                          style={{ backgroundColor: getValue('theme_primary_color') || '#2563eb' }}
                        >
                          Primary
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div 
                          className="w-20 h-12 rounded-lg shadow-sm flex items-center justify-center text-white text-xs font-medium"
                          style={{ backgroundColor: getValue('theme_secondary_color') || '#64748b' }}
                        >
                          Secondary
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div 
                          className="w-20 h-12 rounded-lg shadow-sm flex items-center justify-center text-white text-xs font-medium"
                          style={{ backgroundColor: getValue('theme_accent_color') || '#10b981' }}
                        >
                          Accent
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div 
                          className="w-20 h-12 rounded-lg shadow-sm flex items-center justify-center text-white text-xs font-medium"
                          style={{ backgroundColor: getValue('theme_sidebar_color') || '#1e293b' }}
                        >
                          Sidebar
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full"
                          style={{ backgroundColor: getValue('theme_sidebar_color') || '#1e293b' }}
                        ></div>
                        <div className="flex-1">
                          <div className="h-2 bg-gray-200 rounded w-32"></div>
                          <div className="h-2 bg-gray-100 rounded w-24 mt-2"></div>
                        </div>
                        <button 
                          className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                          style={{ backgroundColor: getValue('theme_primary_color') || '#2563eb' }}
                        >
                          Button
                        </button>
                        <span 
                          className="text-sm font-medium"
                          style={{ color: getValue('theme_accent_color') || '#10b981' }}
                        >
                          Success
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'legal' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Legal Pages
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Manage Terms of Service and Privacy Policy content displayed on your landing page and app</p>
                </div>

                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Terms of Service
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Last updated:</span>
                        <input
                          type="text"
                          value={getValue('terms_last_updated')}
                          onChange={(e) => handleChange('terms_last_updated', e.target.value)}
                          placeholder="e.g. February 2026"
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white w-48"
                        />
                      </div>
                    </div>
                    {!getValue('terms_of_service') && (
                      <button
                        type="button"
                        onClick={() => {
                          handleChange('terms_of_service', `<section>\n<h2>1. Acceptance of Terms</h2>\n<p>By accessing or using this platform ("the Service"), you agree to be bound by these Terms of Service.</p>\n</section>\n\n<section>\n<h2>2. Description of Service</h2>\n<p>This platform provides a cloud-based banking and Sacco management platform that enables organizations to manage members, loans, savings, fixed deposits, dividends, and other financial operations.</p>\n</section>\n\n<section>\n<h2>3. Account Registration</h2>\n<p>To use the Service, you must create an account and provide accurate, complete information. You are responsible for maintaining the confidentiality of your account credentials and all activities that occur under your account.</p>\n</section>\n\n<section>\n<h2>4. Subscription Plans &amp; Billing</h2>\n<p>The Service offers multiple subscription tiers. Subscriptions renew automatically unless cancelled. Prices are denominated in USD. Refunds are handled on a case-by-case basis within 30 days of payment.</p>\n</section>\n\n<section>\n<h2>5. Data Ownership &amp; Privacy</h2>\n<p>You retain all ownership rights to your data. Each organization's data is stored in an isolated database. We will not access, share, or sell your data except as necessary to provide the Service or as required by law.</p>\n</section>\n\n<section>\n<h2>6. Acceptable Use</h2>\n<p>You agree not to use the Service for any unlawful purpose, attempt unauthorized access, interfere with the Service, or reverse engineer the platform.</p>\n</section>\n\n<section>\n<h2>7. Limitation of Liability</h2>\n<p>To the maximum extent permitted by law, this platform shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of the Service.</p>\n</section>\n\n<section>\n<h2>8. Changes to Terms</h2>\n<p>We may update these terms from time to time. We will notify you of significant changes via email or in-app notification at least 30 days before they take effect.</p>\n</section>`);
                          if (!getValue('terms_last_updated')) handleChange('terms_last_updated', 'February 2026');
                        }}
                        className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Load default Terms of Service
                      </button>
                    )}
                    <textarea
                      value={getValue('terms_of_service')}
                      onChange={(e) => handleChange('terms_of_service', e.target.value)}
                      placeholder="Enter your Terms of Service content here. You can use HTML tags for formatting (e.g. <h2>, <p>, <ul>, <li>, <strong>)."
                      rows={20}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white font-mono text-sm leading-relaxed"
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      Use HTML for formatting. Supported tags: &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;ol&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;a&gt;.
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Privacy Policy
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Last updated:</span>
                        <input
                          type="text"
                          value={getValue('privacy_last_updated')}
                          onChange={(e) => handleChange('privacy_last_updated', e.target.value)}
                          placeholder="e.g. February 2026"
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white w-48"
                        />
                      </div>
                    </div>
                    {!getValue('privacy_policy') && (
                      <button
                        type="button"
                        onClick={() => {
                          handleChange('privacy_policy', `<section>\n<h2>1. Introduction</h2>\n<p>We are committed to protecting the privacy of our users. This Privacy Policy explains how we collect, use, store, and protect information when you use our platform.</p>\n</section>\n\n<section>\n<h2>2. Information We Collect</h2>\n<p>We collect account information (name, email, phone), organizational data (member records, transactions, staff data), and usage data (login activity, feature usage).</p>\n</section>\n\n<section>\n<h2>3. Data Isolation &amp; Security</h2>\n<p>Each organization's data is stored in a completely separate, isolated database. Data is encrypted at rest and in transit. Role-based access control and audit logging are enforced.</p>\n</section>\n\n<section>\n<h2>4. How We Use Your Data</h2>\n<p>We use your data to provide and maintain the Service, process transactions, send important notifications, provide support, and improve the Service based on anonymized usage patterns.</p>\n</section>\n\n<section>\n<h2>5. Data Sharing</h2>\n<p>We do not sell or rent your data. We may share data only with payment processors, SMS providers, infrastructure providers, or when required by law.</p>\n</section>\n\n<section>\n<h2>6. Your Rights</h2>\n<p>You have the right to access, correct, delete, and export your data. You may withdraw consent for optional data processing at any time.</p>\n</section>\n\n<section>\n<h2>7. Changes to This Policy</h2>\n<p>We may update this Privacy Policy from time to time. We will notify you of significant changes at least 30 days before they take effect.</p>\n</section>`);
                          if (!getValue('privacy_last_updated')) handleChange('privacy_last_updated', 'February 2026');
                        }}
                        className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Load default Privacy Policy
                      </button>
                    )}
                    <textarea
                      value={getValue('privacy_policy')}
                      onChange={(e) => handleChange('privacy_policy', e.target.value)}
                      placeholder="Enter your Privacy Policy content here. You can use HTML tags for formatting (e.g. <h2>, <p>, <ul>, <li>, <strong>)."
                      rows={20}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white font-mono text-sm leading-relaxed"
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      Use HTML for formatting. Supported tags: &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;ol&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;a&gt;.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

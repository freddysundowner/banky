import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface LandingSettings {
  landing_hero_title: string
  landing_hero_subtitle: string
  landing_hero_badge: string
  landing_cta_primary_text: string
  landing_cta_primary_url: string
  landing_cta_secondary_text: string
  landing_cta_secondary_url: string
  landing_demo_video_url: string
  landing_app_url: string
  landing_stats_saccos: string
  landing_stats_transactions: string
  landing_stats_members: string
  landing_stats_uptime: string
}

type TabType = 'hero' | 'cta' | 'stats' | 'urls'

const tabs: { id: TabType; label: string; icon: string }[] = [
  { id: 'hero', label: 'Hero Section', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  { id: 'cta', label: 'Call to Action', icon: 'M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122' },
  { id: 'stats', label: 'Statistics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'urls', label: 'URLs', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
]

export default function LandingPageSettings() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('hero')
  const [formData, setFormData] = useState<LandingSettings>({
    landing_hero_title: '',
    landing_hero_subtitle: '',
    landing_hero_badge: '',
    landing_cta_primary_text: '',
    landing_cta_primary_url: '',
    landing_cta_secondary_text: '',
    landing_cta_secondary_url: '',
    landing_demo_video_url: '',
    landing_app_url: '',
    landing_stats_saccos: '',
    landing_stats_transactions: '',
    landing_stats_members: '',
    landing_stats_uptime: ''
  })
  const [saved, setSaved] = useState(false)

  const { data: settings, isLoading } = useQuery<LandingSettings>({
    queryKey: ['landing-page-settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/landing-page', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load settings')
      return res.json()
    }
  })

  useEffect(() => {
    if (settings) {
      setFormData(settings)
    }
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: async (data: LandingSettings) => {
      const res = await fetch('/api/admin/landing-page', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to save settings')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-page-settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(formData)
  }

  const handleChange = (key: keyof LandingSettings, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Landing Page</h1>
        <p className="text-sm text-gray-500">Customize the content displayed on your landing page</p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 bg-primary-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6">
            {activeTab === 'hero' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Badge Text</label>
                  <input
                    type="text"
                    value={formData.landing_hero_badge}
                    onChange={e => handleChange('landing_hero_badge', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g. Trusted by 500+ Saccos in East Africa"
                  />
                  <p className="text-xs text-gray-500 mt-1">Small text displayed above the main title</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Main Title</label>
                  <input
                    type="text"
                    value={formData.landing_hero_title}
                    onChange={e => handleChange('landing_hero_title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g. The Complete Banking Platform for Saccos"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                  <textarea
                    value={formData.landing_hero_subtitle}
                    onChange={e => handleChange('landing_hero_subtitle', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Brief description of your product"
                  />
                </div>
              </div>
            )}

            {activeTab === 'cta' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700">Primary Button</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
                      <input
                        type="text"
                        value={formData.landing_cta_primary_text}
                        onChange={e => handleChange('landing_cta_primary_text', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="e.g. Start Free Trial"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Link URL</label>
                      <input
                        type="text"
                        value={formData.landing_cta_primary_url}
                        onChange={e => handleChange('landing_cta_primary_url', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="e.g. #pricing or /register"
                      />
                    </div>
                  </div>
                  <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700">Secondary Button</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
                      <input
                        type="text"
                        value={formData.landing_cta_secondary_text}
                        onChange={e => handleChange('landing_cta_secondary_text', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="e.g. Watch Demo"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Link URL</label>
                      <input
                        type="text"
                        value={formData.landing_cta_secondary_url}
                        onChange={e => handleChange('landing_cta_secondary_url', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="e.g. https://youtube.com/watch?v=..."
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Demo Video URL (Optional)</label>
                  <input
                    type="text"
                    value={formData.landing_demo_video_url}
                    onChange={e => handleChange('landing_demo_video_url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="YouTube or Vimeo embed URL"
                  />
                  <p className="text-xs text-gray-500 mt-1">If set, clicking "Watch Demo" will open a video modal</p>
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-4">These statistics are displayed in the hero section to build trust with visitors.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Saccos Count</label>
                    <input
                      type="text"
                      value={formData.landing_stats_saccos}
                      onChange={e => handleChange('landing_stats_saccos', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="e.g. 500+"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Transactions Processed</label>
                    <input
                      type="text"
                      value={formData.landing_stats_transactions}
                      onChange={e => handleChange('landing_stats_transactions', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="e.g. KES 2B+"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Members</label>
                    <input
                      type="text"
                      value={formData.landing_stats_members}
                      onChange={e => handleChange('landing_stats_members', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="e.g. 1M+"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">System Uptime</label>
                    <input
                      type="text"
                      value={formData.landing_stats_uptime}
                      onChange={e => handleChange('landing_stats_uptime', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="e.g. 99.9%"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'urls' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Main App URL</label>
                  <input
                    type="text"
                    value={formData.landing_app_url}
                    onChange={e => handleChange('landing_app_url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g. https://app.banky.co.ke"
                  />
                  <p className="text-xs text-gray-500 mt-1">URL shown in the browser mockup on the hero section</p>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50 rounded-b-lg">
            {saved ? (
              <div className="flex items-center gap-2 text-green-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Settings saved successfully!
              </div>
            ) : (
              <div></div>
            )}
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              {saveMutation.isPending && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

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
  landing_docs_mode: string
  landing_docs_codecanyon_title: string
  landing_docs_codecanyon_subtitle: string
  landing_docs_direct_title: string
  landing_docs_direct_subtitle: string
  landing_docs_support_email: string
  landing_docs_show_license: string
  landing_show_subscription_content: string
}

interface FeatureItem {
  title: string
  description: string
  icon: string
  color: string
}

interface TestimonialItem {
  name: string
  role: string
  organization: string
  quote: string
  rating: number
}

interface FAQItem {
  question: string
  answer: string
}

interface HowItWorksItem {
  title: string
  description: string
  color: string
}

interface CTASectionData {
  heading: string
  subheading: string
  primary_button_text: string
  secondary_button_text: string
}

type TabType = 'hero' | 'cta' | 'stats' | 'urls' | 'features' | 'testimonials' | 'faq' | 'how_it_works' | 'cta_section' | 'docs'

const ICON_OPTIONS = [
  'Users', 'DollarSign', 'CreditCard', 'Wallet', 'UserPlus', 'BookOpen',
  'LayoutGrid', 'Bell', 'Shield', 'BarChart3', 'Building2', 'Database',
  'Briefcase', 'Smartphone', 'Globe', 'Lock', 'Settings', 'TrendingUp',
  'PieChart', 'FileText', 'Mail', 'Phone', 'Map', 'Award'
]

const COLOR_OPTIONS = [
  'blue', 'green', 'purple', 'orange', 'pink', 'teal',
  'indigo', 'red', 'cyan', 'lime', 'amber', 'rose', 'violet'
]

const tabs: { id: TabType; label: string }[] = [
  { id: 'hero', label: 'Hero' },
  { id: 'cta', label: 'Buttons' },
  { id: 'stats', label: 'Stats' },
  { id: 'urls', label: 'URLs' },
  { id: 'features', label: 'Features' },
  { id: 'testimonials', label: 'Testimonials' },
  { id: 'faq', label: 'FAQ' },
  { id: 'how_it_works', label: 'How It Works' },
  { id: 'cta_section', label: 'CTA Section' },
  { id: 'docs', label: 'Docs Page' },
]

const DEFAULT_FEATURES: FeatureItem[] = [
  { icon: 'Users', title: 'Member Management', description: 'Register members in seconds. Track KYC documents, next-of-kin, shares, and account status -- whether you have 20 members or 200,000.', color: 'blue' },
  { icon: 'DollarSign', title: 'Loan Management', description: 'Create unlimited loan products with custom interest rates, terms, and repayment schedules. Disburse via M-Pesa, bank, or cash -- and track every shilling.', color: 'green' },
  { icon: 'CreditCard', title: 'Savings & Shares', description: 'Multiple account types for savings, shares, and special deposits. Automatic interest calculations and seamless member withdrawals.', color: 'purple' },
  { icon: 'Wallet', title: 'Fixed Deposits', description: 'Offer competitive fixed deposit products with automatic maturity tracking, interest accrual, and flexible rollover options.', color: 'orange' },
  { icon: 'UserPlus', title: 'Dividends & Profit Sharing', description: 'Declare dividends, calculate payouts based on share balances, and distribute to members -- perfect for Saccos and chama profit-sharing.', color: 'pink' },
  { icon: 'BookOpen', title: 'Full Accounting Suite', description: 'Double-entry bookkeeping that runs itself. Chart of Accounts, journal entries, Trial Balance, Income Statement, and Balance Sheet -- all automated.', color: 'teal' },
  { icon: 'LayoutGrid', title: 'Teller Station', description: 'A dedicated counter interface for daily operations. Process deposits, withdrawals, and repayments with real-time cash float tracking.', color: 'indigo' },
  { icon: 'Smartphone', title: 'M-Pesa Integration', description: 'Accept deposits, disburse loans, and collect repayments via M-Pesa STK Push. Your members transact from their phones, you reconcile automatically.', color: 'green' },
  { icon: 'Bell', title: 'SMS & Notifications', description: 'Keep members informed with automated SMS alerts for every transaction, loan approval, due date reminder, and dividend payout.', color: 'red' },
  { icon: 'Shield', title: 'Audit & Compliance', description: 'Every action is logged. Full audit trails with user, timestamp, and change details for regulatory compliance and internal governance.', color: 'cyan' },
  { icon: 'BarChart3', title: 'Real-time Analytics', description: 'Live dashboards showing portfolio performance, loan arrears, member growth, and financial health. Generate regulator reports in one click.', color: 'lime' },
  { icon: 'Building2', title: 'Multi-Branch Operations', description: 'Manage headquarters, branches, and satellite offices from one platform. Role-based access ensures staff see only what they need.', color: 'amber' },
  { icon: 'Briefcase', title: 'HR & Payroll', description: 'Manage employee records, process payroll, track leave, and handle statutory deductions -- with automatic journal entries to your books.', color: 'rose' },
  { icon: 'Database', title: 'Isolated & Secure', description: "Every organization gets its own dedicated database. Your data never mixes with anyone else's. Bank-grade encryption at rest and in transit.", color: 'violet' },
]

const DEFAULT_TESTIMONIALS: TestimonialItem[] = [
  { name: 'James Mwangi', role: 'Chairman', organization: 'Ukulima Sacco', quote: 'We moved 5,000 members from paper ledgers to BANKY in a single weekend. Loan processing that took three days now takes three minutes.', rating: 5 },
  { name: 'Grace Achieng', role: 'General Manager', organization: 'Boresha Sacco', quote: "Our accountant used to spend the first two weeks of every month reconciling spreadsheets. With BANKY's automatic journal entries, she now closes the books in a single day.", rating: 5 },
  { name: 'Peter Kamau', role: 'IT Manager', organization: 'Wekeza Investment Sacco', quote: 'Data security was our biggest concern. Knowing that our member data sits in a completely isolated database gave our board the confidence to go digital.', rating: 5 },
  { name: 'Amina Hassan', role: 'Treasurer', organization: 'Maisha Chama Group', quote: 'Our chama had 30 members and a WhatsApp group for records. BANKY gave us a proper system with loan tracking, savings accounts, and dividend calculations.', rating: 5 },
  { name: 'David Ochieng', role: 'CEO', organization: 'Pamoja Microfinance', quote: 'We evaluated six different systems before choosing BANKY. The dividend calculation, fixed deposit module, and teller station put it miles ahead.', rating: 5 },
  { name: 'Sarah Wambui', role: 'Finance Manager', organization: 'Umoja Community Sacco', quote: "Our board now has real-time visibility into portfolio performance. Generating regulator reports used to take a week. Now it's one click.", rating: 5 },
  { name: 'Faith Njeri', role: 'Operations Director', organization: 'Fanaka Savings Sacco', quote: 'The teller station transformed our branch operations. Each teller has their own float, every transaction is accountable.', rating: 5 },
]

const DEFAULT_FAQ: FAQItem[] = [
  { question: 'Is BANKY right for my chama or small group?', answer: 'Absolutely. Whether you have 15 members or 15,000, BANKY scales with you. Chamas love the loan tracking, savings accounts, M-Pesa integration, and automated dividend sharing.' },
  { question: 'How is BANKY different from a spreadsheet?', answer: 'Spreadsheets break when you grow. BANKY gives you real-time dashboards, automatic interest calculations, M-Pesa integration, SMS notifications, audit trails, and proper double-entry accounting.' },
  { question: 'What is the difference between SaaS and Enterprise?', answer: 'SaaS is hosted by us -- you log in and start using it immediately with monthly billing. Enterprise is a one-time purchase where you install BANKY on your own servers for full control.' },
  { question: 'Does BANKY work with M-Pesa?', answer: 'Yes. Members can deposit, repay loans, and receive disbursements directly via M-Pesa STK Push. Transactions reconcile automatically.' },
  { question: 'Is my data safe and private?', answer: "Every organization gets its own isolated database -- your data is never shared or mixed with anyone else's. We use bank-grade encryption and role-based access control." },
  { question: 'Can I switch from SaaS to Enterprise later?', answer: 'Yes. We can migrate your entire database and member records from our cloud platform to your own self-hosted Enterprise installation.' },
  { question: 'Do you offer training and support?', answer: 'All plans include online training and email support. Growth and Professional plans get priority support. Enterprise customers can request on-site training.' },
  { question: 'What reports can I generate for regulators?', answer: 'BANKY generates Trial Balance, Income Statement, Balance Sheet, loan portfolio reports, member statements, and transaction summaries -- all exportable with a single click.' },
  { question: 'How quickly can we go live?', answer: "Most organizations sign up and process their first transaction within an hour. Larger Saccos migrating historical data typically go live within a week." },
]

const DEFAULT_HOW_IT_WORKS: HowItWorksItem[] = [
  { title: 'Sign Up in 2 Minutes', description: 'Create your account and set up your bank, Sacco, or chama. No credit card needed. Your dedicated database is provisioned instantly.', color: 'blue' },
  { title: 'Configure Your Way', description: 'Add branches, invite staff, set up loan products, connect M-Pesa, and customize your chart of accounts. The system adapts to how you operate.', color: 'green' },
  { title: 'Go Live & Grow', description: 'Register members, disburse loans, collect deposits, and track everything on real-time dashboards. Your members get SMS updates automatically.', color: 'purple' },
]

const DEFAULT_CTA_SECTION: CTASectionData = {
  heading: 'Stop Managing Finances on Spreadsheets',
  subheading: '500+ banks, Saccos, and chamas have already switched. Start your free trial today and see why they never looked back.',
  primary_button_text: 'Start Free Trial',
  secondary_button_text: 'Schedule a Demo',
}

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
    landing_stats_uptime: '',
    landing_docs_mode: 'both',
    landing_docs_codecanyon_title: 'CodeCanyon Purchase',
    landing_docs_codecanyon_subtitle: 'Installation guide for buyers who purchased BANKY from CodeCanyon marketplace.',
    landing_docs_direct_title: 'Enterprise License',
    landing_docs_direct_subtitle: 'Installation guide for organizations who purchased BANKY directly from our sales team.',
    landing_docs_support_email: 'support@banky.co.ke',
    landing_docs_show_license: 'false',
    landing_show_subscription_content: 'true',
  })
  const [saved, setSaved] = useState(false)

  const [features, setFeatures] = useState<FeatureItem[]>(DEFAULT_FEATURES)
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>(DEFAULT_TESTIMONIALS)
  const [faq, setFaq] = useState<FAQItem[]>(DEFAULT_FAQ)
  const [howItWorks, setHowItWorks] = useState<HowItWorksItem[]>(DEFAULT_HOW_IT_WORKS)
  const [ctaSection, setCtaSection] = useState<CTASectionData>(DEFAULT_CTA_SECTION)

  const { data: settings, isLoading } = useQuery<LandingSettings>({
    queryKey: ['landing-page-settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/landing-page', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load settings')
      return res.json()
    }
  })

  const fetchContent = async (section: string) => {
    const res = await fetch(`/api/admin/landing-content/${section}`, { credentials: 'include' })
    if (!res.ok) return null
    const json = await res.json()
    return json.data
  }

  useEffect(() => {
    if (settings) setFormData(settings)
  }, [settings])

  useEffect(() => {
    const loadContent = async () => {
      const [f, t, fq, h, c] = await Promise.all([
        fetchContent('features'),
        fetchContent('testimonials'),
        fetchContent('faq'),
        fetchContent('how_it_works'),
        fetchContent('cta_section'),
      ])
      if (f) setFeatures(f)
      if (t) setTestimonials(t)
      if (fq) setFaq(fq)
      if (h) setHowItWorks(h)
      if (c) setCtaSection(c)
    }
    loadContent()
  }, [])

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
      showSaved()
    }
  })

  const saveContentMutation = useMutation({
    mutationFn: async ({ section, data }: { section: string; data: unknown }) => {
      const res = await fetch(`/api/admin/landing-content/${section}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ data })
      })
      if (!res.ok) throw new Error('Failed to save content')
      return res.json()
    },
    onSuccess: () => showSaved()
  })

  const showSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (['hero', 'cta', 'stats', 'urls', 'docs'].includes(activeTab)) {
      saveMutation.mutate(formData)
    } else if (activeTab === 'features') {
      saveContentMutation.mutate({ section: 'features', data: features })
    } else if (activeTab === 'testimonials') {
      saveContentMutation.mutate({ section: 'testimonials', data: testimonials })
    } else if (activeTab === 'faq') {
      saveContentMutation.mutate({ section: 'faq', data: faq })
    } else if (activeTab === 'how_it_works') {
      saveContentMutation.mutate({ section: 'how_it_works', data: howItWorks })
    } else if (activeTab === 'cta_section') {
      saveContentMutation.mutate({ section: 'cta_section', data: ctaSection })
    }
  }

  const handleChange = (key: keyof LandingSettings, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const moveItem = <T,>(arr: T[], index: number, dir: 'up' | 'down'): T[] => {
    const newArr = [...arr]
    const target = dir === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= arr.length) return arr
    ;[newArr[index], newArr[target]] = [newArr[target], newArr[index]]
    return newArr
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
  }

  const isPending = saveMutation.isPending || saveContentMutation.isPending

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Landing Page</h1>
        <p className="text-sm text-gray-500">Customize all content displayed on your landing page</p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 bg-primary-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
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
                  <input type="text" value={formData.landing_hero_badge} onChange={e => handleChange('landing_hero_badge', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. Trusted by 500+ organizations worldwide" />
                  <p className="text-xs text-gray-500 mt-1">Small text displayed above the main title</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Main Title</label>
                  <input type="text" value={formData.landing_hero_title} onChange={e => handleChange('landing_hero_title', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. The Banking Software for Saccos, Chamas & Microfinance" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                  <textarea value={formData.landing_hero_subtitle} onChange={e => handleChange('landing_hero_subtitle', e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Brief description of your product" />
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
                      <input type="text" value={formData.landing_cta_primary_text} onChange={e => handleChange('landing_cta_primary_text', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. Start Free Trial" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Link URL</label>
                      <input type="text" value={formData.landing_cta_primary_url} onChange={e => handleChange('landing_cta_primary_url', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. #pricing or /register" />
                    </div>
                  </div>
                  <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700">Secondary Button</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
                      <input type="text" value={formData.landing_cta_secondary_text} onChange={e => handleChange('landing_cta_secondary_text', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. Watch Demo" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Link URL</label>
                      <input type="text" value={formData.landing_cta_secondary_url} onChange={e => handleChange('landing_cta_secondary_url', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. https://youtube.com/watch?v=..." />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Demo Video URL (Optional)</label>
                  <input type="text" value={formData.landing_demo_video_url} onChange={e => handleChange('landing_demo_video_url', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="YouTube or Vimeo embed URL" />
                  <p className="text-xs text-gray-500 mt-1">If set, clicking "Watch Demo" will open a video modal</p>
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-4">These statistics are displayed below the hero section to build trust with visitors.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Organizations Count</label>
                    <input type="text" value={formData.landing_stats_saccos} onChange={e => handleChange('landing_stats_saccos', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. 500+" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Transactions Processed</label>
                    <input type="text" value={formData.landing_stats_transactions} onChange={e => handleChange('landing_stats_transactions', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. KES 2B+" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Members</label>
                    <input type="text" value={formData.landing_stats_members} onChange={e => handleChange('landing_stats_members', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. 1M+" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">System Uptime</label>
                    <input type="text" value={formData.landing_stats_uptime} onChange={e => handleChange('landing_stats_uptime', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. 99.9%" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'urls' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Main App URL</label>
                  <input type="text" value={formData.landing_app_url} onChange={e => handleChange('landing_app_url', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. https://app.banky.co.ke" />
                  <p className="text-xs text-gray-500 mt-1">URL shown in the browser mockup on the hero section</p>
                </div>
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Show Subscription & Billing Content</label>
                      <p className="text-xs text-gray-500 mt-0.5">When disabled, hides subscription plans, trial period, and billing sections from the user manual and landing page. Disable this for CodeCanyon / self-hosted deployments that don't use subscriptions.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleChange('landing_show_subscription_content', formData.landing_show_subscription_content === 'true' ? 'false' : 'true')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.landing_show_subscription_content === 'true' ? 'bg-primary-600' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.landing_show_subscription_content === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'features' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Manage the feature cards shown on the landing page.</p>
                  <button type="button" onClick={() => setFeatures([...features, { title: '', description: '', icon: 'Users', color: 'blue' }])} className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">Add Feature</button>
                </div>
                {features.map((item, i) => (
                  <div key={i} className="p-4 border border-gray-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Feature {i + 1}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setFeatures(moveItem(features, i, 'up'))} disabled={i === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" title="Move up">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button type="button" onClick={() => setFeatures(moveItem(features, i, 'down'))} disabled={i === features.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" title="Move down">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        <button type="button" onClick={() => setFeatures(features.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:text-red-600" title="Remove">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                        <input type="text" value={item.title} onChange={e => { const n = [...features]; n[i] = { ...n[i], title: e.target.value }; setFeatures(n) }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Icon</label>
                          <select value={item.icon} onChange={e => { const n = [...features]; n[i] = { ...n[i], icon: e.target.value }; setFeatures(n) }} className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
                            {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
                          <select value={item.color} onChange={e => { const n = [...features]; n[i] = { ...n[i], color: e.target.value }; setFeatures(n) }} className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
                            {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                      <textarea value={item.description} onChange={e => { const n = [...features]; n[i] = { ...n[i], description: e.target.value }; setFeatures(n) }} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'testimonials' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Manage customer testimonials displayed on the landing page.</p>
                  <button type="button" onClick={() => setTestimonials([...testimonials, { name: '', role: '', organization: '', quote: '', rating: 5 }])} className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">Add Testimonial</button>
                </div>
                {testimonials.map((item, i) => (
                  <div key={i} className="p-4 border border-gray-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Testimonial {i + 1}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setTestimonials(moveItem(testimonials, i, 'up'))} disabled={i === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" title="Move up">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button type="button" onClick={() => setTestimonials(moveItem(testimonials, i, 'down'))} disabled={i === testimonials.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" title="Move down">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        <button type="button" onClick={() => setTestimonials(testimonials.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:text-red-600" title="Remove">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                        <input type="text" value={item.name} onChange={e => { const n = [...testimonials]; n[i] = { ...n[i], name: e.target.value }; setTestimonials(n) }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                        <input type="text" value={item.role} onChange={e => { const n = [...testimonials]; n[i] = { ...n[i], role: e.target.value }; setTestimonials(n) }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Organization</label>
                        <input type="text" value={item.organization} onChange={e => { const n = [...testimonials]; n[i] = { ...n[i], organization: e.target.value }; setTestimonials(n) }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Quote</label>
                      <textarea value={item.quote} onChange={e => { const n = [...testimonials]; n[i] = { ...n[i], quote: e.target.value }; setTestimonials(n) }} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Rating (1-5)</label>
                      <select value={item.rating} onChange={e => { const n = [...testimonials]; n[i] = { ...n[i], rating: Number(e.target.value) }; setTestimonials(n) }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
                        {[1, 2, 3, 4, 5].map(r => <option key={r} value={r}>{r} Star{r > 1 ? 's' : ''}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'faq' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Manage frequently asked questions on the landing page.</p>
                  <button type="button" onClick={() => setFaq([...faq, { question: '', answer: '' }])} className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">Add Question</button>
                </div>
                {faq.map((item, i) => (
                  <div key={i} className="p-4 border border-gray-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Question {i + 1}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setFaq(moveItem(faq, i, 'up'))} disabled={i === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" title="Move up">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button type="button" onClick={() => setFaq(moveItem(faq, i, 'down'))} disabled={i === faq.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" title="Move down">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        <button type="button" onClick={() => setFaq(faq.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:text-red-600" title="Remove">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Question</label>
                      <input type="text" value={item.question} onChange={e => { const n = [...faq]; n[i] = { ...n[i], question: e.target.value }; setFaq(n) }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Answer</label>
                      <textarea value={item.answer} onChange={e => { const n = [...faq]; n[i] = { ...n[i], answer: e.target.value }; setFaq(n) }} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'how_it_works' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-2">Edit the "How It Works" steps displayed on the landing page.</p>
                {howItWorks.map((item, i) => (
                  <div key={i} className="p-4 border border-gray-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Step {i + 1}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setHowItWorks(moveItem(howItWorks, i, 'up'))} disabled={i === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" title="Move up">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button type="button" onClick={() => setHowItWorks(moveItem(howItWorks, i, 'down'))} disabled={i === howItWorks.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" title="Move down">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                        <input type="text" value={item.title} onChange={e => { const n = [...howItWorks]; n[i] = { ...n[i], title: e.target.value }; setHowItWorks(n) }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
                        <select value={item.color} onChange={e => { const n = [...howItWorks]; n[i] = { ...n[i], color: e.target.value }; setHowItWorks(n) }} className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
                          {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                      <textarea value={item.description} onChange={e => { const n = [...howItWorks]; n[i] = { ...n[i], description: e.target.value }; setHowItWorks(n) }} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'cta_section' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-2">Edit the call-to-action section near the bottom of the landing page.</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Heading</label>
                  <input type="text" value={ctaSection.heading} onChange={e => setCtaSection({ ...ctaSection, heading: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. Stop Managing Finances on Spreadsheets" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subheading</label>
                  <textarea value={ctaSection.subheading} onChange={e => setCtaSection({ ...ctaSection, subheading: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Button Text</label>
                    <input type="text" value={ctaSection.primary_button_text} onChange={e => setCtaSection({ ...ctaSection, primary_button_text: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. Start Free Trial" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Button Text</label>
                    <input type="text" value={ctaSection.secondary_button_text} onChange={e => setCtaSection({ ...ctaSection, secondary_button_text: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. Schedule a Demo" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'docs' && (
              <div className="space-y-6">
                <p className="text-sm text-gray-600 mb-2">Control which documentation guides are shown on the /docs page. You can show one or both.</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Documentation Mode</label>
                  <select value={formData.landing_docs_mode || 'both'} onChange={e => handleChange('landing_docs_mode', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                    <option value="both">Show Both Guides (Tabbed)</option>
                    <option value="codecanyon">CodeCanyon Guide Only</option>
                    <option value="direct">Direct/Enterprise Guide Only</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">When both guides are shown, visitors switch between them using tabs. When only one is shown, no tabs appear.</p>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">CodeCanyon Guide</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tab Title</label>
                      <input type="text" value={formData.landing_docs_codecanyon_title || ''} onChange={e => handleChange('landing_docs_codecanyon_title', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. CodeCanyon Purchase" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tab Subtitle</label>
                      <textarea value={formData.landing_docs_codecanyon_subtitle || ''} onChange={e => handleChange('landing_docs_codecanyon_subtitle', e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Brief description for CodeCanyon buyers" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Direct/Enterprise Guide</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tab Title</label>
                      <input type="text" value={formData.landing_docs_direct_title || ''} onChange={e => handleChange('landing_docs_direct_title', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. Enterprise License" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tab Subtitle</label>
                      <textarea value={formData.landing_docs_direct_subtitle || ''} onChange={e => handleChange('landing_docs_direct_subtitle', e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Brief description for direct enterprise clients" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
                    <input type="email" value={formData.landing_docs_support_email || ''} onChange={e => handleChange('landing_docs_support_email', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. support@banky.co.ke" />
                    <p className="text-xs text-gray-500 mt-1">Shown in troubleshooting sections of both guides</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Show License Activation section</label>
                      <p className="text-xs text-gray-500 mt-0.5">Enable for direct/enterprise clients who need license key instructions. Keep off for CodeCanyon buyers.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleChange('landing_docs_show_license', formData.landing_docs_show_license === 'true' ? 'false' : 'true')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${formData.landing_docs_show_license === 'true' ? 'bg-primary-600' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.landing_docs_show_license === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
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
            <button type="submit" disabled={isPending} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 flex items-center gap-2">
              {isPending && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

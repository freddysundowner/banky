import { useQuery } from '@tanstack/react-query'
import { Route, Switch, useLocation, Link } from 'wouter'
import { Toaster } from 'sonner'
import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Organizations from './pages/Organizations'
import OrganizationDetail from './pages/OrganizationDetail'
import Plans from './pages/Plans'
import Licenses from './pages/Licenses'
import Setup from './pages/Setup'
import Settings from './pages/Settings'
import LandingPageSettings from './pages/LandingPage'

async function fetchAdmin() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch('/api/admin/me', { credentials: 'include', signal: controller.signal })
    if (!res.ok) throw new Error('Not authenticated')
    return res.json()
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchBranding() {
  const res = await fetch('/api/public/branding')
  if (!res.ok) return { platform_name: 'BANKYKIT' }
  return res.json()
}

const navGroups = [
  {
    label: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    ]
  },
  {
    label: 'Customers',
    items: [
      { path: '/organizations', label: 'Organizations', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    ]
  },
  {
    label: 'Products',
    items: [
      { path: '/plans', label: 'Subscription Plans', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
      { path: '/licenses', label: 'Enterprise Licenses', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
    ]
  },
  {
    label: 'Website',
    items: [
      { path: '/landing-page', label: 'Landing Page', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
    ]
  },
  {
    label: 'System',
    items: [
      { path: '/settings', label: 'Platform Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    ]
  }
]

function Sidebar({ admin, platformName, isOpen, onClose }: { admin: any; platformName: string; isOpen: boolean; onClose: () => void }) {
  const [location] = useLocation()

  useEffect(() => {
    onClose()
  }, [location])

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 flex flex-col transform transition-transform duration-200 ease-in-out
        lg:relative lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">{platformName.charAt(0)}</span>
            </div>
            <div>
              <div className="text-white font-bold">{platformName}</div>
              <div className="text-gray-400 text-xs">Admin Panel</div>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = location === item.path || (item.path !== '/' && location.startsWith(item.path))
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                        isActive
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                      </svg>
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {(admin.name || admin.email || '?')[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{admin.name || 'Admin'}</div>
              <div className="text-gray-500 text-xs truncate">{admin.email}</div>
            </div>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
              window.location.reload()
            }}
            className="w-full text-sm text-gray-400 hover:text-white py-2 hover:bg-gray-800 rounded-lg transition flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}

function MobileHeader({ platformName, onMenuToggle }: { platformName: string; onMenuToggle: () => void }) {
  return (
    <header className="lg:hidden bg-gray-900 text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
      <button onClick={onMenuToggle} className="p-1 hover:bg-gray-800 rounded-lg">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">{platformName.charAt(0)}</span>
        </div>
        <span className="font-bold">{platformName}</span>
        <span className="text-gray-400 text-xs">Admin</span>
      </div>
    </header>
  )
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { data: admin, isLoading, error } = useQuery({
    queryKey: ['admin'],
    queryFn: fetchAdmin,
    retry: false,
  })

  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: fetchBranding,
  })

  const platformName = branding?.platform_name || 'BANKYKIT'

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error || !admin) {
    return (
      <Switch>
        <Route path="/setup" component={Setup} />
        <Route component={Login} />
      </Switch>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col lg:flex-row">
      <Toaster position="top-right" richColors />
      <MobileHeader platformName={platformName} onMenuToggle={() => setSidebarOpen(true)} />
      <Sidebar admin={admin} platformName={platformName} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="p-4 sm:p-6">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/organizations" component={Organizations} />
            <Route path="/organizations/:id" component={OrganizationDetail} />
            <Route path="/plans" component={Plans} />
            <Route path="/licenses" component={Licenses} />
            <Route path="/landing-page" component={LandingPageSettings} />
            <Route path="/settings" component={Settings} />
          </Switch>
        </div>
      </main>
    </div>
  )
}

export default App

import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/admin/dashboard', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load dashboard')
      return res.json()
    }
  })

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
  }

  const planData = stats?.subscriptions?.by_plan 
    ? Object.entries(stats.subscriptions.by_plan).map(([name, value]) => ({ name, value }))
    : []

  const statusData = stats?.subscriptions?.by_status
    ? Object.entries(stats.subscriptions.by_status).map(([name, value]) => ({ name, value }))
    : []

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Platform Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Total Organizations</div>
          <div className="text-3xl font-bold text-gray-800">{stats?.organizations?.total || 0}</div>
          <div className="text-sm text-green-600">{stats?.organizations?.active || 0} active</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Total Members</div>
          <div className="text-3xl font-bold text-gray-800">{stats?.platform?.total_members?.toLocaleString() || 0}</div>
          <div className="text-sm text-gray-400">Across all organizations</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Total Staff</div>
          <div className="text-3xl font-bold text-gray-800">{stats?.platform?.total_staff?.toLocaleString() || 0}</div>
          <div className="text-sm text-gray-400">Across all organizations</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Active Licenses</div>
          <div className="text-3xl font-bold text-gray-800">{stats?.licenses?.active || 0}</div>
          <div className="text-sm text-gray-400">Enterprise deployments</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Organizations by Plan</h2>
          {planData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={planData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {planData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">
              No subscription data yet
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Subscription Status</h2>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">
              No subscription data yet
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/organizations" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
          <h3 className="text-lg font-semibold text-primary-600">Manage Organizations</h3>
          <p className="text-gray-500 text-sm mt-1">View and manage all tenant organizations</p>
        </Link>

        <Link href="/plans" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
          <h3 className="text-lg font-semibold text-primary-600">Subscription Plans</h3>
          <p className="text-gray-500 text-sm mt-1">Configure pricing and feature limits</p>
        </Link>

        <Link href="/licenses" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
          <h3 className="text-lg font-semibold text-primary-600">License Keys</h3>
          <p className="text-gray-500 text-sm mt-1">Generate and manage enterprise licenses</p>
        </Link>
      </div>
    </div>
  )
}

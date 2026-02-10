import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'

async function fetchBranding() {
  const res = await fetch('/api/public/branding')
  if (!res.ok) return { platform_name: 'BANKY' }
  return res.json()
}

export default function Setup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: fetchBranding,
  })

  const platformName = branding?.platform_name || 'BANKY'

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Setup failed')
      }
      return res.json()
    },
    onSuccess: () => {
      setSuccess(true)
    },
    onError: (err: Error) => {
      setError(err.message)
    }
  })

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md text-center">
          <div className="text-green-500 text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Setup Complete!</h1>
          <p className="text-gray-600 mb-6">Your admin account has been created along with default subscription plans.</p>
          <Link href="/" className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 inline-block">
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-700">{platformName} Admin Setup</h1>
          <p className="text-gray-600 mt-2">Create your admin account</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setupMutation.mutate() }}>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Admin Name"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Create a strong password"
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={setupMutation.isPending}
            className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {setupMutation.isPending ? 'Setting up...' : 'Create Admin Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          This will also create default subscription plans.
        </p>
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, saveSession, getSession, SessionUser } from '../lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const session = getSession()
    if (session) {
      router.replace(session.role === 'manager' ? '/dashboard' : '/employee')
    }
  }, [router])

  async function handleLogin() {
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
  setError('');

    try {
      const data = await apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }) as SessionUser;

      saveSession(data);

      // Redirect based on role
      router.replace(data.role === 'manager' ? '/dashboard' : '/employee');

    } catch (err: unknown) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Login failed. Please check your credentials.';
    
      setError(errorMessage);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className="login-bg min-h-screen flex items-center justify-center p-4">
      {/* Stars / particles effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(60)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 1 + 'px',
              height: Math.random() * 2 + 1 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
              opacity: Math.random() * 0.5 + 0.1,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#00e5ff] dot-pulse" />
            <span className="font-mono text-xs tracking-[0.3em] text-[#00e5ff] uppercase">
              SnapSync Enterprise
            </span>
            <div className="w-2 h-2 rounded-full bg-[#00e5ff] dot-pulse" style={{ animationDelay: '0.5s' }} />
          </div>
          <h1 className="font-mono text-3xl font-bold text-white tracking-tight">
            Sign In
          </h1>
          <p className="font-mono text-xs text-[#4a6080] mt-2 tracking-widest">
            PRODUCTIVITY MONITORING SUITE v2.0
          </p>
        </div>

        {/* Glass card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <div className="space-y-5">
            {/* Email */}
            <div>
              <label className="font-mono text-xs text-[#4a6080] tracking-widest uppercase block mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="you@company.com"
                autoComplete="email"
                className="w-full font-mono text-sm text-white placeholder-[#2a4060] rounded-lg px-4 py-3 outline-none transition-all duration-200"
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onFocus={(e) => {
                  e.target.style.border = '1px solid rgba(0,229,255,0.4)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.border = '1px solid rgba(255,255,255,0.08)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="font-mono text-xs text-[#4a6080] tracking-widest uppercase block mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full font-mono text-sm text-white placeholder-[#2a4060] rounded-lg px-4 py-3 outline-none transition-all duration-200"
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onFocus={(e) => {
                  e.target.style.border = '1px solid rgba(0,229,255,0.4)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.border = '1px solid rgba(255,255,255,0.08)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="font-mono text-xs text-[#ff4560] bg-[#ff456015] border border-[#ff456030] rounded-lg px-4 py-3">
                ⚠ {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full font-mono font-bold text-sm tracking-widest uppercase py-3.5 rounded-lg transition-all duration-200 disabled:opacity-50"
              style={{
                background: loading ? '#009ab8' : '#00e5ff',
                color: '#040d18',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(0,229,255,0.3)',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)'
                  ;(e.target as HTMLButtonElement).style.boxShadow = '0 8px 30px rgba(0,229,255,0.5)'
                }
              }}
              onMouseLeave={(e) => {
                ;(e.target as HTMLButtonElement).style.transform = 'translateY(0)'
                ;(e.target as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(0,229,255,0.3)'
              }}
            >
              {loading ? '[ Authenticating... ]' : '[ Access System ]'}
            </button>
          </div>
        </div>

        {/* Dev credentials */}
        <div
          className="mt-6 rounded-xl p-4"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <p className="font-mono text-xs text-[#2a4060] tracking-widest uppercase mb-3">
            // Dev Credentials
          </p>
          <div className="space-y-1.5">
            {[
              { label: 'Manager', email: 'alice@demo.com', pass: 'manager123' },
              { label: 'Employee', email: 'bob@demo.com', pass: 'pass123' },
              { label: 'Employee', email: 'carol@demo.com', pass: 'pass123' },
            ].map((cred) => (
              <button
                key={cred.email}
                onClick={() => { setEmail(cred.email); setPassword(cred.pass) }}
                className="w-full text-left font-mono text-xs text-[#4a6080] hover:text-[#00e5ff] transition-colors px-2 py-1 rounded hover:bg-[#00e5ff08]"
              >
                <span className="text-[#2a4060]">{cred.label}:</span>{' '}
                {cred.email} / {cred.pass}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
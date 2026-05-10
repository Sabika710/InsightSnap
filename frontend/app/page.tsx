'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from './lib/api'

export default function RootPage() {
  const router = useRouter()
  useEffect(() => {
    const session = getSession()
    if (!session) {
      router.replace('/login')
    } else if (session.role === 'manager') {
      router.replace('/dashboard')
    } else {
      router.replace('/employee')
    }
  }, [router])

  return (
    <div style={{ background: '#040d18', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#00e5ff', fontFamily: 'monospace' }}>Redirecting...</span>
    </div>
  )
}
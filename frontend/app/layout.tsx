import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SnapSync Enterprise',
  description: 'Real-time employee productivity monitoring suite',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
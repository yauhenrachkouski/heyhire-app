import type { Metadata } from 'next'
import './globals.css'
import { Sora } from 'next/font/google'
import { headers } from 'next/headers'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { LocalhostBadge } from '@/components/localhost-badge'
import { QueryProvider, ToasterProvider } from '@/providers/query-provider'
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin", "latin-ext"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Heyhire - B2B Recruitment Service",
  description: "Multi-tenant B2B recruitment platform",
};

// ✅ OFFICIAL PATTERN: Server Component fetches auth data once
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  // Detect localhost based on incoming request host header
  const requestHeaders = await headers()
  const host = requestHeaders.get('host') ?? ''
  const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1')

  return (
    <html lang="en">
      <body className={`${sora.variable} antialiased`}>
        <NuqsAdapter>
          <QueryProvider>
            {children}
            <LocalhostBadge isLocalhost={isLocalhost} />
            <ToasterProvider />
          </QueryProvider>
        </NuqsAdapter>
      </body>
    </html>
  )
}

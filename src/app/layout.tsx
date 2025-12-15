import type { Metadata } from 'next'
import './globals.css'
import { Sora } from 'next/font/google'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { QueryProvider, ToasterProvider } from '@/providers/query-provider'
import { WebVitals } from '@/lib/axiom/client'
import { PostHogIdentityProvider } from '@/providers/posthog-identity-provider'
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


export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <html lang="en" suppressHydrationWarning>
      <WebVitals />
      <body className={`${sora.variable} antialiased min-h-screen bg-background font-sans`}>
        <NuqsAdapter>
          <QueryProvider>
            <PostHogIdentityProvider>
              {children}
              <ToasterProvider />
            </PostHogIdentityProvider>
          </QueryProvider>
        </NuqsAdapter>
      </body>
    </html>
  )
}

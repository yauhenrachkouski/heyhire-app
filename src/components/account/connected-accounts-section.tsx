'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import Image from 'next/image'
import googleIcon from '@/assets/google-icon.svg'
import { toast } from 'sonner'
import { unlinkAccount } from '@/actions/account'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

interface ConnectedAccount {
  id: string
  providerId: string
  createdAt: Date
}

interface ConnectedAccountsSectionProps {
  accounts: ConnectedAccount[]
}

export function ConnectedAccountsSection({ accounts: initialAccounts }: ConnectedAccountsSectionProps) {
  const router = useRouter()
  const [accounts, setAccounts] = useState(initialAccounts)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const handleUnlinkAccount = async (accountId: string, providerId: string) => {
    setUnlinkingId(accountId)
    try {
      const result = await unlinkAccount(accountId)

      if (result.success) {
        toast.success(`${providerId} account disconnected`)
        setAccounts(accounts.filter(acc => acc.id !== accountId))
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to disconnect account')
      }
    } catch (err) {
      console.error('Unlink account error:', err)
      toast.error('Failed to disconnect account')
    } finally {
      setUnlinkingId(null)
    }
  }

  const handleConnectGoogle = async () => {
    setIsConnecting(true)
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/settings',
      })
    } catch (err) {
      console.error('Google connect error:', err)
      toast.error('Failed to connect Google account')
      setIsConnecting(false)
    }
  }

  const isGoogleConnected = accounts.some(acc => acc.providerId === 'google')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Accounts</CardTitle>
        <CardDescription>
          Manage OAuth providers connected to your account. You can always sign in using magic link with your email.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connected Accounts */}
        {accounts.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3">Connected</h3>
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {account.providerId === 'google' && (
                      <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center border p-1">
                        <Image src={googleIcon} alt="Google" className="h-full w-full" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium capitalize">{account.providerId}</p>
                      <p className="text-xs text-muted-foreground">
                        Connected on {new Date(account.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnlinkAccount(account.id, account.providerId)}
                    disabled={unlinkingId === account.id}
                  >
                    {unlinkingId === account.id ? (
                      <>
                        <Icon name="loader" className="animate-spin h-4 w-4 mr-1" />
                        Disconnecting...
                      </>
                    ) : (
                      <>
                        <Icon name="x-circle" className="h-4 w-4 mr-1" />
                        Disconnect
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available to Connect */}
        {!isGoogleConnected && (
          <div>
            <h3 className="text-sm font-medium mb-3">Available to Connect</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center border p-1">
                    <Image src={googleIcon} alt="Google" className="h-full w-full" />
                  </div>
                  <div>
                    <p className="font-medium">Google</p>
                    <p className="text-xs text-muted-foreground">
                      Connect your Google account
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnectGoogle}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <Icon name="loader" className="animate-spin h-4 w-4 mr-1" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Icon name="plus" className="h-4 w-4 mr-1" />
                      Connect
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}


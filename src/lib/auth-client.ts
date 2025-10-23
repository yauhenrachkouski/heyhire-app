import { createAuthClient } from "better-auth/react"
import { organizationClient, magicLinkClient } from "better-auth/client/plugins"
import { stripeClient } from "@better-auth/stripe/client"

export const authClient = createAuthClient({
    plugins: [
        organizationClient(),
        magicLinkClient(),
        stripeClient({
            subscription: {
                enabled: true,
            }
        })
    ]
})

export const { 
    signIn, 
    signOut,
    useSession,
    organization,
    useListOrganizations,
    useActiveOrganization
} = authClient

// Export subscription methods for use in client components
export const subscription = authClient.subscription

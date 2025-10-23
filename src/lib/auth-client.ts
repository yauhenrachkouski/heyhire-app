import { createAuthClient } from "better-auth/react"
import { organizationClient, magicLinkClient, lastLoginMethodClient } from "better-auth/client/plugins"
import { stripeClient } from "@better-auth/stripe/client"

export const authClient = createAuthClient({
    plugins: [
        organizationClient(),
        magicLinkClient(),
        lastLoginMethodClient(),
        stripeClient({
            subscription: true,
        })
    ]
})

export const { 
    signIn, 
    signOut,
    useSession,
    organization,
    useListOrganizations,
    useActiveOrganization,
    subscription
} = authClient

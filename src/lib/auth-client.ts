import { createAuthClient } from "better-auth/react"
import { organizationClient, magicLinkClient, lastLoginMethodClient, anonymousClient } from "better-auth/client/plugins"
import { stripeClient } from "@better-auth/stripe/client"

export const authClient = createAuthClient({
    plugins: [
        organizationClient(),
        magicLinkClient(),
        lastLoginMethodClient(),
        stripeClient({
            subscription: true,
        }),
        anonymousClient(),
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

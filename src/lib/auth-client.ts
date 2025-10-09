import { createAuthClient } from "better-auth/react"
import { organizationClient, magicLinkClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    plugins: [
        organizationClient(),
        magicLinkClient()
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

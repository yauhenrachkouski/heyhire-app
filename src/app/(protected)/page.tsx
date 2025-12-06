import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { headers } from "next/headers"

export default async function DashboardPage() {

  const session = await auth.api.getSession({
    headers: await headers()
 })

 if (!session) {
    return redirect("/auth/signin")
 }
 
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Empty dashboard - redirect to search */}
    </div>
  )
} 
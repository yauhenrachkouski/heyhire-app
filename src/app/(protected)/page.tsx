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
    <div className="space-y-4 p-4">
    </div>
  )
} 
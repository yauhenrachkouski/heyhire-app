import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCreditTransactions, type CreditTransaction } from "@/actions/credits"
import { Badge } from "@/components/ui/badge"
import {
  IconCoin,
  IconBrandLinkedin,
  IconMail,
  IconPhone,
  IconPlus,
  IconGift,
  IconShoppingCart,
} from "@tabler/icons-react"

export async function UsageHistoryCard() {
  const formatCreditType = (creditType: CreditTransaction["creditType"]) => {
    const types: Record<CreditTransaction["creditType"], { label: string; icon: React.ReactNode }> = {
      general: { label: "General", icon: <IconCoin className="size-3.5" /> },
      linkedin_reveal: { label: "LinkedIn", icon: <IconBrandLinkedin className="size-3.5" /> },
      email_reveal: { label: "Email", icon: <IconMail className="size-3.5" /> },
      phone_reveal: { label: "Phone", icon: <IconPhone className="size-3.5" /> },
    }
    return types[creditType] || { label: creditType, icon: <IconCoin className="size-3.5" /> }
  }

  const renderTypeBadge = (type: CreditTransaction["type"]) => {
    if (type === "consumption") {
      return (
        <Badge variant="secondary" className="text-xs">
          Used
        </Badge>
      )
    }
    if (type === "subscription_grant") {
      return (
        <Badge variant="default" className="bg-green-600 text-xs">
          <IconGift className="size-3 mr-1" />
          Subscription
        </Badge>
      )
    }
    if (type === "manual_grant") {
      return (
        <Badge variant="default" className="bg-blue-600 text-xs">
          <IconPlus className="size-3 mr-1" />
          Granted
        </Badge>
      )
    }
    if (type === "purchase") {
      return (
        <Badge variant="default" className="bg-purple-600 text-xs">
          <IconShoppingCart className="size-3 mr-1" />
          Purchase
        </Badge>
      )
    }
    return <Badge variant="secondary">{type}</Badge>
  }

  const { transactions, error } = await getCreditTransactions({ limit: 50 })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Credits</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-16 text-center text-sm text-muted-foreground">
                    {error}
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-16 text-center text-sm text-muted-foreground">
                    No usage history found.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => {
                  const creditTypeInfo = formatCreditType(tx.creditType)
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        <span className="text-muted-foreground text-xs block">
                          {new Date(tx.createdAt).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {renderTypeBadge(tx.type)}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {creditTypeInfo.icon}
                            <span>{creditTypeInfo.label}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={tx.description}>
                        {tx.description}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {tx.userName || "System"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={tx.amount < 0 ? "text-red-600" : "text-green-600"}>
                          {tx.amount > 0 ? "+" : ""}
                          {tx.amount}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {tx.balanceAfter}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

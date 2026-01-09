import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCustomerInvoices } from "@/actions/stripe"
import { Badge } from "@/components/ui/badge"
import { subscription as subscriptionSchema } from "@/db/schema"

interface InvoicesCardProps {
  subscription: typeof subscriptionSchema.$inferSelect | null;
}

export async function InvoicesCard({ subscription }: InvoicesCardProps) {
  const formatInvoiceAmount = (total: number, currency: string) => {
    const major = total / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(major);
  };

  const renderStatusBadge = (status: string | null) => {
    const normalized = (status ?? "unknown").toLowerCase();

    if (normalized === "paid") {
      return (
        <Badge variant="default" className="bg-green-600">
          Paid
        </Badge>
      );
    }

    if (normalized === "open") {
      return (
        <Badge variant="secondary" className="bg-blue-600 text-white">
          Open
        </Badge>
      );
    }

    if (normalized === "draft") {
      return <Badge variant="secondary">Draft</Badge>;
    }

    if (normalized === "void" || normalized === "uncollectible") {
      return <Badge variant="destructive">{normalized === "void" ? "Void" : "Uncollectible"}</Badge>;
    }

    return <Badge variant="secondary">{normalized}</Badge>;
  };

  if (!subscription) {
    return null;
  }

  const { invoices, error } = await getCustomerInvoices({ limit: 10 });

  return (
    <section>
      <div className="space-y-1 mb-4">
        <h3 className="text-base font-semibold">Invoices</h3>
      </div>
      <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-16 text-center text-sm text-muted-foreground">
                    {error}
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-16 text-center text-sm text-muted-foreground">
                    No invoices found.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      {new Date(invoice.created * 1000).toLocaleDateString("en-US")}
                    </TableCell>
                    <TableCell>
                      {formatInvoiceAmount(invoice.total, invoice.currency)}
                    </TableCell>
                    <TableCell>{renderStatusBadge(invoice.status)}</TableCell>
                    <TableCell className="text-right">
                      {invoice.hostedInvoiceUrl ? (
                        <a
                          className="text-sm underline underline-offset-4"
                          href={invoice.hostedInvoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </a>
                      ) : invoice.invoicePdf ? (
                        <a
                          className="text-sm underline underline-offset-4"
                          href={invoice.invoicePdf}
                          target="_blank"
                          rel="noreferrer"
                        >
                          PDF
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
      </div>
    </section>
  )
}

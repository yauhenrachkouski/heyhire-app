import { Button } from "@/components/ui/button"
import { getCustomerPaymentMethods } from "@/actions/stripe"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { AddNewPaymentMethodButton } from "@/components/account/add-new-payment-method-button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export async function PaymentMethodBlock() {
  const { paymentMethods, defaultPaymentMethodId, error } = await getCustomerPaymentMethods({ limit: 10 })

  const formatBrand = (brand: string | null) => {
    if (!brand) return "Card"
    return brand.charAt(0).toUpperCase() + brand.slice(1)
  }

  const formatExp = (expMonth: number | null, expYear: number | null) => {
    if (!expMonth || !expYear) return null
    return `${expMonth}/${expYear}`
  }

  return (
    <div className="rounded-lg border p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1">
          <div className="text-base font-semibold">Payment method</div>
          <div className="text-sm text-muted-foreground">Manage your saved payment methods</div>
        </div>

        <div className="flex">
          <AddNewPaymentMethodButton />
        </div>
      </div>

      <div className="mt-6">
        {error ? (
          <div className="text-sm text-muted-foreground">{error}</div>
        ) : paymentMethods.length === 0 ? (
          <div className="text-sm text-muted-foreground">No saved payment methods.</div>
        ) : (
          <RadioGroup value={defaultPaymentMethodId ?? ""} className="gap-4">
            {paymentMethods.map((pm) => {
              const isDefault = defaultPaymentMethodId === pm.id
              const expLabel = formatExp(pm.expMonth, pm.expYear)
              return (
                <div
                  key={pm.id}
                  className={
                    "flex items-center gap-4 rounded-xl border p-4 shadow-xs" +
                    (isDefault ? " border-foreground/30" : "")
                  }
                >
                  <RadioGroupItem value={pm.id} aria-label={`Select ${pm.id}`} />

                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex h-10 w-14 items-center justify-center rounded-md border bg-background">
                      <Icon name="credit-card" className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="truncate text-sm font-medium">
                          {formatBrand(pm.brand)} {pm.last4 ? `•••• ${pm.last4}` : ""}
                        </div>
                        {isDefault ? <Badge variant="secondary">Default</Badge> : null}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {expLabel ? `Expires ${expLabel}` : ""}
                      </div>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Payment method actions">
                        <Icon name="dots-vertical" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled>
                        Set as default
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled>
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })}
          </RadioGroup>
        )}
      </div>
    </div>
  )
}

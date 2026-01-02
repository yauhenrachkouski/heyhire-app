"use client"

import { useState, useTransition, useEffect } from "react"
import Image, { type StaticImageData } from "next/image"
import { Button } from "@/components/ui/button"
import { getCustomerPaymentMethods, setDefaultPaymentMethod, removePaymentMethod } from "@/actions/stripe"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/icon"
import { AddNewPaymentMethodButton } from "@/components/account/add-new-payment-method-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import visaLogo from "@aaronfagan/ccicons/logo/visa.svg"
import mastercardLogo from "@aaronfagan/ccicons/logo/mastercard.svg"
import amexLogo from "@aaronfagan/ccicons/logo/amex.svg"
import discoverLogo from "@aaronfagan/ccicons/logo/discover.svg"
import dinersLogo from "@aaronfagan/ccicons/logo/diners.svg"
import jcbLogo from "@aaronfagan/ccicons/logo/jcb.svg"
import unionpayLogo from "@aaronfagan/ccicons/logo/unionpay.svg"
import eloLogo from "@aaronfagan/ccicons/logo/elo.svg"
import mirLogo from "@aaronfagan/ccicons/logo/mir.svg"
import maestroLogo from "@aaronfagan/ccicons/logo/maestro.svg"
import genericLogo from "@aaronfagan/ccicons/logo/generic.svg"

const brandToIcon: Record<string, StaticImageData> = {
  visa: visaLogo,
  mastercard: mastercardLogo,
  amex: amexLogo,
  americanexpress: amexLogo,
  discover: discoverLogo,
  diners: dinersLogo,
  dinersclub: dinersLogo,
  jcb: jcbLogo,
  unionpay: unionpayLogo,
  china_unionpay: unionpayLogo,
  elo: eloLogo,
  mir: mirLogo,
  maestro: maestroLogo,
}

const getBrandIcon = (brand: string | null) => {
  if (!brand) return genericLogo
  const normalized = brand.replace(/\s+/g, "").toLowerCase()
  return brandToIcon[normalized] ?? genericLogo
}

export function PaymentMethodBlock() {
  const [paymentMethods, setPaymentMethods] = useState<Array<{
    id: string;
    type: string;
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
  }>>([])
  const [defaultPaymentMethodId, setDefaultPaymentMethodId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Load payment methods on mount
  useEffect(() => {
    startTransition(async () => {
      const result = await getCustomerPaymentMethods({ limit: 10 })
      setPaymentMethods(result.paymentMethods || [])
      setDefaultPaymentMethodId(result.defaultPaymentMethodId)
      setError(result.error)
    })
  }, [])

  const handleSetDefault = async (paymentMethodId: string) => {
    startTransition(async () => {
      const result = await setDefaultPaymentMethod(paymentMethodId)
      if (result.success) {
        setDefaultPaymentMethodId(paymentMethodId)
        toast.success("Payment method set as default")
      } else {
        toast.error(result.error || "Failed to set default payment method")
      }
    })
  }

  const handleRemove = async (paymentMethodId: string) => {
    startTransition(async () => {
      const result = await removePaymentMethod(paymentMethodId)
      if (result.success) {
        setPaymentMethods(prev => prev.filter(pm => pm.id !== paymentMethodId))
        toast.success("Payment method removed")
      } else {
        toast.error(result.error || "Failed to remove payment method")
      }
    })
  }

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
          <div className="flex flex-col gap-2">
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
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex h-10 w-16 items-center justify-center rounded-md bg-background p-1.5">
                      <Image
                        src={getBrandIcon(pm.brand)}
                        alt={`${formatBrand(pm.brand)} logo`}
                        width={48}
                        height={24}
                        className="h-full w-auto object-contain"
                      />
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
                      <Button variant="ghost" size="icon" aria-label="Payment method actions" disabled={isPending}>
                        <Icon name="dots-vertical" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={isDefault}
                        onClick={() => handleSetDefault(pm.id)}
                      >
                        Set as default
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={isDefault}
                        onClick={() => handleRemove(pm.id)}
                      >
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

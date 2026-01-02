"use client"

import { getCustomerPortalPaymentMethodSession } from "@/actions/stripe"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/icon"

export function AddNewPaymentMethodButton() {
  const handleUpdatePaymentMethod = async () => {
    try {
      const result = await getCustomerPortalPaymentMethodSession()
      if (result.url) {
        window.location.href = result.url
        return
      }
    } catch {
      // Intentionally ignore; this is a best-effort redirect action
    }
  }

  return (
    <Button onClick={handleUpdatePaymentMethod}>
      <Icon name="plus" />
      Add New
    </Button>
  )
}

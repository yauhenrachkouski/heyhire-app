"use client"

import { getCustomerPortalPaymentMethodSession } from "@/actions/stripe"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/icon"
import { useQueryClient } from "@tanstack/react-query"
import { billingKeys } from "@/lib/query-keys/billing"

interface AddNewPaymentMethodButtonProps {
  organizationId: string | null;
}

export function AddNewPaymentMethodButton({ organizationId }: AddNewPaymentMethodButtonProps) {
  const queryClient = useQueryClient()

  const handleUpdatePaymentMethod = async () => {
    try {
      if (organizationId) {
        await queryClient.invalidateQueries({
          queryKey: billingKeys.paymentMethods(organizationId),
        })
      }

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

export const billingKeys = {
  all: ["billing"] as const,
  paymentMethods: (organizationId: string) =>
    [...billingKeys.all, "payment-methods", organizationId] as const,
};

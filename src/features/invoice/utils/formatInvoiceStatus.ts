export const formatInvoiceStatus = (status: string): string => {
  switch (status.toUpperCase()) {
    case "PAID":
      return "Paid";

    case "VOID":
      return "Void";

    case "PENDING":
      return "Pending";

    default:
      return status;
  }
};
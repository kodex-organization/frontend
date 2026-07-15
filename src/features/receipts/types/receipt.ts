export interface Receipt {
  id: string;
  invoiceId: string;
  printedAt: string | null;
  electronicCopyPath: string | null;
  paymentMethod?: string;
}

export interface PrintData {
  receiptId: string;
  clubName: string;
  invoiceNumber: string;
  tableNumber: string;
  dateTime: string;
  amount: number;
  paymentMethod: string;
}
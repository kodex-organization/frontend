import api from "@/lib/axios";
import { Invoice } from "../types/invoice";

export const invoiceService = {


  // Get all invoices
  async getInvoices(): Promise<Invoice[]> {

    const res = await api.get("/invoices");

    return res.data.data as Invoice[];

  },



  // Get single invoice
  async getInvoice(id: string): Promise<Invoice> {

    const res = await api.get(`/invoices/${id}`);

    return res.data.data as Invoice;

  },



  // =========================
  // Get active session
  // =========================
  async getActiveSession() {

    const res = await api.get(
      "/sessions/active"
    );


    return res.data.data;

  },



  // =========================
  // Create Invoice
  // =========================
 async createInvoice(data: {
  branchId: string;
  sessionId?: string;
  customerId?: string;
  items: {
    itemName: string;
    quantity: number;
    unitPrice: number;
  }[];
}): Promise<Invoice> {
//invoices
//invoice

  const res = await api.post(
    "/billing/invoices",
    data
  );


  return res.data.data as Invoice;

},


  // =========================
  // Void Invoice
  // =========================
  async voidInvoice(
    invoiceId: string
  ) {


    const res = await api.patch(
      `/invoices/${invoiceId}/void`
    );

    return res.data;

  },



  // Add payment
  async addPayment(
    invoiceId: string,
    amount: number,
    paymentMethod: "CASH" = "CASH"
  ) {

    const res = await api.post(
      "/payments",
      {
        invoiceId,
        amount,
        paymentMethod,
      }
    );


    return res.data;

  },


};
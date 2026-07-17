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



  // Void invoice
  async voidInvoice(invoiceId: string) {

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
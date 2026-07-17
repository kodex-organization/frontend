"use client";

import { useState } from "react";

import DateFilter from "@/features/invoice/components/DateFilter";
import InvoiceTable from "@/features/invoice/components/InvoiceTable";
import TransactionTable from "@/features/invoice/components/TransactionTable";

import { useInvoices } from "@/features/invoice/hooks/useInvoices";


export default function BillingPage() {

  const [date, setDate] = useState("");


  const {
    invoices,
    loading,
    error,
    refresh,
  } = useInvoices(date);



  return (

    <div className="min-h-screen bg-gray-50 p-6">


      {/* Page Header */}
      <div className="mb-8">

        <h1 className="text-4xl font-bold text-gray-800">
          Billing & Transactions
        </h1>


        <p className="mt-2 text-gray-500">
          View finalized invoices and transaction records.
        </p>

      </div>




      {/* Invoice List */}
      <div className="rounded-xl bg-white shadow">


        <div className="flex items-center justify-between border-b p-6">


          <h2 className="text-2xl font-semibold">
            Invoice List
          </h2>


        </div>



        {
          loading ? (

            <div className="p-6">
              Loading invoices...
            </div>


          ) : error ? (

            <div className="p-6 text-red-500">
              {error}
            </div>


          ) : (

            <InvoiceTable invoices={invoices} />

          )
        }


      </div>





      {/* Transaction History */}
      <div className="mt-10 rounded-xl bg-white shadow">


        <div className="flex items-center justify-between border-b p-6">


          <h2 className="text-2xl font-semibold">
            Transaction History
          </h2>



          <DateFilter

            date={date}

            setDate={setDate}

            onFilter={refresh}

          />


        </div>





        {
          loading ? (

            <div className="p-6">
              Loading transactions...
            </div>


          ) : (

            <TransactionTable invoices={invoices} />

          )
        }



      </div>



    </div>

  );

}
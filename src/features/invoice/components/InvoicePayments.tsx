"use client";

import type { InvoicePayment } from "../types/invoice";

interface Props {

  payments: InvoicePayment[];

}




export default function InvoicePayments({ payments }: Props) {


  return (

    <div
      className="
        bg-white
        rounded-2xl
        shadow-sm
        border
        border-gray-100
        p-6
        mb-6
      "
    >



      <div className="mb-5">


        <h2
          className="
            text-xl
            font-semibold
            text-gray-800
          "
        >
          Payment History
        </h2>



        <p
          className="
            text-sm
            text-gray-500
            mt-1
          "
        >
          Recorded payments for this invoice
        </p>


      </div>





      <div className="overflow-x-auto">


        <table className="w-full">


          <thead>


            <tr
              className="
                bg-gray-50
                border-b
                text-gray-600
                text-sm
              "
            >


              <th
                className="
                  text-left
                  p-4
                  font-medium
                "
              >
                Date
              </th>




              <th
                className="
                  text-left
                  p-4
                  font-medium
                "
              >
                Method
              </th>




              <th
                className="
                  text-right
                  p-4
                  font-medium
                "
              >
                Amount
              </th>


            </tr>


          </thead>





          <tbody>


            {
              payments.length > 0 ? (

                payments.map((payment) => (


                  <tr

                    key={payment.id}

                    className="
                      border-b
                      last:border-none
                      hover:bg-green-50
                      transition
                    "

                  >



                    <td
                      className="
                        p-4
                        text-gray-700
                      "
                    >

                      {
                        new Date(
                          payment.paidAt
                        ).toLocaleDateString()
                      }

                    </td>






                    <td
                      className="
                        p-4
                      "
                    >

                      <span
                        className="
                          inline-flex
                          items-center
                          bg-green-100
                          text-green-700
                          px-3
                          py-1
                          rounded-full
                          text-sm
                          font-medium
                        "
                      >

                        {payment.paymentMethod}

                      </span>


                    </td>






                    <td
                      className="
                        p-4
                        text-right
                        font-semibold
                        text-gray-800
                      "
                    >

                      Rs. {Number(payment.amount).toLocaleString()}

                    </td>



                  </tr>


                ))


              ) : (


                <tr>

                  <td
                    colSpan={3}
                    className="
                      p-6
                      text-center
                      text-gray-500
                    "
                  >

                    No payments recorded yet

                  </td>


                </tr>


              )
            }



          </tbody>


        </table>


      </div>



    </div>

  );

}

interface Props {
  items: {
    id: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
}


export default function InvoiceItems({ items }: Props) {


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
          Invoice Items
        </h2>


        <p
          className="
            text-sm
            text-gray-500
            mt-1
          "
        >
          Details of products and services included in this invoice
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
                Item
              </th>


              <th
                className="
                  text-center
                  p-4
                  font-medium
                "
              >
                Quantity
              </th>


              <th
                className="
                  text-right
                  p-4
                  font-medium
                "
              >
                Unit Price
              </th>


              <th
                className="
                  text-right
                  p-4
                  font-medium
                "
              >
                Total
              </th>


            </tr>


          </thead>





          <tbody>


            {
              items.length > 0 ? (

                items.map((item) => (

                  <tr

                    key={item.id}

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
                        text-gray-800
                        font-medium
                      "
                    >

                      {item.itemName}

                    </td>




                    <td
                      className="
                        p-4
                        text-center
                        text-gray-600
                      "
                    >

                      {item.quantity}

                    </td>





                    <td
                      className="
                        p-4
                        text-right
                        text-gray-600
                      "
                    >

                      Rs. {Number(item.unitPrice).toLocaleString()}

                    </td>





                    <td
                      className="
                        p-4
                        text-right
                        font-semibold
                        text-green-700
                      "
                    >

                      Rs. {Number(item.lineTotal).toLocaleString()}

                    </td>



                  </tr>


                ))

              ) : (


                <tr>

                  <td
                    colSpan={4}
                    className="
                      p-6
                      text-center
                      text-gray-500
                    "
                  >

                    No invoice items available

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
"use client";


interface Props {
  total: number;
  paid: number;
  onPayment: () => void;
}



export default function PaymentSection({
  total,
  paid,
  onPayment,
}: Props) {


  const remaining = Number(total) - Number(paid);



  return (

    <div className="mb-6">


      <div
        className="
          bg-white
          rounded-2xl
          border
          border-gray-100
          shadow-sm
          p-6
        "
      >



        <div className="flex justify-between items-center mb-5">


          <div>


            <h2
              className="
                text-xl
                font-semibold
                text-gray-800
              "
            >
              Payment Summary
            </h2>



            <p
              className="
                text-sm
                text-gray-500
                mt-1
              "
            >
              Invoice payment overview
            </p>


          </div>



          <div
            className="
              bg-green-100
              text-green-700
              px-3
              py-1
              rounded-full
              text-sm
              font-medium
            "
          >

            CASH

          </div>


        </div>







        <div
          className="
            bg-gray-50
            rounded-xl
            p-5
            space-y-4
          "
        >



          <div className="flex justify-between">


            <span className="text-gray-600">
              Invoice Total
            </span>


            <span
              className="
                font-semibold
                text-gray-800
              "
            >

              Rs. {Number(total).toLocaleString()}

            </span>


          </div>







          <div className="flex justify-between">


            <span className="text-gray-600">
              Paid Amount
            </span>


            <span
              className="
                font-semibold
                text-green-600
              "
            >

              Rs. {Number(paid).toLocaleString()}

            </span>


          </div>








          <div
            className="
              border-t
              pt-4
              flex
              justify-between
            "
          >


            <span className="text-gray-600">
              Remaining Balance
            </span>



            <span
              className={`
                font-bold
                ${
                  remaining > 0
                  ? "text-red-500"
                  : "text-green-600"
                }
              `}
            >

              Rs. {Number(remaining).toLocaleString()}

            </span>



          </div>



        </div>







        <button

          onClick={onPayment}

          className="
            mt-5
            w-full
            rounded-xl
            bg-green-600
            py-3
            text-sm
            font-semibold
            text-white
            transition
            hover:bg-green-700
          "

        >

          + Record Cash Payment

        </button>




      </div>


    </div>

  );

}
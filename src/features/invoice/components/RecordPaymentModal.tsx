"use client";

import { useState } from "react";
import { invoiceService } from "../services/invoiceService";


interface Props {
  invoiceId: string;
  onClose: () => void;
  onSuccess?: () => void;
}


export default function RecordPaymentModal({
  invoiceId,
  onClose,
  onSuccess,
}: Props) {


  const [amount, setAmount] = useState("");

  const [loading, setLoading] = useState(false);



  async function handleSave() {


    if (!amount || Number(amount) <= 0) {

      alert("Please enter a valid amount");

      return;

    }



    try {

      setLoading(true);



      await invoiceService.addPayment(
        invoiceId,
        Number(amount)
      );



      alert("Payment recorded successfully");


      onSuccess?.();

      onClose();



    } catch (error) {


      alert(
        error instanceof Error
          ? error.message
          : "Something went wrong"
      );


    } finally {


      setLoading(false);


    }

  }




  return (

    <div className="
      fixed
      inset-0
      bg-black/40
      flex
      items-center
      justify-center
      z-50
    ">


      <div className="
        bg-white
        rounded-xl
        p-6
        w-full
        max-w-md
      ">


        <h2 className="
          text-xl
          font-bold
          mb-2
        ">
          Record Payment
        </h2>



        <p className="
          text-gray-500
          mb-5
        ">
          Add cash payment for this invoice
        </p>





        <label className="text-sm">
          Amount
        </label>


        <input

          type="number"

          value={amount}

          onChange={(e) =>
            setAmount(e.target.value)
          }

          placeholder="Enter amount"

          className="
            w-full
            border
            rounded-lg
            p-3
            mb-6
          "

        />







        <div className="
          flex
          justify-end
          gap-3
        ">


          <button

            onClick={onClose}

            className="
              border
              px-4
              py-2
              rounded-lg
            "

          >

            Cancel

          </button>







          <button

            onClick={handleSave}

            disabled={loading}

            className="
              bg-blue-600
              text-white
              px-4
              py-2
              rounded-lg
            "

          >

            {
              loading
              ? "Saving..."
              : "Save Payment"
            }


          </button>


        </div>



      </div>


    </div>

  );

}
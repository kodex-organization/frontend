export default function InvoiceSummary({invoice}:any){

return(

<div className="rounded-lg border bg-white p-5">

<div className="grid grid-cols-3 gap-5 text-sm">


<div>
<p className="text-gray-500">Branch</p>
<p className="font-medium">
{invoice.branch}
</p>
</div>


<div>
<p className="text-gray-500">
Invoice Number
</p>

<p className="text-blue-600 font-medium">
{invoice.invoiceNumber}
</p>

</div>



<div className="row-span-3 border rounded-lg p-4">

<p className="text-xs text-gray-500">
TOTAL AMOUNT
</p>

<h2 className="text-3xl font-bold text-green-600">
$ {invoice.totalAmount}
</h2>


<p className="mt-3 text-gray-500">
Payment Method
</p>

<p className="text-green-600 font-medium">
💵 {invoice.paymentMethod}
</p>


</div>




<div>

<p className="text-gray-500">
Cashier
</p>

<p>
{invoice.cashier}
</p>

</div>




<div>

<p className="text-gray-500">
Invoice Date
</p>

<p>
{invoice.date}
</p>

</div>




<div>

<p className="text-gray-500">
Customer
</p>

<p>
{invoice.customer}
</p>

</div>


</div>

</div>

)

}
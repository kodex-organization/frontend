interface Props{
onVoid:()=>void;
}


export default function InvoiceActions({
onVoid
}:Props){

return(

<div className="rounded-lg border bg-white p-4">


<h2 className="font-semibold mb-4">
Invoice Actions
</h2>


<button className="w-full border rounded-lg py-2 mb-3">
⬇ View Receipt
</button>


<button
onClick={onVoid}
className="w-full bg-red-600 text-white rounded-lg py-2"
>

🗑 Void Invoice

</button>


<div className="mt-4 bg-yellow-50 text-yellow-700 text-sm p-3 rounded">
Only managers can void invoices.
</div>


</div>

)

}
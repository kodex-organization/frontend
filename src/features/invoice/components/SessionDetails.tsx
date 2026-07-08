interface Props{

session:any;

}



export default function SessionDetails({session}:Props){



return(


<div className="
bg-white
rounded-xl
shadow
p-6
mb-6
">



<h2 className="
text-xl
font-semibold
mb-5
">

Session Details

</h2>





<div className="
grid
md:grid-cols-3
gap-5
">



<div>

<p className="text-gray-500">

Table

</p>

<p className="font-semibold">

{session.table}

</p>

</div>




<div>

<p className="text-gray-500">

Duration

</p>

<p className="font-semibold">

{session.duration}

</p>

</div>




<div>

<p className="text-gray-500">

Hourly Rate

</p>

<p className="font-semibold">

${session.rate}/hour

</p>

</div>




<div>

<p className="text-gray-500">

Session Start

</p>

<p className="font-semibold">

{session.start}

</p>

</div>





<div>

<p className="text-gray-500">

Session End

</p>

<p className="font-semibold">

{session.end}

</p>

</div>




<div>

<p className="text-gray-500">

Session Total

</p>


<p className="
font-bold
text-xl
">

${session.total}

</p>


</div>




</div>


</div>


)


}
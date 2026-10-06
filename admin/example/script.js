const addButton =
document.getElementById("addAppointment");


const table =
document.getElementById("scheduleTable");



let count = 18;


const appointmentCounter =
document.getElementById("appointmentCount");




addButton.onclick=function(){



let client =
document.getElementById("clientName").value;


let phone =
document.getElementById("phone").value;


let date =
document.getElementById("date").value;


let time =
document.getElementById("time").value;


let treatment =
document.getElementById("treatment").value;


let dentist =
document.getElementById("dentist").value;




if(
client=="" ||
phone=="" ||
date=="" ||
time=="" ||
treatment=="Treatment Type"

){

alert("Please complete all fields");

return;

}





let row =
table.insertRow();



row.insertCell(0).innerHTML=time;

row.insertCell(1).innerHTML=client;

row.insertCell(2).innerHTML=dentist;

row.insertCell(3).innerHTML=treatment;


let status =
row.insertCell(4);


status.innerHTML="Pending";

status.className="status";



row.insertCell(5).innerHTML=date;




count++;

appointmentCounter.innerHTML=count;




document.getElementById("clientName").value="";

document.getElementById("phone").value="";

document.getElementById("date").value="";

document.getElementById("time").value="";


document.getElementById("treatment").selectedIndex=0;

document.getElementById("dentist").selectedIndex=0;



alert("Appointment Added!");

};







// Calendar selection


let days =
document.querySelectorAll(".day");



days.forEach(day=>{


day.onclick=function(){


days.forEach(d=>{

d.classList.remove("active");

});


this.classList.add("active");


};


});
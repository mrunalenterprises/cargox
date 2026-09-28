const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const formatMoney=p=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(p/100);
let selected="auto";
async function api(path,options={}){
 const r=await fetch(path,{headers:{"Content-Type":"application/json"},...options});
 const obj=await r.json();if(!r.ok)throw Error(obj.message||obj.error||"Demo request failed");return obj;
}
const post=(path,obj)=>api(path,{method:"POST",body:JSON.stringify(obj)});
const result=(id,message,err=false)=>{$(id).textContent=message;$(id).className=err?"status error":"status"};
function setView(view){
 for(const v of ["customer","partner","admin"])$("view-"+v).classList.toggle("hidden",v!==view);
 for(const b of document.querySelectorAll("[data-view]")){
   b.classList.toggle("active",b.dataset.view===view);
   b.setAttribute("aria-current",b.dataset.view===view?"page":"false");
 }
 if(view==="partner")refreshOffers();if(view==="admin")refreshAdmin();
}
for(const b of document.querySelectorAll("[data-view]"))b.addEventListener("click",()=>setView(b.dataset.view));
$("mode").addEventListener("change",()=>$("schedule-row").classList.toggle("hidden",$("mode").value!=="schedule"));
$("return-ride").addEventListener("change",()=>$("return-row").classList.toggle("hidden",!$("return-ride").checked));
$("partner-id").addEventListener("change",refreshOffers);
$("refresh-offers").addEventListener("click",refreshOffers);
$("refresh-admin").addEventListener("click",refreshAdmin);
$("start-ride").addEventListener("click",async()=>{
 try{const ride=await post("/api/rides/"+encodeURIComponent($("partner-ride-id").value.trim())+"/start",
    {partnerId:$("partner-id").value,code:$("trip-code").value});
   result("partner-result","Started demo ride "+ride.id);await refreshOffers();await refreshRides();}
 catch(e){result("partner-result",e.message,true);}
});
$("finish-ride").addEventListener("click",async()=>{
 try{const ride=await post("/api/rides/"+encodeURIComponent($("partner-ride-id").value.trim())+"/finish",
   {partnerId:$("partner-id").value});
   result("partner-result","Demo ride completed: "+ride.id);await refreshOffers();await refreshRides();}
 catch(e){result("partner-result",e.message,true);}
});
const icons={bike:"🏍️",auto:"🛺",car:"🚘",outstation:"🚖",shared:"🚙"};
const labels={bike:["Bike","Quick solo commute"],auto:["Auto","Easy city hops"],car:["Car","Comfort on demand"],outstation:["Outstation","Go beyond the city"],shared:["Shared Car","More seats. Less spend."]};
async function loadCatalog(){
 try{
  const data=await api("/api/catalog");
  $("service-cards").innerHTML=data.services.map(x=>{
   const [title,meta]=labels[x.id];
   return '<button type="button" class="vehicle-card '+(!x.available?"off":"")+' '+(selected===x.id?"selected":"")+'" data-service="'+x.id+'" '+(!x.available?"disabled":"")+' aria-label="'+title+(x.available?" choose service":" coming soon")+'">'+
   '<span class="vehicle" aria-hidden="true">'+icons[x.id]+'</span><h3>'+title+'</h3><p class="meta">'+meta+'</p><span class="chip">'+(x.available?"DEMO AVAILABLE":"COMING SOON")+'</span></button>';
  }).join("");
  $("service-cards").querySelectorAll("[data-service]").forEach(b=>b.addEventListener("click",()=>{
   selected=b.dataset.service;$("service").value=selected;
   $("service-cards").querySelectorAll(".vehicle-card").forEach(x=>x.classList.toggle("selected",x===b));
   $("ride-form").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"center"});
  }));
 }catch(e){$("service-cards").textContent=e.message;}
}
$("service").addEventListener("change",()=>{selected=$("service").value;loadCatalog();});
$("ride-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const payload={service:$("service").value,pickup:$("pickup").value,drop:$("drop").value,distanceKm:Number($("km").value),
 mode:$("mode").value,pinkOnly:$("pink-only").checked,
 allPassengersWomenVerified:$("verified-women").checked};
 if(payload.mode==="schedule"){
   if(!$("schedule").value){result("ride-result","Please choose a future date and time.",true);return}
   payload.scheduledAt=$("schedule").value.slice(0,16);
 }
 try{
   const r=await post("/api/rides",payload);
   result("ride-result","Created local DEMO "+r.service+" ride. Estimated fare "+formatMoney(r.quote.farePaise)+". Partner must accept manually.");
   await refreshRides();
 }catch(e){result("ride-result",e.message,true);}
});
async function refreshRides(){
 try{
  const rides=(await api("/api/rides")).slice().reverse();
  $("customer-rides").innerHTML=rides.length?"<h3>Demo ride history</h3>"+rides.slice(0,8).map(r=>
   '<div class="result-card"><strong>'+esc(r.service.toUpperCase())+' · '+esc(r.state)+'</strong>'+
   '<p>'+esc(r.pickup)+' → '+esc(r.drop)+' · '+formatMoney(r.quote.farePaise)+'</p>'+
   (r.pinkOnly?'<p>♀ Pink Rider Only (strict)</p>':"")+
   '<p>Ride ID: '+esc(r.id)+'</p>'+
   (r.state==="ASSIGNED"?'<button class="small-btn" data-code="'+esc(r.id)+'" type="button">Show demo customer trip code</button>':"")+'</div>').join(""):"";
  $("customer-rides").querySelectorAll("[data-code]").forEach(btn=>btn.addEventListener("click",async()=>{
   try{const d=await api("/api/demo/customer-code?rideId="+encodeURIComponent(btn.dataset.code));
     btn.textContent="Your assigned demo trip code: "+d.code;
   }catch(e){btn.textContent=e.message;}
  }));
 }catch(e){result("ride-result",e.message,true);}
}
function localISODate(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
{
 const date=new Date();
 $("pack-start").value=localISODate(date);
 const later=new Date(date);later.setDate(later.getDate()+27);
 $("pack-end").value=localISODate(later);
}
$("pack-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const weekdays=[...$("weekday").querySelectorAll('input[type="checkbox"]:checked')].map(x=>Number(x.value));
 const payload={service:$("pack-service").value,purpose:$("purpose").value,
 pickup:$("pack-pickup").value,drop:$("pack-drop").value,distanceKm:Number($("pack-km").value),
 startDate:$("pack-start").value,endDate:$("pack-end").value,
 weekdays,pickupTime:$("pack-time").value,returnTime:$("return-ride").checked?$("return-time").value:null};
 try{
  const plan=await post("/api/plans/quote",payload);
  $("pack-result").innerHTML='<div class="result-card"><strong>Monthly pack estimate: '+formatMoney(plan.totalPaise)+'</strong>'+
   '<p>'+plan.legs.length+' individual ride legs scheduled on selected dates. Per-leg demo estimate '+formatMoney(plan.perLegQuote.farePaise)+'.</p>'+
   '<p>Unpaid preview. This is not a guaranteed driver assignment or subscription purchase.</p></div>';
 }catch(e){$("pack-result").textContent=e.message;$("pack-result").className="status error";}
});
async function refreshOffers(){
 const id=$("partner-id").value;
 try{
  const offers=await api("/api/offers?partnerId="+encodeURIComponent(id));
  $("offers").innerHTML=offers.length?offers.map(r=>
   '<div class="result-card"><strong>'+esc(r.service.toUpperCase())+" · "+(r.pinkOnly?"PINK ONLY":"STANDARD")+'</strong>'+
   '<p>'+esc(r.pickup)+" → "+esc(r.drop)+" · "+formatMoney(r.quote.farePaise)+'</p>'+
   '<p>'+esc(r.id)+'</p>'+
   '<button class="small-btn" data-accept="'+esc(r.id)+'" type="button">Accept eligible ride</button></div>').join(""):'<p class="status muted">No eligible offers right now. Create a demo customer ride, then refresh.</p>';
  $("offers").querySelectorAll("[data-accept]").forEach(btn=>btn.addEventListener("click",async()=>{
   try{const ride=await post("/api/rides/"+encodeURIComponent(btn.dataset.accept)+"/accept",{partnerId:id});
    $("partner-ride-id").value=ride.id;
    result("partner-result","Accepted "+ride.id+". Open Customer tab for the demo OTP.");
    await refreshOffers();await refreshRides();
   }catch(e){result("partner-result",e.message,true);}
  }));
 }catch(e){$("offers").textContent=e.message;}
}
async function refreshAdmin(){
 try{
  const data=await api("/api/admin");
  const metrics=[["Total rides",data.rides.length],["Completed",data.rides.filter(x=>x.state==="COMPLETED").length],
   ["Active",data.rides.filter(x=>["ASSIGNED","IN_PROGRESS"].includes(x.state)).length],
   ["Demo drivers",data.partners.length],["Unpaid pack previews",data.plans.length],["Audit entries",data.auditCount]];
  $("admin-summary").innerHTML=metrics.map(([label,value])=>'<div class="metric"><strong>'+value+'</strong><span>'+esc(label)+'</span></div>').join("");
  $("admin-rides").innerHTML=data.rides.length?data.rides.slice().reverse().map(r=>
   '<div class="result-card"><strong>'+esc(r.state)+' · '+esc(r.service)+'</strong><p>'+esc(r.pickup)+' → '+esc(r.drop)+
   " | "+esc(r.partnerId||"Unassigned")+'</p></div>').join(""):'<p class="status muted">No demo bookings yet.</p>';
 }catch(e){$("admin-summary").textContent=e.message;}
}
loadCatalog();refreshRides();

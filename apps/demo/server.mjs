import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { RideEngine, DomainError } from "../../packages/cargox_domain/src/index.mjs";

const here=dirname(fileURLToPath(import.meta.url));
const assets={"/": ["index.html","text/html; charset=utf-8"],
  "/index.html":["index.html","text/html; charset=utf-8"],
  "/app.js":["app.js","text/javascript; charset=utf-8"],
  "/styles.css":["styles.css","text/css; charset=utf-8"]};
const respond=(res,status,body,extra={})=>{
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...extra});
  res.end(JSON.stringify(body));
};
async function bodyJSON(req){
  let data="",bytes=0;
  for await(const chunk of req){bytes+=chunk.length;if(bytes>32768)throw new DomainError("TOO_LARGE","Max 32 KB JSON payload");data+=chunk;}
  try{return data?JSON.parse(data):{}}catch{throw new DomainError("INVALID_JSON","Malformed JSON");}
}
export function createDemoServer(){
 const engine=new RideEngine();
 // These are demo-only fixtures. They are not real verified partners.
 engine.registerDemoPartner({id:"demo-auto-01",name:"Demo auto driver",services:["auto","car"],
   approved:true,online:true,docsValid:true,identityVerified:true});
 engine.registerDemoPartner({id:"demo-pink-01",name:"Demo Pink Rider",services:["auto","car"],
   approved:true,online:true,docsValid:true,identityVerified:true,
   womanVerified:true,pinkOptIn:true,pinkMode:"women_only"});
 const server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,"http://localhost");
   const path=url.pathname;
   const json=req.method==="POST"?await bodyJSON(req):{};
   if(req.method==="GET"&&path==="/api/health")return respond(res,200,{ok:true,mode:"local-only-demo",readyForProduction:false});
   if(req.method==="GET"&&path==="/api/catalog")return respond(res,200,engine.catalog());
   if(req.method==="GET"&&path==="/api/demo/partners")return respond(res,200,[...engine.partners.values()]);
   if(req.method==="GET"&&path==="/api/rides")return respond(res,200,[...engine.rides.values()].map(r=>({
     id:r.id,service:r.service,pickup:r.pickup,drop:r.drop,state:r.state,partnerId:r.partnerId,quote:r.quote,pinkOnly:r.pinkOnly,mode:r.mode,scheduledAt:r.scheduledAt,leg:r.leg
   })));
   if(req.method==="POST"&&path==="/api/quotes")return respond(res,200,engine.quote(json));
   if(req.method==="GET"&&path==="/api/plans")return respond(res,200,[...engine.plans.values()]);
   if(req.method==="POST"&&path==="/api/rides")return respond(res,201,engine.createRide(json));
   if(req.method==="GET"&&path==="/api/offers")return respond(res,200,engine.partnerOffers(url.searchParams.get("partnerId")));
   if(req.method==="GET"&&path==="/api/demo/customer-code"){
     // This route is ONLY a local no-auth test harness. Never enable on a deployed server.
     return respond(res,200,{code:engine.customerStartCode(url.searchParams.get("rideId"))});
   }
   const action=path.match(/^\/api\/rides\/([a-f0-9-]+)\/(accept|start|finish)$/);
   if(req.method==="POST"&&action){
     const [,id,operation]=action;
     return respond(res,200,operation==="accept"?engine.accept(id,json.partnerId):
       operation==="start"?engine.start(id,json.partnerId,json.code):engine.finish(id,json.partnerId));
   }
   if(req.method==="POST"&&path==="/api/plans/quote")return respond(res,200,engine.previewPack(json));
   if(req.method==="POST"&&path==="/api/plans/demo")return respond(res,201,engine.createDemoPack(json));
   if(req.method==="GET"&&path==="/api/admin")return respond(res,200,engine.adminSummary());
   if(req.method==="GET"&&Object.hasOwn(assets,path)){
     const [asset,mime]=assets[path];const raw=await readFile(join(here,"public",asset));
     res.writeHead(200,{"Content-Type":mime,"X-Content-Type-Options":"nosniff",
       "Content-Security-Policy":"default-src 'self'; connect-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; base-uri 'none'; object-src 'none'"});
     return res.end(raw);
   }
   return respond(res,404,{error:"NOT_FOUND",message:"Resource not found"});
  }catch(e){
   if(e instanceof DomainError)return respond(res,400,{error:e.code,message:e.message});
   console.error("Demo request failed",e);
   return respond(res,500,{error:"INTERNAL",message:"Demo request failed"});
  }
 });
 return {server,engine};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const port=Number(process.env.PORT)||4173;
 const host="127.0.0.1"; // intentional: unauthenticated demo MUST NOT listen publicly
 createDemoServer().server.listen(port,host,()=>{
   console.log("CargoX LOCAL DEMO only: http://"+host+":"+port);
   console.log("DO NOT expose this unauthenticated demo server to the internet.");
 });
}

import { runtimeConfig as cfg } from './runtime-config.js';

const key=String(cfg.googleMapsApiKey||'').trim();
let loader=null;
function cleanPoints(points=[]){return points.map(p=>({lat:Number(p.latitude),lng:Number(p.longitude),capturedAt:p.captured_at||p.capturedAt||null})).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180)}
async function loadGoogle(){if(!key)throw new Error('google_maps_not_configured');if(globalThis.google?.maps)return globalThis.google.maps;if(loader)return loader;loader=new Promise((resolve,reject)=>{const callback=`__loadinMapsReady_${Date.now()}`;globalThis[callback]=()=>{delete globalThis[callback];resolve(globalThis.google.maps)};const s=document.createElement('script');s.async=true;s.defer=true;s.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&callback=${callback}`;s.onerror=()=>{delete globalThis[callback];loader=null;reject(new Error('google_maps_load_failed'))};document.head.appendChild(s)});return loader}
function fitMap(map,maps,coords){if(!coords.length)return;const bounds=new maps.LatLngBounds();coords.forEach(p=>bounds.extend(p));if(coords.length===1){map.setCenter(coords[0]);map.setZoom(15)}else map.fitBounds(bounds,48)}
export const googleMapsProduction={
  configured:Boolean(key),
  cleanPoints,
  async renderTrackingMap(container,{points=[],partnerLabel='Partner',zoom=14}={}){
    if(!container)throw new Error('map_container_required');const coords=cleanPoints(points);if(!this.configured||!coords.length)return {rendered:false,reason:!this.configured?'NOT_CONFIGURED':'NO_POINTS'};const maps=await loadGoogle();container.innerHTML='';const map=new maps.Map(container,{center:coords[0],zoom,mapTypeControl:false,streetViewControl:false,fullscreenControl:false,clickableIcons:false});const chronological=[...coords].reverse();new maps.Polyline({map,path:chronological,geodesic:true,strokeColor:'#ff7a00',strokeOpacity:.9,strokeWeight:5});const latest=coords[0];new maps.Marker({map,position:latest,title:partnerLabel});fitMap(map,maps,chronological);return {rendered:true,count:coords.length,latest}
  },
  async renderOperationsMap(container,{trips=[],partners=[]}={}){
    if(!container)throw new Error('map_container_required');const tripPoints=trips.filter(x=>Number.isFinite(Number(x.latitude))&&Number.isFinite(Number(x.longitude))).map(x=>({lat:Number(x.latitude),lng:Number(x.longitude),label:`${x.service_code||'Trip'} • ${x.status||''}`}));const partnerPoints=partners.filter(x=>Number.isFinite(Number(x.latitude))&&Number.isFinite(Number(x.longitude))).map(x=>({lat:Number(x.latitude),lng:Number(x.longitude),label:`${x.name||'Partner'} • ${x.online_status||''}`}));const all=[...tripPoints,...partnerPoints];if(!this.configured||!all.length)return {rendered:false,reason:!this.configured?'NOT_CONFIGURED':'NO_POINTS'};const maps=await loadGoogle();container.innerHTML='';const map=new maps.Map(container,{center:all[0],zoom:12,mapTypeControl:false,streetViewControl:false,fullscreenControl:true,clickableIcons:false});tripPoints.forEach(p=>new maps.Marker({map,position:p,title:p.label}));partnerPoints.forEach(p=>new maps.Marker({map,position:p,title:p.label,opacity:.75}));fitMap(map,maps,all);return {rendered:true,trips:tripPoints.length,partners:partnerPoints.length}
  }
};

export function customerReliability({completedTrips=0,cancellations=0,noShows=0,disputesLost=0,onTimePickupReadyPercent=100}={}){
  const penalty=cancellations*6+noShows*12+disputesLost*10+Math.max(0,90-Number(onTimePickupReadyPercent||0))*0.35;
  const activity=Math.min(8,Math.floor(Number(completedTrips||0)/5));
  const score=Math.max(0,Math.min(100,Math.round(92+activity-penalty)));
  let category='EXCELLENT',restriction='NONE';
  if(score<55){category='RESTRICTED';restriction='MANUAL_REVIEW'}
  else if(score<70){category='WATCH';restriction='PREPAID_ONLY'}
  else if(score<85)category='GOOD';
  return {score,category,restriction};
}

export function partnerPlanComparison({monthlyTrips=0,averageFare=0,subscriptionFee=1999,commissionRate=0.15}={}){
  const trips=Math.max(0,Number(monthlyTrips)||0), fare=Math.max(0,Number(averageFare)||0);
  const commissionCost=Math.round(trips*fare*commissionRate);
  const subscriptionCost=trips>0?Math.max(0,Number(subscriptionFee)||0):0;
  const recommended=trips>0&&subscriptionCost<commissionCost?'SUBSCRIPTION':'COMMISSION';
  return {commissionCost,subscriptionCost,recommended,savings:Math.abs(commissionCost-subscriptionCost)};
}

export function shiftingInspection({itemCount=0,heavyItemKg=0,specialItemCount=0,floor=0,hasLift=true,narrowAccess=false,declaredValue=0}={}){
  const reasons=[];
  if(Number(itemCount)>=20)reasons.push('ITEM_COUNT');
  if(Number(heavyItemKg)>=50)reasons.push('HEAVY_ITEM');
  if(Number(specialItemCount)>=3)reasons.push('SPECIAL_ITEMS');
  if(Number(floor)>=3&&!hasLift)reasons.push('HIGH_FLOOR_NO_LIFT');
  if(narrowAccess)reasons.push('NARROW_ACCESS');
  if(Number(declaredValue)>=100000)reasons.push('HIGH_DECLARED_VALUE');
  const skills=['PACKING','LOADING'];
  if(Number(heavyItemKg)>=50)skills.push('HEAVY_HANDLING');
  if(Number(specialItemCount)>0)skills.push('FRAGILE_HANDLING');
  if(Number(itemCount)>=10)skills.push('SUPERVISOR');
  return {inspectionRequired:reasons.length>0,reasons,requiredSkills:[...new Set(skills)]};
}

export function cityServiceState({cityEnabled=true,serviceEnabled=true,paused=false,comingSoon=false}={}){
  if(!cityEnabled)return {status:'DISABLED',bookable:false,label:'City unavailable'};
  if(paused)return {status:'PAUSED',bookable:false,label:'Temporarily paused'};
  if(comingSoon||!serviceEnabled)return {status:'COMING_SOON',bookable:false,label:'Coming Soon'};
  return {status:'ACTIVE',bookable:true,label:'Book Now'};
}

const ROLE_PERMISSIONS={
  SUPER_ADMIN:['DASHBOARD','LIVE_OPS','BOOKINGS','PARTNERS','PRICING','FINANCE','SUPPORT','SAFETY','CITIES','STAFF','AUDIT'],
  GM:['DASHBOARD','LIVE_OPS','BOOKINGS','PARTNERS','PRICING','SUPPORT','CITIES'],
  ACCOUNTS:['DASHBOARD','BOOKINGS','FINANCE'],
  FIELD_OFFICER:['DASHBOARD','PARTNERS']
};
export function adminRolePermissions(role){const key=String(role||'').toUpperCase();return {role:key,permissions:ROLE_PERMISSIONS[key]?[...ROLE_PERMISSIONS[key]]:[]}}

export function cargoProtection({declaredValue=0,protectionSelected=false,pickupProof=false,deliveryProof=false,receiverOtp=false}={}){
  const value=Math.max(0,Number(declaredValue)||0);
  const recommended=value>=5000;
  const proofComplete=Boolean(pickupProof&&deliveryProof&&receiverOtp);
  return {declaredValue:value,protectionRecommended:recommended,protectionStatus:protectionSelected?'SELECTED':recommended?'RECOMMENDED':'OPTIONAL',proofComplete};
}

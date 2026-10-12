export const PAYMENT_METHOD={CASH:'CASH',UPI:'UPI',ONLINE:'ONLINE'};
export const PARTNER_PLAN={COMMISSION:'COMMISSION',SUBSCRIPTION:'SUBSCRIPTION'};

export function mapRuntime(config={}){
  const key=String(config.googleMapsApiKey||'').trim();
  return {provider:'GOOGLE_MAPS',configured:Boolean(key),mode:key?'LIVE_READY':'DEMO',browserKeySafeOnlyWithRestrictions:true};
}

export function directionsLink({pickup,drop}){
  const p=encodeURIComponent(String(pickup||''));const d=encodeURIComponent(String(drop||''));
  return `https://www.google.com/maps/dir/?api=1&origin=${p}&destination=${d}&travelmode=driving`;
}

export function checkoutSummary({fare=0,extras=0,plan=PARTNER_PLAN.COMMISSION,method=PAYMENT_METHOD.CASH,gatewayRate=0.02}={}){
  const base=Math.max(0,Number(fare)||0);const pass=Math.max(0,Number(extras)||0);const commission=plan===PARTNER_PLAN.SUBSCRIPTION?0:Math.round(base*.15);const partnerBase=base-commission;const customerTotal=base+pass;const gatewayFee=method===PAYMENT_METHOD.ONLINE?Math.round(customerTotal*Math.max(0,Number(gatewayRate)||0)):0;
  return {fare:base,extras:pass,customerTotal,platformCommission:commission,partnerEntitlement:partnerBase+pass,gatewayFee,gatewayFeeChargedToCustomer:0,platformNet:Math.max(0,commission-gatewayFee),directToPartner:[PAYMENT_METHOD.CASH,PAYMENT_METHOD.UPI].includes(method),fareLocked:true};
}

const ALLOWED_TYPES=new Set(['application/pdf','image/jpeg','image/png','image/webp']);
export function validateDocumentUpload({name='',size=0,type=''}={}){
  const lower=String(name).toLowerCase();const extOk=/\.(pdf|jpe?g|png|webp)$/.test(lower);const typeOk=!type||ALLOWED_TYPES.has(type);const sizeOk=Number(size)>=0&&Number(size)<=10*1024*1024;
  return {ok:Boolean(name)&&extOk&&typeOk&&sizeOk,errors:[!name?'FILE_REQUIRED':null,!extOk?'INVALID_EXTENSION':null,!typeOk?'INVALID_TYPE':null,!sizeOk?'FILE_TOO_LARGE':null].filter(Boolean),maxBytes:10*1024*1024};
}

export function notificationPolicy(input={}){
  const policy={safety:true,activeTrip:true,partnerOffers:true,documents:true,payments:true,marketing:false,quietStart:'22:00',quietEnd:'07:00',...input};
  return {...policy,priorityBypassesQuietHours:['SOS','SAFETY','ACTIVE_TRIP','REPLACEMENT'],marketingAllowed:Boolean(policy.marketing)};
}

export function bookingOpsSummary({booking={},proofs=[],supportCases=[],events=[]}={}){
  const fare=Number(booking.locked_fare||booking.fare||0);const completed=booking.status==='COMPLETED';
  return {id:booking.id||null,status:booking.status||'UNKNOWN',route:`${booking.pickup_address||''} → ${booking.drop_address||''}`,fare,fareLocked:Boolean(booking.fare_locked??true),partnerAssigned:Boolean(booking.partner_id),proofCount:proofs.length,openSupport:supportCases.filter(c=>c.status==='OPEN').length,eventCount:events.length,commission:completed?Math.round(fare*.15):0,partnerEntitlement:completed?Math.round(fare*.85):0};
}

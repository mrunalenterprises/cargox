export function settleTrip({fare,plan='COMMISSION',paymentMode='CASH',gatewayFee=0}={}){
  const gross=Math.max(0,Number(fare||0));
  if(plan==='SUBSCRIPTION')return {gross,commission:0,partnerEntitlement:gross,commissionBalanceDebit:0,earningsCredit:0,directCustomerPay:gross,gatewayFeeToPlatform:0};
  const commission=Math.round(gross*.15);
  const partnerEntitlement=gross-commission;
  const online=paymentMode==='ONLINE';
  return {gross,commission,partnerEntitlement,commissionBalanceDebit:online?0:commission,earningsCredit:online?partnerEntitlement:0,directCustomerPay:online?0:gross,gatewayFeeToPlatform:Math.max(0,Number(gatewayFee||0))};
}
export function payoutEligibility({earningsBalance=0,reserve=0,minPayout=500}={}){
  const eligible=Math.max(0,Number(earningsBalance)-Number(reserve));
  return {eligible,canRequest:eligible>=minPayout,minPayout};
}
export function scoreOperationalRisk({sos=false,routeDeviationKm=0,gpsJump=false,multiAccount=false,duplicateProof=false,chargeback=false,cancellations=0}={}){
  let score=0;if(sos)score+=70;if(routeDeviationKm>=3)score+=22;else if(routeDeviationKm>=1)score+=10;if(gpsJump)score+=18;if(multiAccount)score+=22;if(duplicateProof)score+=18;if(chargeback)score+=20;score+=Math.min(20,Number(cancellations||0)*4);score=Math.min(100,score);
  const level=score>=70?'CRITICAL':score>=45?'HIGH':score>=20?'MEDIUM':'LOW';
  const action=level==='CRITICAL'?'P0_HUMAN_INTERVENTION':level==='HIGH'?'RESTRICT_AND_REVIEW':level==='MEDIUM'?'WATCH':'ALLOW';
  return {score,level,action};
}
export function buildMonthlyStatement(bookings=[]){
  const completed=bookings.filter(b=>b.status==='COMPLETED');
  const gross=completed.reduce((a,b)=>a+Number(b.locked_fare??b.fare??0),0);
  const commission=Math.round(gross*.15);
  return {trips:completed.length,gross,commission,partnerEntitlement:gross-commission};
}
export function toCsv(rows=[]){
  if(!rows.length)return '';
  const keys=Object.keys(rows[0]);
  const esc=v=>`"${String(v??'').replaceAll('"','""')}"`;
  return [keys.map(esc).join(','),...rows.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\n');
}

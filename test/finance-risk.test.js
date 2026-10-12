import test from 'node:test';
import assert from 'node:assert/strict';
import {settleTrip,payoutEligibility,scoreOperationalRisk,buildMonthlyStatement,toCsv} from '../apps/shared/finance-risk.js';

test('commission cash trip debits commission balance',()=>{const r=settleTrip({fare:1000,plan:'COMMISSION',paymentMode:'CASH'});assert.equal(r.commission,150);assert.equal(r.partnerEntitlement,850);assert.equal(r.commissionBalanceDebit,150);assert.equal(r.earningsCredit,0)});
test('commission online trip credits partner earnings',()=>{const r=settleTrip({fare:1000,plan:'COMMISSION',paymentMode:'ONLINE',gatewayFee:18});assert.equal(r.earningsCredit,850);assert.equal(r.gatewayFeeToPlatform,18);assert.equal(r.directCustomerPay,0)});
test('subscription partner has zero trip commission',()=>{const r=settleTrip({fare:1000,plan:'SUBSCRIPTION',paymentMode:'UPI'});assert.equal(r.commission,0);assert.equal(r.directCustomerPay,1000)});
test('payout eligibility respects reserve and minimum',()=>{assert.deepEqual(payoutEligibility({earningsBalance:2100,reserve:500,minPayout:500}),{eligible:1600,canRequest:true,minPayout:500})});
test('critical operational risk triggers p0 intervention',()=>{const r=scoreOperationalRisk({sos:true,routeDeviationKm:4,gpsJump:true});assert.equal(r.level,'CRITICAL');assert.equal(r.action,'P0_HUMAN_INTERVENTION')});
test('monthly statement counts completed trips only',()=>{const r=buildMonthlyStatement([{status:'COMPLETED',locked_fare:1000},{status:'ACTIVE',locked_fare:700},{status:'COMPLETED',locked_fare:500}]);assert.equal(r.trips,2);assert.equal(r.gross,1500);assert.equal(r.commission,225);assert.equal(r.partnerEntitlement,1275)});
test('csv export includes quoted headers and rows',()=>{const csv=toCsv([{id:'LDN-1',fare:780}]);assert.match(csv,/"id","fare"/);assert.match(csv,/"LDN-1","780"/)})

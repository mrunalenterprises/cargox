import test from 'node:test';
import assert from 'node:assert/strict';
import {customerReliability,partnerPlanComparison,shiftingInspection,cityServiceState,adminRolePermissions,cargoProtection} from '../apps/shared/readiness-ops.js';

test('reliable customer stays excellent',()=>{const r=customerReliability({completedTrips:20,cancellations:0,noShows:0,onTimePickupReadyPercent:96});assert.equal(r.category,'EXCELLENT');assert.equal(r.restriction,'NONE')});
test('repeated no shows trigger restriction',()=>{const r=customerReliability({completedTrips:2,noShows:4,cancellations:2,onTimePickupReadyPercent:50});assert.equal(r.category,'RESTRICTED');assert.equal(r.restriction,'MANUAL_REVIEW')});
test('subscription is recommended when cheaper',()=>{const r=partnerPlanComparison({monthlyTrips:30,averageFare:1000,subscriptionFee:1999});assert.equal(r.commissionCost,4500);assert.equal(r.recommended,'SUBSCRIPTION');assert.equal(r.savings,2501)});
test('commission remains better for low activity',()=>{const r=partnerPlanComparison({monthlyTrips:4,averageFare:700,subscriptionFee:1999});assert.equal(r.recommended,'COMMISSION')});
test('full shifting flags high-floor no-lift inspection',()=>{const r=shiftingInspection({itemCount:24,heavyItemKg:70,floor:4,hasLift:false});assert.equal(r.inspectionRequired,true);assert.ok(r.reasons.includes('HIGH_FLOOR_NO_LIFT'));assert.ok(r.requiredSkills.includes('HEAVY_HANDLING'))});
test('city service returns coming soon when service disabled',()=>{const r=cityServiceState({cityEnabled:true,serviceEnabled:false});assert.equal(r.status,'COMING_SOON');assert.equal(r.bookable,false)});
test('accounts cannot access safety or staff',()=>{const r=adminRolePermissions('accounts');assert.ok(r.permissions.includes('FINANCE'));assert.ok(!r.permissions.includes('SAFETY'));assert.ok(!r.permissions.includes('STAFF'))});
test('cargo protection recommended for declared value and proof completeness',()=>{const r=cargoProtection({declaredValue:12000,pickupProof:true,deliveryProof:true,receiverOtp:true});assert.equal(r.protectionRecommended,true);assert.equal(r.proofComplete,true)});

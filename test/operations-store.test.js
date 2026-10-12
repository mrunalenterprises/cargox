import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationsStore,generateRecurringOccurrences,replacementSettlement,reviewDecision,complianceSummary} from '../apps/shared/operations-store.js';

test('recurring occurrences respect weekdays and count',()=>{const rows=generateRecurringOccurrences({startDate:'2026-10-12',weekdays:['MON','WED','FRI'],time:'09:30',count:5});assert.equal(rows.length,5);assert.deepEqual(rows.map(x=>x.time),Array(5).fill('09:30'));assert.equal(rows[0].date,'2026-10-12');});

test('replacement settlement follows frozen breakdown rule',()=>{assert.deepEqual(replacementSettlement({originalFare:1000,completionPct:40}),{originalFare:1000,originalPartnerPayout:0,remainingWorkFare:600,platformCommission:150,replacementEntitlement:510,customerExtraPay:0});});

test('partner review requires all seven review groups',()=>{const partial=reviewDecision({profile:true});assert.equal(partial.ready,false);assert.ok(partial.missing.includes('bank'));const full=reviewDecision({profile:true,personalDocs:true,selfie:true,vehicle:true,vehicleDocs:true,bank:true,pricing:true});assert.equal(full.ready,true);assert.equal(full.status,'READY_FOR_APPROVAL');});

test('compliance summary blocks expired entities and flags 14 day expiry',()=>{const s=complianceSummary([{entity:'V1',expiresInDays:0},{entity:'V2',expiresInDays:7},{entity:'V3',expiresInDays:50}]);assert.equal(s.expired,1);assert.equal(s.expiring,1);assert.deepEqual(s.blockedEntities,['V1']);});

test('operations store creates recurring routes and replacement assignment',()=>{const store=createOperationsStore({storage:null});const route=store.addRecurringRoute({name:'Office',pickup:'A',drop:'B',startDate:'2026-10-12',weekdays:['MON'],time:'08:00'});assert.equal(route.occurrences.length,8);assert.equal(store.pauseRecurringRoute(route.id).active,false);const c=store.createReplacementCase({bookingId:'B1',originalFare:1000,completionPct:40});assert.equal(c.settlement.replacementEntitlement,510);assert.equal(store.assignReplacement(c.id).status,'REPLACEMENT_ASSIGNED');});

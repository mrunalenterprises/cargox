import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHIFTING_STAGE,
  SKILL,
  assessInspectionNeed,
  requiredTeamSkills,
  verifyTeam,
  buildInventoryChecklist,
  calculateShiftingQuote,
  canAdvanceStage,
  completionChecklist
} from '../src/domain/full-shifting.js';

test('large or complex move requires inspection', () => {
  const inventory = Array.from({ length: 20 }, (_, i) => ({ name: `Box ${i + 1}`, quantity: 1 }));
  const result = assessInspectionNeed({ inventory });
  assert.equal(result.required, true);
  assert.ok(result.reasons.includes('LARGE_INVENTORY'));
});

test('skills are derived from inventory handling needs', () => {
  const skills = requiredTeamSkills([
    { name: 'Wardrobe', dismantlingRequired: true },
    { name: 'TV', fragile: true },
    { name: 'Fridge', appliance: true }
  ]);
  assert.ok(skills.includes(SKILL.FURNITURE_DISMANTLING));
  assert.ok(skills.includes(SKILL.FRAGILE_HANDLING));
  assert.ok(skills.includes(SKILL.APPLIANCE_HANDLING));
  assert.ok(skills.includes(SKILL.SUPERVISOR));
});

test('team verification fails when required skill is missing', () => {
  const result = verifyTeam({
    requiredSkills: [SKILL.PACKING, SKILL.FRAGILE_HANDLING],
    members: [{ id: 'm1', verified: true, documentValid: true, skills: [SKILL.PACKING] }]
  });
  assert.equal(result.verified, false);
  assert.deepEqual(result.missingSkills, [SKILL.FRAGILE_HANDLING]);
});

test('inventory checklist requires pickup and delivery condition proof', () => {
  const checklist = buildInventoryChecklist([{ name: 'Sofa', quantity: 1 }]);
  assert.equal(checklist.length, 1);
  assert.equal(checklist[0].pickupConditionPhotoRequired, true);
  assert.equal(checklist[0].delivered, false);
});

test('quote produces locked total with bounded discount', () => {
  const quote = calculateShiftingQuote({
    transportFare: 2000,
    labour: 1000,
    packingMaterial: 500,
    discount: 300,
    tax: 100
  });
  assert.equal(quote.subtotal, 3500);
  assert.equal(quote.total, 3300);
  assert.equal(quote.fareLocked, true);
});

test('packing cannot start until assigned team is verified', () => {
  const blocked = canAdvanceStage({
    from: SHIFTING_STAGE.TEAM_ASSIGNED,
    to: SHIFTING_STAGE.PACKING_STARTED,
    teamVerified: false
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'TEAM_NOT_VERIFIED');

  const allowed = canAdvanceStage({
    from: SHIFTING_STAGE.TEAM_ASSIGNED,
    to: SHIFTING_STAGE.PACKING_STARTED,
    teamVerified: true
  });
  assert.equal(allowed.allowed, true);
});

test('completion requires delivered items, OTP, photos and customer signoff', () => {
  const result = completionChecklist({
    inventory: [{ delivered: true, deliveryConditionConfirmed: true }],
    receiverOtpVerified: true,
    deliveryPhotos: 2,
    customerSignoff: true
  });
  assert.equal(result.complete, true);
});

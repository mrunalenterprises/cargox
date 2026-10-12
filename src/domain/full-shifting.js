export const SHIFTING_STAGE = Object.freeze({
  DRAFT: 'DRAFT',
  INSPECTION_REQUIRED: 'INSPECTION_REQUIRED',
  INSPECTION_SCHEDULED: 'INSPECTION_SCHEDULED',
  QUOTED: 'QUOTED',
  ACCEPTED: 'ACCEPTED',
  TEAM_ASSIGNED: 'TEAM_ASSIGNED',
  PACKING_STARTED: 'PACKING_STARTED',
  LOADED: 'LOADED',
  IN_TRANSIT: 'IN_TRANSIT',
  UNLOADING: 'UNLOADING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
});

export const SKILL = Object.freeze({
  PACKING: 'PACKING',
  FURNITURE_DISMANTLING: 'FURNITURE_DISMANTLING',
  APPLIANCE_HANDLING: 'APPLIANCE_HANDLING',
  FRAGILE_HANDLING: 'FRAGILE_HANDLING',
  HEAVY_LIFTING: 'HEAVY_LIFTING',
  DRIVER: 'DRIVER',
  SUPERVISOR: 'SUPERVISOR'
});

const money = value => Math.round((Number(value) || 0) * 100) / 100;
const cleanItems = items => (Array.isArray(items) ? items : []).map((item, index) => ({
  id: item.id || `item-${index + 1}`,
  name: String(item.name || '').trim(),
  quantity: Math.max(1, Number(item.quantity) || 1),
  fragile: Boolean(item.fragile),
  dismantlingRequired: Boolean(item.dismantlingRequired),
  appliance: Boolean(item.appliance),
  estimatedWeightKg: Math.max(0, Number(item.estimatedWeightKg) || 0)
})).filter(item => item.name);

export function assessInspectionNeed({ inventory = [], floors = {}, access = {}, declaredValue = 0 } = {}) {
  const items = cleanItems(inventory);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const heavyItems = items.filter(item => item.estimatedWeightKg >= 50).length;
  const specialItems = items.filter(item => item.fragile || item.dismantlingRequired || item.appliance).length;
  const highFloor = Math.max(Number(floors.pickup) || 0, Number(floors.drop) || 0) >= 3;
  const noLift = access.pickupLift === false || access.dropLift === false;
  const narrowAccess = Boolean(access.narrowStairs || access.longCarry || access.vehicleAccessRestricted);
  const required = itemCount >= 20 || heavyItems > 0 || specialItems >= 3 || highFloor || noLift || narrowAccess || Number(declaredValue) >= 100000;
  return {
    required,
    reasons: [
      itemCount >= 20 && 'LARGE_INVENTORY',
      heavyItems > 0 && 'HEAVY_ITEMS',
      specialItems >= 3 && 'SPECIAL_HANDLING',
      highFloor && 'HIGH_FLOOR',
      noLift && 'NO_LIFT',
      narrowAccess && 'ACCESS_CONSTRAINT',
      Number(declaredValue) >= 100000 && 'HIGH_DECLARED_VALUE'
    ].filter(Boolean)
  };
}

export function requiredTeamSkills(inventory = [], { needsSupervisor = true } = {}) {
  const items = cleanItems(inventory);
  const skills = new Set([SKILL.PACKING, SKILL.HEAVY_LIFTING]);
  if (items.some(item => item.dismantlingRequired)) skills.add(SKILL.FURNITURE_DISMANTLING);
  if (items.some(item => item.appliance)) skills.add(SKILL.APPLIANCE_HANDLING);
  if (items.some(item => item.fragile)) skills.add(SKILL.FRAGILE_HANDLING);
  if (needsSupervisor) skills.add(SKILL.SUPERVISOR);
  return [...skills];
}

export function verifyTeam({ requiredSkills = [], members = [] } = {}) {
  const activeMembers = (Array.isArray(members) ? members : []).filter(member => member.active !== false && member.verified === true);
  const covered = new Set(activeMembers.flatMap(member => member.skills || []));
  const missingSkills = requiredSkills.filter(skill => !covered.has(skill));
  const expiredDocs = activeMembers.filter(member => member.documentValid === false).map(member => member.memberId || member.id);
  return {
    verified: activeMembers.length > 0 && missingSkills.length === 0 && expiredDocs.length === 0,
    activeVerifiedMembers: activeMembers.length,
    missingSkills,
    expiredDocs
  };
}

export function buildInventoryChecklist(inventory = []) {
  return cleanItems(inventory).map(item => ({
    ...item,
    pickupConditionPhotoRequired: true,
    packed: false,
    loaded: false,
    delivered: false,
    deliveryConditionConfirmed: false
  }));
}

export function calculateShiftingQuote({ transportFare = 0, labour = 0, packingMaterial = 0, dismantling = 0, applianceHandling = 0, stairs = 0, longCarry = 0, protection = 0, discount = 0, tax = 0 } = {}) {
  const subtotal = money([transportFare, labour, packingMaterial, dismantling, applianceHandling, stairs, longCarry, protection].reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0));
  const safeDiscount = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const taxable = money(subtotal - safeDiscount);
  const total = money(taxable + Math.max(0, Number(tax) || 0));
  return { subtotal, discount: money(safeDiscount), taxable, tax: money(Math.max(0, Number(tax) || 0)), total, fareLocked: true };
}

export function canAdvanceStage({ from, to, quoteAccepted = false, teamVerified = false, pickupProofComplete = false } = {}) {
  const allowed = {
    [SHIFTING_STAGE.DRAFT]: [SHIFTING_STAGE.INSPECTION_REQUIRED, SHIFTING_STAGE.QUOTED, SHIFTING_STAGE.CANCELLED],
    [SHIFTING_STAGE.INSPECTION_REQUIRED]: [SHIFTING_STAGE.INSPECTION_SCHEDULED, SHIFTING_STAGE.CANCELLED],
    [SHIFTING_STAGE.INSPECTION_SCHEDULED]: [SHIFTING_STAGE.QUOTED, SHIFTING_STAGE.CANCELLED],
    [SHIFTING_STAGE.QUOTED]: [SHIFTING_STAGE.ACCEPTED, SHIFTING_STAGE.CANCELLED],
    [SHIFTING_STAGE.ACCEPTED]: [SHIFTING_STAGE.TEAM_ASSIGNED, SHIFTING_STAGE.CANCELLED],
    [SHIFTING_STAGE.TEAM_ASSIGNED]: [SHIFTING_STAGE.PACKING_STARTED, SHIFTING_STAGE.CANCELLED],
    [SHIFTING_STAGE.PACKING_STARTED]: [SHIFTING_STAGE.LOADED],
    [SHIFTING_STAGE.LOADED]: [SHIFTING_STAGE.IN_TRANSIT],
    [SHIFTING_STAGE.IN_TRANSIT]: [SHIFTING_STAGE.UNLOADING],
    [SHIFTING_STAGE.UNLOADING]: [SHIFTING_STAGE.COMPLETED]
  };
  if (!(allowed[from] || []).includes(to)) return { allowed: false, reason: 'INVALID_STAGE_TRANSITION' };
  if (to === SHIFTING_STAGE.ACCEPTED && !quoteAccepted) return { allowed: false, reason: 'QUOTE_NOT_ACCEPTED' };
  if (to === SHIFTING_STAGE.PACKING_STARTED && !teamVerified) return { allowed: false, reason: 'TEAM_NOT_VERIFIED' };
  if (to === SHIFTING_STAGE.LOADED && !pickupProofComplete) return { allowed: false, reason: 'PICKUP_PROOF_INCOMPLETE' };
  return { allowed: true, reason: null };
}

export function completionChecklist({ inventory = [], receiverOtpVerified = false, deliveryPhotos = 0, customerSignoff = false } = {}) {
  const items = Array.isArray(inventory) ? inventory : [];
  const allDelivered = items.length > 0 && items.every(item => item.delivered === true && item.deliveryConditionConfirmed === true);
  const complete = allDelivered && receiverOtpVerified && Number(deliveryPhotos) > 0 && customerSignoff;
  return { complete, allDelivered, receiverOtpVerified, deliveryPhotos: Number(deliveryPhotos) || 0, customerSignoff };
}

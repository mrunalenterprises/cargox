export const PROOF_STAGE = Object.freeze({
  PICKUP: 'PICKUP',
  HANDOVER: 'HANDOVER',
  DELIVERY: 'DELIVERY',
});

export function validateDeclaredGoods({ description, declaredValue = 0, prohibited = false }) {
  if (!description || String(description).trim().length < 2) throw new Error('goods_description_required');
  if (prohibited) throw new Error('prohibited_goods');
  const value = Number(declaredValue || 0);
  if (!Number.isFinite(value) || value < 0) throw new Error('invalid_declared_value');
  return { description: String(description).trim(), declaredValue: Math.round(value * 100) / 100 };
}

export function transitProtectionQuote({ declaredValue = 0, ratePct = 0.6, minimum = 15, maximumCover = 100000 }) {
  const value = Math.max(0, Number(declaredValue || 0));
  if (value === 0) return { eligible: false, premium: 0, coverAmount: 0, reason: 'no_declared_value' };
  const coverAmount = Math.min(value, maximumCover);
  const premium = Math.max(minimum, Math.round(coverAmount * (ratePct / 100)));
  return { eligible: true, premium, coverAmount, ratePct };
}

export function validateEvidence({ stage, photos = [], otpVerified = false, receiverName = '', gps = null, capturedAt = null }) {
  if (!Object.values(PROOF_STAGE).includes(stage)) throw new Error('invalid_stage');
  if (!Array.isArray(photos) || photos.length < 1) throw new Error('photo_required');
  if ((stage === PROOF_STAGE.PICKUP || stage === PROOF_STAGE.DELIVERY) && !otpVerified) throw new Error('otp_required');
  if (stage === PROOF_STAGE.DELIVERY && !String(receiverName).trim()) throw new Error('receiver_name_required');
  return {
    stage,
    photos: photos.slice(0, 8),
    otpVerified: Boolean(otpVerified),
    receiverName: String(receiverName || '').trim() || null,
    gps: gps && Number.isFinite(Number(gps.lat)) && Number.isFinite(Number(gps.lng)) ? { lat: Number(gps.lat), lng: Number(gps.lng) } : null,
    capturedAt: capturedAt || new Date().toISOString(),
  };
}

export function cargoProofCompleteness({ pickupEvidence, deliveryEvidence, declaredValue = 0, protectionSelected = false }) {
  let score = 0;
  if (pickupEvidence?.photos?.length) score += 35;
  if (pickupEvidence?.otpVerified) score += 15;
  if (deliveryEvidence?.photos?.length) score += 25;
  if (deliveryEvidence?.otpVerified && deliveryEvidence?.receiverName) score += 20;
  if (declaredValue > 0 && protectionSelected) score += 5;
  return Math.min(100, score);
}

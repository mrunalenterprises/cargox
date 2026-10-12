import test from 'node:test';
import assert from 'node:assert/strict';
import { PROOF_STAGE, validateDeclaredGoods, transitProtectionQuote, validateEvidence, cargoProofCompleteness } from '../src/domain/cargo-proof.js';

test('declared goods accepts valid description and value', () => {
  const g = validateDeclaredGoods({ description: 'Machine spare parts', declaredValue: 25000 });
  assert.equal(g.declaredValue, 25000);
});

test('prohibited goods are rejected', () => {
  assert.throws(() => validateDeclaredGoods({ description: 'x', prohibited: true }), /prohibited_goods/);
});

test('transit protection premium has minimum floor', () => {
  const q = transitProtectionQuote({ declaredValue: 1000, ratePct: 0.5, minimum: 15 });
  assert.equal(q.premium, 15);
  assert.equal(q.coverAmount, 1000);
});

test('pickup evidence requires photo and OTP', () => {
  assert.throws(() => validateEvidence({ stage: PROOF_STAGE.PICKUP, photos: ['a.jpg'], otpVerified: false }), /otp_required/);
});

test('delivery evidence requires receiver name', () => {
  assert.throws(() => validateEvidence({ stage: PROOF_STAGE.DELIVERY, photos: ['d.jpg'], otpVerified: true }), /receiver_name_required/);
});

test('complete pickup and delivery evidence scores high', () => {
  const score = cargoProofCompleteness({
    pickupEvidence: { photos: ['p.jpg'], otpVerified: true },
    deliveryEvidence: { photos: ['d.jpg'], otpVerified: true, receiverName: 'Receiver' },
    declaredValue: 10000,
    protectionSelected: true,
  });
  assert.equal(score, 100);
});

export const sections = {
  login: { title: "Login & access", note: "Authentication and staff roles are not connected. These pages contain only fictional local fixtures; no real credentials should be entered." },
  cities: { title: "City & service controls", note: "Read-only demo switches. Live legal and operational approvals cannot be granted from this preview." },
  onboarding: { title: "Partner review", note: "Seeded fixtures only. Staff review, police verification, permits, insurance and Admin final approval require a secure onboarding service." },
  dispatch: { title: "Dispatch & incident desk", note: "Local ride states only. No live dispatch, location feeds, staffed emergency response or incident reporting is connected." },
  fares: { title: "Fare settings", note: "Illustrative rates and configurable 25% starting commission are placeholders. Self-rate and weekly changes remain disabled pending approved policy." },
  pink: { title: "Pink Rider permissions", note: "Fictional eligibility flags only. Real verified enrollment, consent and anti-replay selfie checks are not integrated." },
  plans: { title: "Daily & Monthly oversight", note: "Unpaid fixed-route drafts. No entitlements, renewal, automatic dispatch or silent partner replacement." },
  reports: { title: "GM / Field Officer reports", note: "Restricted operational reports remain unavailable until authenticated role and team scopes are enforced by the server." },
  payouts: { title: "Payouts & reconciliation", note: "All local rides are unpaid. No transaction, refund, bank detail, settlement or payout approval is created by this preview." },
  audit: { title: "Audit events", note: "In-memory demo event history; it is not a durable, tamper-proof production audit log." },
  flags: { title: "Feature gates", note: "Production capabilities stay off until legal, safety and integration approvals are documented." },
} as const;

export type Section = keyof typeof sections;

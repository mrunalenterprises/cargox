import "server-only";

export type Ride = { id: string; state: string; service: string; pickup: string; drop: string; partnerId?: string | null; pinkOnly: boolean; scheduledAt?: string | null; quote: { farePaise: number } };
export type Partner = { id: string; name: string; approved: boolean; docsValid: boolean; online: boolean; pinkOptIn: boolean; pinkMode: string; services: string[] };
export type City = { id: string; name: string; timezone: string; services: Record<string, boolean> };
export type Plan = { id: string; pickup: string; drop: string; state: string; pinkOnly: boolean; totalPaise: number; legs: { date: string; time: string; leg: string }[] };
export type Dashboard = { demo: true; cities: City[]; partners: Partner[]; rides: Ride[]; plans: Plan[]; auditCount: number; alert: string;
  audit?: { sequence: number; action: string; rideId?: string; planId?: string; partnerId?: string }[];
  pricing?: { ratePaisePerKm: Record<string, number>; commissionBps: number };
};

export async function snapshot(): Promise<Dashboard | null> {
  try {
    const origin = new URL(process.env.CARGOX_DEMO_API ?? "http://127.0.0.1:4173");
    if (origin.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(origin.hostname) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") return null;
    const res = await fetch(new URL("/api/admin", origin), { cache: "no-store", signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.demo !== true || !Array.isArray(data.cities) || !Array.isArray(data.rides) || !Array.isArray(data.partners) || !Array.isArray(data.plans)) return null;
    return data as Dashboard;
  } catch { return null; }
}

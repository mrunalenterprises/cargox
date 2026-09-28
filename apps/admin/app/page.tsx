export const dynamic = "force-dynamic";
type Ride = { id: string; state: string; service: string; pickup: string; drop: string; partnerId?: string | null; };
type Partner = { id: string; name: string; approved: boolean; pinkOptIn: boolean; };
type City = { id: string; name: string; services: Record<string, boolean>; };
type Dashboard = { demo: true; cities: City[]; partners: Partner[]; rides: Ride[]; plans: unknown[]; auditCount: number; alert: string; };
async function snapshot(): Promise<Dashboard | null> {
  try {
    // Server-only loopback fetch. Do not add an unauthenticated public proxy.
    const res = await fetch("http://127.0.0.1:4173/api/admin", { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json() as Dashboard;
  } catch { return null; }
}
export default async function AdminHome() {
  const data = await snapshot();
  const metrics = data ? [
    ["Ride requests", data.rides.length],
    ["Completed rides", data.rides.filter(r => r.state === "COMPLETED").length],
    ["Active assignments", data.rides.filter(r => ["ASSIGNED","IN_PROGRESS"].includes(r.state)).length],
    ["Demo partners", data.partners.length],
    ["Unpaid pack drafts", data.plans.length],
    ["Audit events", data.auditCount],
  ] as const : [];
  return <main className="page">
    <header><div className="brand"><span className="brand-icon">CX</span><div>Cargo<span className="x">X</span><small>MRUNAL TECHNOLOGIES</small></div></div><span className="flag">LOCAL DEVELOPMENT ONLY</span></header>
    <section className="hero"><span className="overline">PASSENGER OPERATIONS</span><h1>Every ride,<br/><em>in view.</em></h1><p>Transparent city controls and a clean operational picture.</p></section>
    {!data ? <div className="notice"><strong>Local demo API is offline.</strong><p>Run <code>npm run dev:demo</code> in the repository root and refresh this page.</p></div> :
    <>
      <section className="metrics">{metrics.map(([label,value])=><article className="metric" key={label}><strong>{value}</strong><span>{label}</span></article>)}</section>
      <section className="columns">
       <article className="panel"><h2>City readiness</h2><p>Illustrative settings: not proof of local regulatory approval.</p>
        {data.cities.map(city=><div key={city.id}><h3>{city.name}</h3>
         <div className="chips">{Object.entries(city.services).map(([service,on])=><span key={service} className={on?"on":"off"}>{service} · {on?"DEMO ON":"COMING SOON"}</span>)}</div></div>)}
       </article>
       <article className="panel"><h2>Driver status</h2><p>These profiles have fake local verification flags.</p>
        {data.partners.map(p=><div className="line" key={p.id}><span><b>{p.name}</b>{p.pinkOptIn?" · Pink Rider":""}</span><span className="on">DEMO</span></div>)}
       </article>
      </section>
      <section className="panel"><h2>Ride overview</h2>{data.rides.length?data.rides.slice().reverse().map(r=><div key={r.id} className="line"><span><b>{r.service.toUpperCase()}</b> · {r.pickup} → {r.drop}</span><span>{r.state}</span></div>):<p>No local demo requests yet.</p>}</section>
    </>}
    <footer>Not authenticated or production ready. KYC, settlements, live incidents and legal approvals remain gated.</footer>
  </main>;
}

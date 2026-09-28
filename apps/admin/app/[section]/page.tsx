import Link from "next/link";
import { notFound } from "next/navigation";
import { snapshot } from "../../lib/demo";
import { sections, type Section } from "../../lib/sections";

export const dynamic = "force-dynamic";
const money = (paise: number) => `INR ${(paise / 100).toFixed(2)}`;

export default async function OperationsPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: requested } = await params;
  if (!Object.hasOwn(sections, requested)) notFound();
  const section = requested as Section;
  const info = sections[section];
  const data = await snapshot();
  return <main className="page operations-page">
    <Link className="back-link" href="/">← Overview</Link>
    <section className="hero"><span className="overline">LOCAL OPERATIONS PREVIEW</span><h1>{info.title}</h1></section>
    <div className="notice"><strong>Demo boundary</strong><p>{info.note}</p></div>
    {!data && <div className="notice" role="status">Local API unavailable. Start the configured loopback demo and refresh.</div>}

    {section === "login" && <section className="panel"><h2>Production login is disabled</h2><p>No password form or fake successful authentication. Intended roles: Super Admin, GM, Accounts and Field Officer.</p></section>}

    {data && section === "cities" && data.cities.map(city => <section className="panel" key={city.id}>
      <h2>{city.name}</h2><p>{city.timezone} · Fictional readiness only</p>
      <div className="chips">{Object.entries(city.services).map(([name, enabled]) => <span key={name} className={enabled ? "on" : "off"}>{name} · {enabled ? "DEMO ON" : "COMING SOON"}</span>)}</div>
      <p>Route controls and real city activation are locked.</p>
    </section>)}

    {data && section === "onboarding" && <section className="panel"><h2>Fictional partner fixtures</h2>{data.partners.map(p => <article className="line" key={p.id}>
      <div><b>{p.name}</b><p>{p.services.join(" / ")}</p></div><span>Fixture approval: {p.approved ? "yes" : "no"} · documents: {p.docsValid ? "fixture valid" : "invalid"}</span>
    </article>)}</section>}

    {data && section === "dispatch" && <section className="panel"><h2>Local ride status</h2>{!data.rides.length && <p>No requests yet.</p>}{data.rides.slice().reverse().map(r => <article className="line" key={r.id}>
      <div><b>{r.pickup} → {r.drop}</b><p>{r.service} · {r.scheduledAt ?? "Immediate"} · {r.pinkOnly ? "Pink Rider Only" : "Any eligible partner"}</p></div><span>{r.state}</span>
    </article>)}</section>}

    {data && section === "fares" && <section className="panel"><h2>Server demo pricing</h2>{data.pricing ? <>
      {Object.entries(data.pricing.ratePaisePerKm).map(([service, rate]) => <div className="line" key={service}><b>{service}</b><span>{money(rate)} / input km</span></div>)}
      <p>Commission allocation: {data.pricing.commissionBps / 100}% included in gross fare, not an additional passenger charge. Disabled services remain unbookable even if a placeholder rate exists.</p>
    </> : <p>This older demo process does not expose pricing details. Update it only after preserving its in-memory state.</p>}</section>}

    {data && section === "pink" && <section className="panel"><h2>Preference enforcement</h2><p>Pink Rider Only never falls back silently. Women Only requires the whole demo passenger party to satisfy eligibility.</p>
      {data.partners.filter(p => p.pinkOptIn).map(p => <div className="line" key={p.id}><b>{p.name}</b><span>{p.pinkMode === "women_only" ? "Women Only" : "Women + Men"} · fictional verification</span></div>)}
    </section>}

    {data && section === "plans" && <section className="panel"><h2>Unpaid draft calendars</h2>{!data.plans.length && <p>No saved drafts.</p>}{data.plans.map(p => <details className="plan-details" key={p.id}>
      <summary>{p.pickup} → {p.drop} · {p.legs.length} legs · {money(p.totalPaise)} · {p.state}{p.pinkOnly ? " · Pink Rider Only" : ""}</summary>
      <ol>{p.legs.map((leg, index) => <li key={index}>{leg.date} · {leg.time} · {leg.leg} · Unassigned</li>)}</ol>
    </details>)}</section>}

    {section === "reports" && <section className="panel"><h2>Scope enforcement required</h2><p>GM access must be limited to assigned Field Officer teams. Accounts and administrative permissions need separate server policies. No real scoped report is exposed.</p></section>}
    {section === "payouts" && <section className="panel"><h2>No payable balance</h2><p>Demo completion does not mark a ride paid. Webhook verification, ledger, refunds, reconciliation and Admin-approved payout changes remain disconnected.</p></section>}

    {data && section === "audit" && <section className="panel"><h2>{data.auditCount} local events</h2>{data.audit?.map(event => <div className="line" key={event.sequence}>
      <b>#{event.sequence} · {event.action}</b><code>{event.rideId ?? event.planId ?? event.partnerId ?? "fixture"}</code>
    </div>) ?? <p>This older process reports counts only.</p>}</section>}

    {section === "flags" && <section className="panel"><h2>Launch gates</h2>{["Bike taxi permits", "Regulated Shared Car", "Outstation route approvals", "Guardian-managed child transport", "Real identity and selfie", "Live GPS / secure sharing", "Staffed SOS", "Paid packs / real payments", "Production staff authentication"].map(flag => <div className="line" key={flag}><b>{flag}</b><span className="off">DISABLED</span></div>)}</section>}
    <footer>Read-only local fixture data. No approval, payment, legal clearance or emergency action can be performed here.</footer>
  </main>;
}

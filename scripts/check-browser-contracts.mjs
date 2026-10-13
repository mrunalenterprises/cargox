import { readFile } from 'node:fs/promises';

const checks = [
  {
    file: 'apps/customer-web/recurring.html',
    require: ['const els=', 'els.name.value', 'els.pickup.value', 'els.preferred.checked'],
    identifiers: { name:['value'], pickup:['value'], drop:['value'], service:['value'], time:['value'], preferred:['checked'] }
  },
  {
    file: 'apps/partner-web/special-jobs.html',
    require: ['const els=', 'els.fare.value', 'els.pct.value'],
    identifiers: { fare:['value'], pct:['value'] }
  },
  {
    file: 'apps/fleet-web/compliance.html',
    require: ['const els=', 'els.kpis.innerHTML', 'els.rows.innerHTML'],
    identifiers: { kpis:['innerHTML'], rows:['innerHTML'] }
  },
  {
    file: 'apps/customer-web/checkout.html',
    require: ['const els=', 'els.bookingLine.textContent', 'els.confirm.disabled', 'els.done.innerHTML'],
    identifiers: {
      bookingLine:['textContent'], provider:['innerHTML'], confirm:['disabled'], done:['innerHTML'],
      fare:['textContent'], extras:['textContent'], total:['textContent'], commission:['textContent'], partner:['textContent']
    }
  }
];

let failures = 0;
for (const check of checks) {
  const source = await readFile(check.file, 'utf8');
  for (const text of check.require) {
    if (!source.includes(text)) {
      console.error(`${check.file}: missing required DOM binding marker: ${text}`);
      failures++;
    }
  }
  for (const [id, props] of Object.entries(check.identifiers)) {
    for (const prop of props) {
      const re = new RegExp(`(^|[^.$\\w])${id}\\.${prop}\\b`, 'g');
      if (re.test(source)) {
        console.error(`${check.file}: implicit DOM global regression detected for #${id}.${prop}`);
        failures++;
      }
    }
  }
}

if (failures) process.exit(1);
console.log(`Browser DOM contract checks passed for ${checks.length} critical screens.`);

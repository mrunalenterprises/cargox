import { readFile } from 'node:fs/promises';

const checks = [
  {
    file: 'apps/customer-web/recurring.html',
    require: ['const els=', 'els.name.value', 'els.pickup.value', 'els.preferred.checked'],
    forbid: ['name.value', 'pickup.value', 'drop.value', 'service.value', 'time.value', 'preferred.checked']
  },
  {
    file: 'apps/partner-web/special-jobs.html',
    require: ['const els=', 'els.fare.value', 'els.pct.value'],
    forbid: ['Number(fare.value)', 'Number(pct.value)']
  },
  {
    file: 'apps/fleet-web/compliance.html',
    require: ['const els=', 'els.kpis.innerHTML', 'els.rows.innerHTML'],
    forbid: [';kpis.innerHTML', ';rows.innerHTML']
  },
  {
    file: 'apps/customer-web/checkout.html',
    require: ['const els=', 'els.bookingLine.textContent', 'els.confirm.disabled', 'els.done.innerHTML'],
    forbid: ['bookingLine.textContent', 'confirm.disabled', 'done.innerHTML', ';fare.textContent', ';extras.textContent', ';total.textContent']
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
  for (const text of check.forbid) {
    if (source.includes(text) && !text.startsWith('name.value')) {
      console.error(`${check.file}: implicit DOM global regression detected: ${text}`);
      failures++;
    }
  }
  // name.value is a substring of els.name.value; flag only true unqualified uses.
  if (check.file.endsWith('/recurring.html')) {
    for (const id of ['name','pickup','drop','service','time','preferred']) {
      const re = new RegExp(`(^|[^.$\\w])${id}\\.(value|checked)`, 'g');
      if (re.test(source)) {
        console.error(`${check.file}: implicit DOM global regression detected for #${id}`);
        failures++;
      }
    }
  }
}

if (failures) process.exit(1);
console.log(`Browser DOM contract checks passed for ${checks.length} critical screens.`);

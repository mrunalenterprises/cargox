// Server-component checks, without opening a browser or using a live preview.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(relative, mocks = {}) {
  const file = path.resolve(__dirname, '..', relative);
  const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: file,
  });
  const compiled = new Module(file, module);
  compiled.filename = file;
  compiled.paths = Module._nodeModulePaths(path.dirname(file));
  const original = compiled.require.bind(compiled);
  compiled.require = name => Object.hasOwn(mocks, name) ? mocks[name] : original(name);
  compiled._compile(result.outputText, file);
  return compiled.exports;
}

async function main() {
  const { createDemoServer } = await import('../../demo/server.mjs');
  const { engine } = createDemoServer();
  engine.createRide({ service: 'auto', pickup: 'Fixture home', drop: 'Fixture office', distanceKm: 8 });
  engine.createDemoPack({ service: 'car', pickup: 'Fixture home', drop: 'Fixture office', distanceKm: 8,
    startDate: '2026-10-01', endDate: '2026-10-02', weekdays: [4, 5], pickupTime: '09:00', returnTime: '18:00',
    pinkOnly: true, allPassengersWomenVerified: true });
  const data = engine.adminSummary();
  const { sections } = load('lib/sections.ts');
  let fixture = data;
  const { default: Page } = load('app/[section]/page.tsx', {
    '../../lib/demo': { snapshot: async () => fixture },
    '../../lib/sections': { sections },
    'next/navigation': { notFound: () => { throw new Error('EXPECTED_404'); } },
    'next/link': ({ children, ...props }) => React.createElement('a', props, children),
  });
  for (const [section, info] of Object.entries(sections)) {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ section }) }));
    assert.ok(html.includes(renderToStaticMarkup(React.createElement('h1', null, info.title))), section);
    assert.match(html, /Demo boundary/);
    assert.doesNotMatch(html, /<form|type="password"|type="submit"/, 'No live mutation/auth UI');
    if (section === 'plans') assert.match(html, /Pink Rider Only/);
    if (section === 'audit') assert.match(html, /ride_created/);
  }
  await assert.rejects(Page({ params: Promise.resolve({ section: 'unknown' }) }), /EXPECTED_404/);
  fixture = null;
  assert.match(renderToStaticMarkup(await Page({ params: Promise.resolve({ section: 'dispatch' }) })), /Local API unavailable/);

  const { snapshot } = load('lib/demo.ts', { 'server-only': {} });
  const savedFetch = global.fetch;
  const savedOrigin = process.env.CARGOX_DEMO_API;
  let calls = 0;
  try {
    global.fetch = async () => { calls++; return { ok: true, json: async () => data }; };
    for (const origin of ['https://example.com', 'http://127.0.0.1@evil.example', 'http://localhost:4173/path', 'http://localhost:4173?x=1']) {
      process.env.CARGOX_DEMO_API = origin;
      assert.equal(await snapshot(), null);
    }
    assert.equal(calls, 0, 'Remote/malformed origins must never be fetched');
    process.env.CARGOX_DEMO_API = 'http://127.0.0.1:4174';
    assert.equal((await snapshot()).demo, true);
    global.fetch = async () => ({ ok: true, json: async () => ({ demo: false }) });
    assert.equal(await snapshot(), null, 'Reject non-demo response');
    global.fetch = async () => { throw new Error('offline'); };
    assert.equal(await snapshot(), null, 'Offline is an explicit empty state');
  } finally {
    global.fetch = savedFetch;
    if (savedOrigin === undefined) delete process.env.CARGOX_DEMO_API;
    else process.env.CARGOX_DEMO_API = savedOrigin;
  }
  console.log(`PASS ${Object.keys(sections).length} Admin sections, unknown route, offline state and loopback/data guards`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });

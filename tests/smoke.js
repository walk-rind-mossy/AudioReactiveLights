// Regression smoke test.
// Setup:  npm i -D playwright && npx playwright install chromium
// Usage:  node tests/smoke.js                       compare with tests/baseline.json
//         node tests/smoke.js --update              accept current output as the new baseline
//         node tests/smoke.js dist/music_map_lab.html   test the bundled build
const { chromium } = require('playwright');
const crypto = require('crypto'), fs = require('fs'), path = require('path');

const root = path.resolve(__dirname, '..');
const target = path.resolve(root, process.argv.find(a => a.endsWith('.html')) || 'index.html');
const update = process.argv.includes('--update');

// Deterministic 16 s test track: kicks, off-beat hats, a riser, a note change at 8 s.
function makeWav(file) {
  const sr = 44100, dur = 16, n = sr * dur, x = new Float64Array(n);
  let seed = 1;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 - .5; };
  for (let k = 0; k < dur * 2; k++) {
    const s = Math.floor(k * .5 * sr), L = Math.floor(.18 * sr); let ph = 0;
    for (let i = 0; i < L && s + i < n; i++) {
      const tt = i / sr; ph += 2 * Math.PI * (50 + 90 * Math.exp(-tt * 30)) / sr;
      x[s + i] += Math.sin(ph) * Math.exp(-tt * 14) * (s / sr >= 8 ? .9 : .5);
    }
  }
  for (let k = 0; k < dur * 4; k++) {
    const s = Math.floor((k * .25 + .125) * sr);
    for (let i = 0; i < sr * .03 && s + i < n; i++) x[s + i] += rnd() * 2 * Math.exp(-i / (sr * .006)) * .15;
  }
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    x[i] += t < 8 ? .15 * Math.sin(2 * Math.PI * 220 * t) : .2 * Math.sin(2 * Math.PI * 196 * t);
    if (t > 5 && t < 8) x[i] += .12 * rnd() * 2 * ((t - 5) / 3);
  }
  let max = 0; for (const v of x) max = Math.max(max, Math.abs(v));
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(x[i] / (max * 1.05) * 32767), 44 + i * 2);
  fs.writeFileSync(file, buf);
}

(async () => {
  const wav = path.join(__dirname, 'test.wav');
  if (!fs.existsSync(wav)) makeWav(wav);

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => m.type() === 'error' && errs.push(m.text()));

  await p.goto('file://' + target);
  await p.waitForTimeout(400);
  await p.setInputFiles('#fileInput', wav);
  await p.waitForFunction(() => /analysis ready/.test(document.querySelector('#statusChip').textContent), null, { timeout: 120000 });

  const r = await p.evaluate(() => {
    const s = window.MML.state, rd = v => typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v, counts = {};
    s.events.forEach(e => counts[e.type] = (counts[e.type] || 0) + 1);
    return {
      frames: s.features.length, events: s.events.length, counts,
      features: JSON.stringify(s.features.map(f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Array.isArray(v) ? v.map(rd) : rd(v)])))),
      eventList: JSON.stringify(s.events.map(e => [rd(e.t), e.type, rd(e.strength)])),
    };
  });

  // exercise playhead + neon sign controls so wiring errors show up as JS errors
  await p.evaluate(() => { const a = window.MML.audio; a.currentTime = 9; a.dispatchEvent(new Event('timeupdate')); });
  await p.click('.sign-theme[data-theme="cyan"]');
  await p.click('.sign-preset[data-preset="neon"]');
  await p.waitForTimeout(300);
  await b.close();

  const h = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 12);
  const out = { frames: r.frames, events: r.events, counts: r.counts, featuresHash: h(r.features), eventsHash: h(r.eventList) };
  console.log(out);
  if (errs.length) console.log('JS ERRORS:', errs);

  const bl = path.join(__dirname, 'baseline.json');
  if (update || !fs.existsSync(bl)) { fs.writeFileSync(bl, JSON.stringify(out, null, 1)); console.log('baseline written'); }
  else {
    const same = JSON.stringify(JSON.parse(fs.readFileSync(bl))) === JSON.stringify(out);
    console.log(same ? 'MATCH baseline' : 'DIFF from baseline (intended? run with --update)');
    if (!same) process.exitCode = 1;
  }
  if (errs.length) process.exitCode = 1;
})();

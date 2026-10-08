// Kjører alle ende-til-ende-testene etter hverandre (de deler ikke tilstand, men er tunge: kjør sekvensielt).
// Hver test skriver «SUM: n bestått, m feilet». Runneren feiler hvis noen test feiler, avbrytes eller krasjer.
// Krever Playwright med Chromium (se README). Filtrer med: node tests/run.js t12 t19
const { spawnSync } = require('child_process'), path = require('path');
const ALL = ['t1','t2','t3','t4','t5','t6','t7','t8','t9','t10','t11','t12','t13','treg','t14','t15','t16','t17','t18','t19','t20','t21','u_cd'];
const only = process.argv.slice(2), list = only.length ? ALL.filter(t => only.includes(t)) : ALL;
let failed = [], pass = 0;
for (const t of list) {
  const r = spawnSync('node', [path.join(__dirname, 'e2e', t + '.js')], { encoding: 'utf8', timeout: 600000 });
  const out = (r.stdout || '') + (r.stderr || ''), sums = [...out.matchAll(/SUM: (\d+) bestått, (\d+) feilet([^\n]*)/g)];
  const p = sums.reduce((s, m) => s + Number(m[1]), 0), f = sums.reduce((s, m) => s + Number(m[2]), 0), aborted = sums.some(m => /AVBRUTT/.test(m[3]));
  const bad = r.status !== 0 && !sums.length || f > 0 || aborted || !sums.length;
  pass += p; console.log((bad ? 'FEIL ' : 'OK   ') + t.padEnd(5) + p + ' bestått' + (f ? ', ' + f + ' feilet' : '') + (aborted ? ', AVBRUTT' : ''));
  if (bad) { failed.push(t); console.log(out.split('\n').filter(l => /^FEIL|AVBRUTT|Error/.test(l)).slice(0, 8).join('\n')); }
}
console.log('\n' + pass + ' kontroller bestått' + (failed.length ? ', feilet i: ' + failed.join(', ') : ', ingen feil'));
process.exit(failed.length ? 1 : 0);

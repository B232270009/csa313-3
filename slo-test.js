import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const chaos = __ENV.CHAOS === '1';
const recovery = new Trend('outage_recovery_ms', true);
const recoverySamples = new Counter('recovery_samples');
let outageStarted = null;

export const options = {
  vus: 20,
  duration: chaos ? '2m' : '1m',
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  thresholds: {
    'http_req_duration{name:cart}': ['p(95)<20'],
    'http_req_failed{name:pay}': ['rate<0.08'],
    checks: ['rate>=0.90'],
    'http_req_duration{name:report}': ['p(95)<450'],
    ...(chaos ? {
      outage_recovery_ms: ['p(95)<12000'],
      recovery_samples: ['count>=20'],
    } : {}),
  },
};

export default function () {
  const base = 'http://127.0.0.1:3000';
  const c = http.post(`${base}/cart/add`, null, { tags: { name: 'cart' }, timeout: '2s' });
  // Each VU measures the interval from its first failed cart probe to recovery.
  // Payment's intentional 500s must not start an outage timer.
  if (chaos) {
    if (c.status === 0 && outageStarted === null) outageStarted = Date.now();
    if (c.status === 200 && outageStarted !== null) {
      recovery.add(Date.now() - outageStarted);
      recoverySamples.add(1);
      outageStarted = null;
    }
  }
  const r = http.get(`${base}/report`, { tags: { name: 'report' }, timeout: '2s' });
  const p = http.post(`${base}/pay`, null, { tags: { name: 'pay' }, timeout: '2s' });
  check(c, { 'cart 200': (x) => x.status === 200 });
  check(r, { 'report 200': (x) => x.status === 200 });
  check(p, { 'pay 200': (x) => x.status === 200 });
  sleep(1);
}

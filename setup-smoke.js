import http from 'k6/http';
import { check } from 'k6';

// Setup check only. SLO/chaos experiments belong to the next lab steps.
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1'] },
};

export default function () {
  const cart = http.post('http://127.0.0.1:3000/cart/add');
  const report = http.get('http://127.0.0.1:3000/report');
  const pay = http.post('http://127.0.0.1:3000/pay');
  check(cart, { 'cart endpoint ready': (r) => r.status === 200 && r.json('items') === 1 });
  check(report, { 'report endpoint ready': (r) => r.status === 200 && r.json('rows') === 20000 });
  // HTTP 500 is intentional behavior of /pay, not an installation failure.
  check(pay, { 'pay endpoint ready': (r) =>
    (r.status === 200 && r.json('paid') === true) ||
    (r.status === 500 && r.json('error') === 'gateway timeout') });
}

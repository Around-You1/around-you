// Around You — launch-day burst test.
//
// Simulates a wave of Locals opening the app right after a push alert goes out:
// each "open" fires the same parallel batch of "nearby" calls the Guest/Local
// dashboard loads. It stresses the READ path (the part that gets hammered when
// everyone opens at once) against your live Fly + Supabase stack.
//
// It is READ-ONLY: no writes, no emails, no invoices. It signs in ONE throwaway
// test Local (shared token) so it does not create hundreds of junk accounts.
//
// Run it at night so real users aren't affected. See README.md for commands.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE     = (__ENV.BASE_URL || 'https://around-you-backend.fly.dev').replace(/\/+$/, '');
const POSTAL   = __ENV.POSTAL   || '7390';
const PROVINCE = __ENV.PROVINCE || 'Western Cape';
const RADIUS   = __ENV.RADIUS   || '50';
const PEAK     = parseInt(__ENV.PEAK || '300', 10);   // peak simultaneous Locals
const TEST_CELL = __ENV.TEST_CELL || '0990000001';    // the one throwaway account

// Time to load the WHOLE dashboard (all nearby calls together) — the number a
// real user feels.
const appLoad = new Trend('app_load_full_ms', true);

export const options = {
  scenarios: {
    launch_burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: PEAK }, // the wave builds as the push lands
        { duration: '90s', target: PEAK }, // everyone browsing at once
        { duration: '30s', target: 0 },    // tail off
      ],
      gracefulRampDown: '20s',
    },
  },
  thresholds: {
    http_req_failed:   ['rate<0.01'],    // fewer than 1% of calls error
    http_req_duration: ['p(95)<2000'],   // 95% of calls finish under 2s
    app_load_full_ms:  ['p(95)<3000'],   // 95% of full dashboard loads under 3s
  },
};

// Runs once, before the load. Signs in a single test Local; every virtual user
// reuses this token.
export function setup() {
  const res = http.post(`${BASE}/auth/local-guest-login`, JSON.stringify({
    cell: TEST_CELL, province: PROVINCE, postalCode: POSTAL,
  }), { headers: { 'Content-Type': 'application/json' } });

  check(res, { 'login returned 200': (r) => r.status === 200 });
  const token = res.json('token');
  if (!token) {
    throw new Error(`Could not sign in the test Local (status ${res.status}). Body: ${res.body}`);
  }
  return { token };
}

// One iteration = one Local opening the app once.
export default function (data) {
  const auth = { headers: { Authorization: `Bearer ${data.token}` } };
  const q = `postalCode=${POSTAL}&radiusKm=${RADIUS}`;

  const start = Date.now();
  const responses = http.batch([
    ['GET', `${BASE}/restaurant/nearby?${q}`,               null, auth],
    ['GET', `${BASE}/service/nearby?${q}&nonProfit=false`,  null, auth],
    ['GET', `${BASE}/retail/nearby?${q}`,                   null, auth],
    ['GET', `${BASE}/nonprofit/nearby?${q}`,                null, auth],
    ['GET', `${BASE}/attraction/nearby?${q}`,               null, auth],
    ['GET', `${BASE}/accommodation/nearby-locals?${q}`,     null, auth],
    ['GET', `${BASE}/notifications/recent?postalCode=${POSTAL}`, null, auth],
  ]);
  appLoad.add(Date.now() - start);

  responses.forEach((r) => check(r, { 'call returned 200': (res) => res.status === 200 }));

  // Think time: a real Local reads the screen before doing anything else.
  sleep(Math.random() * 5 + 3);
}

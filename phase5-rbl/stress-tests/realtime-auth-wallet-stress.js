import { check, sleep } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '3m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '1m', target: 0 }
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<800']
  }
};

const authBaseUrl = __ENV.AUTH_BASE_URL || 'http://localhost:5000';
const realtimeBaseUrl = __ENV.REALTIME_BASE_URL || 'http://localhost:3020';
const walletBaseUrl = __ENV.WALLET_BASE_URL || 'http://localhost:5040';

export default function () {
  const suffix = `${__VU}-${__ITER}`;
  const registerPayload = JSON.stringify({
    email: `stress-${suffix}@lucy.local`,
    password: 'RblStress!123',
    displayName: `Stress User ${suffix}`,
    role: 'Anonymous'
  });

  const register = http.post(`${authBaseUrl}/auth/register`, registerPayload, { headers: { 'Content-Type': 'application/json' } });
  check(register, { 'auth register accepted': response => response.status === 201 || response.status === 409 });

  const token = http.post(`${realtimeBaseUrl}/agora/token`, JSON.stringify({ channelName: 'level-1', uid: `anon-${suffix}` }), { headers: { 'Content-Type': 'application/json' } });
  check(token, { 'agora scaffold token ok': response => response.status === 200 });

  const wallet = http.get(`${walletBaseUrl}/wallets/stress-${suffix}`);
  check(wallet, { 'wallet lookup ok': response => response.status === 200 });

  const topUp = http.post(`${walletBaseUrl}/wallets/stress-${suffix}/top-up`, JSON.stringify({ amount: 10000, providerReference: `k6-${suffix}` }), { headers: { 'Content-Type': 'application/json' } });
  check(topUp, { 'wallet top-up ok': response => response.status === 200 });

  sleep(1);
}

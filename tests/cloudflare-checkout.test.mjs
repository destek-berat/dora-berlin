import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { onRequestPost as start } from '../functions/api/checkout-start.js';
import { onRequestPost as callback } from '../functions/api/checkout-callback.js';

globalThis.crypto ||= webcrypto;
const env = {
  SUPABASE_URL: 'https://db.example.test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  IYZICO_API_KEY: 'sandbox-test-key',
  IYZICO_SECRET_KEY: 'sandbox-test-secret',
};

function customer() {
  return { name: 'Ada Test', email: 'ada@example.test', phone: '05001112233', address: 'Örnek Sokak 1', city: 'İstanbul', district: 'Kadıköy' };
}

let database = [];
let paymentStatus = 'SUCCESS';
let fraudStatus = 1;
let iyzicoCount = 0;
const attemptedPayments = [];

globalThis.fetch = async (resource, options) => {
  const url = String(resource);
  if (url.startsWith('https://db.example.test')) {
    assert.equal(options.headers.apikey, env.SUPABASE_SECRET_KEY);
    assert.equal('Authorization' in options.headers, false);
  }
  if (url.startsWith('https://db.example.test/rest/v1/products')) {
    return Response.json([{ id: 7, name: 'Test Çanta', price: 1195, stock: 10, is_active: true }]);
  }
  if (url.includes('/payment_attempts') && options.method === 'POST') {
    database.push(JSON.parse(options.body));
    return new Response('', { status: 201 });
  }
  if (url.includes('/payment_attempts') && options.method === 'PATCH') {
    Object.assign(database[0], JSON.parse(options.body));
    return new Response(null, { status: 204 });
  }
  if (url.includes('/payment_attempts?select=')) return Response.json(database);
  if (url.includes('/orders') && options.method === 'POST') {
    attemptedPayments.push(JSON.parse(options.body));
    return new Response('', { status: 201 });
  }
  if (url.startsWith('https://sandbox-api.iyzipay.com/')) {
    iyzicoCount++;
    const payload = JSON.parse(options.body);
    assert.equal(options.headers['x-iyzi-rnd'].length > 10, true);
    const encoded = options.headers.Authorization.replace(/^IYZWSv2 /, '');
    const auth = atob(encoded);
    const randomKey = options.headers['x-iyzi-rnd'];
    const signature = auth.split('&signature:')[1];
    const signingInput = randomKey + new URL(url).pathname + options.body;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.IYZICO_SECRET_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const actual = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput))), value => value.toString(16).padStart(2, '0')).join('');
    assert.equal(signature, actual);
    if (url.includes('/initialize/')) {
      assert.equal(payload.callbackUrl, 'https://test.pages.dev/api/checkout-callback');
      assert.equal(payload.paidPrice, '1195.00');
      return Response.json({ status: 'success', token: 'test-token', paymentPageUrl: 'https://sandbox-payment.example.test' });
    }
    return Response.json({
      status: 'success', paymentStatus, fraudStatus,
      currency: 'TRY', basketId: database[0].id,
      conversationId: payload.conversationId,
      paidPrice: '1195.00', paymentId: 'test-payment-id',
    });
  }
  throw new Error(`Unexpected request ${url}`);
};

const startResponse = await start({ request: new Request('https://test.pages.dev/api/checkout-start', {
  method: 'POST', body: JSON.stringify({ items: [{ id: 7, qty: 1 }], customer: customer() }),
}), env });
assert.equal(startResponse.status, 200);
assert.equal((await startResponse.json()).paymentPageUrl, 'https://sandbox-payment.example.test');
assert.equal(database[0].status, 'pending');

const callbackResponse = await callback({ request: new Request('https://test.pages.dev/api/checkout-callback', {
  method: 'POST', body: new URLSearchParams({ token: 'test-token' }),
}), env });
assert.match(await callbackResponse.text(), /Ödemeniz başarılı/);
assert.equal(database[0].status, 'paid');
assert.equal(attemptedPayments.length, 1);

database[0].status = 'pending';
fraudStatus = 0;
const ambiguousResponse = await callback({ request: new Request('https://test.pages.dev/api/checkout-callback', {
  method: 'POST', body: new URLSearchParams({ token: 'test-token' }),
}), env });
assert.match(await ambiguousResponse.text(), /İşlem kontrol ediliyor/);
assert.equal(attemptedPayments.length, 1);
assert.equal(database[0].status, 'pending');
assert.equal(iyzicoCount, 3);
console.log('Cloudflare Sandbox checkout: initialize, verified callback, ambiguous callback OK');

// Shared, server-side utilities for Cloudflare Pages Functions.
// This module is deliberately outside /functions, so it is not an HTTP route.

const SANDBOX_BASE = 'https://sandbox-api.iyzipay.com';

export function required(env, name) {
  const value = env[name];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Eksik sunucu ayarı: ${name}`);
  return value.trim();
}

export function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function html(title, message) {
  // Title and message are constants selected by our server, not user-provided HTML.
  return new Response(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DORA BERLIN — Ödeme sonucu</title></head><body style="font:18px system-ui;background:#2b1b15;color:#f8f2e9;text-align:center;padding:12vh 20px"><h1>DORA BERLIN</h1><h2>${title}</h2><p>${message}</p><a style="color:#e8c8a1" href="/">Mağazaya dön</a></body></html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export async function db(env, path, options = {}) {
  const url = required(env, 'SUPABASE_URL').replace(/\/$/, '');
  const key = required(env, 'SUPABASE_SECRET_KEY');
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

export async function iyzico(env, endpoint, data) {
  const apiKey = required(env, 'IYZICO_API_KEY');
  const secretKey = required(env, 'IYZICO_SECRET_KEY');
  // Never accidentally charge a live card while this migration is being tested.
  const base = env.IYZICO_BASE_URL || SANDBOX_BASE;
  if (base !== SANDBOX_BASE) throw new Error('Bu sürüm yalnızca iyzico Sandbox içindir');
  const body = JSON.stringify(data);
  const randomKey = crypto.randomUUID().replaceAll('-', '');
  const signingText = `${randomKey}${endpoint}${body}`;
  const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signatureBuffer = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(signingText));
  const signature = Array.from(new Uint8Array(signatureBuffer), value => value.toString(16).padStart(2, '0')).join('');
  const auth = btoa(`apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`);
  const response = await fetch(`${base}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `IYZWSv2 ${auth}`,
      'x-iyzi-rnd': randomKey,
    },
    body,
  });
  if (!response.ok) throw new Error(`iyzico HTTP ${response.status}`);
  const result = await response.json();
  if (!result || typeof result !== 'object') throw new Error('iyzico yanıtı geçersiz');
  return result;
}

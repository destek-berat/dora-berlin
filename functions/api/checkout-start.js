import { db, iyzico, json } from '../../cloudflare/server.js';

export async function onRequestPost({ request, env }) {
  try {
    const input = await request.json();
    const items = input?.items;
    const customer = input?.customer || {};
    if (!Array.isArray(items) || items.length < 1 || items.length > 30) return json(400, { error: 'Sepet geçersiz' });

    const counts = new Map();
    for (const item of items) {
      const id = Number(item.id);
      const qty = Number(item.qty);
      if (!Number.isSafeInteger(id) || !Number.isSafeInteger(qty) || qty < 1 || qty > 10) return json(400, { error: 'Ürün veya adet geçersiz' });
      counts.set(id, (counts.get(id) || 0) + qty);
    }
    if ([...counts.values()].some(qty => qty > 10)) return json(400, { error: 'Ürün adedi sınırı aşıldı' });

    const name = String(customer.name || '').trim();
    const email = String(customer.email || '').trim();
    const phone = String(customer.phone || '').replace(/\D/g, '');
    const address = String(customer.address || '').trim();
    const city = String(customer.city || '').trim();
    const district = String(customer.district || '').trim();
    if (name.length < 3 || name.length > 120 || !name.includes(' ') || !/^\S+@\S+\.\S+$/.test(email) || email.length > 180 || phone.length < 10 || phone.length > 13 || ![address, city, district].every(v => v.length >= 2 && v.length <= 300)) {
      return json(400, { error: 'Teslimat bilgileri eksik' });
    }

    const ids = [...counts.keys()];
    const products = await db(env, `products?select=id,name,price,stock,is_active&id=in.(${ids.join(',')})`);
    if (!Array.isArray(products) || products.length !== ids.length) return json(400, { error: 'Sepette yayında olmayan ürün var' });
    let totalKurus = 0;
    const lines = [];
    for (const id of ids) {
      const product = products.find(row => Number(row.id) === id);
      const qty = counts.get(id);
      if (!product?.is_active || Number(product.stock) < qty) return json(400, { error: `Ürün stokta yok: ${product?.name || id}` });
      const kurus = Math.round(Number(product.price) * 100);
      if (!Number.isSafeInteger(kurus) || kurus <= 0) return json(400, { error: 'Ürün fiyatı geçersiz' });
      totalKurus += kurus * qty;
      lines.push({ id, name: String(product.name), qty, price: kurus / 100, total: (kurus * qty) / 100 });
    }
    if (!Number.isSafeInteger(totalKurus) || totalKurus <= 0 || totalKurus > 100000000) return json(400, { error: 'Sipariş tutarı geçersiz' });

    // No paid shipping until a reliable, server-side tariff is configured.
    const orderId = crypto.randomUUID();
    const amount = (totalKurus / 100).toFixed(2);
    const person = name.split(/\s+/);
    const surname = person.pop();
    const order = {
      id: orderId,
      order_number: `DB-${Date.now()}-${orderId.slice(0, 6)}`,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      shipping_address: { address, city, district },
      items: lines,
      total_amount: Number(amount),
    };
    await db(env, 'payment_attempts', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ id: orderId, order_data: order, amount: Number(amount), status: 'initiating' }),
    });

    const fullAddress = [address, district, city].join(', ');
    const origin = new URL(request.url).origin;
    const payment = await iyzico(env, '/payment/iyzipos/checkoutform/initialize/auth/ecom', {
      locale: 'tr',
      conversationId: orderId,
      price: amount,
      paidPrice: amount,
      currency: 'TRY',
      basketId: orderId,
      paymentGroup: 'PRODUCT',
      callbackUrl: `${origin}/api/checkout-callback`,
      buyer: {
        id: orderId,
        name: person.join(' '),
        surname,
        identityNumber: '11111111111', // TEST-ONLY placeholder, not valid for real orders.
        email,
        gsmNumber: phone.startsWith('90') ? `+${phone}` : `+90${phone.replace(/^0/, '')}`,
        registrationAddress: fullAddress,
        city,
        country: 'Turkey',
        ip: request.headers.get('CF-Connecting-IP') || '127.0.0.1',
      },
      shippingAddress: { contactName: name, city, country: 'Turkey', address: fullAddress },
      billingAddress: { contactName: name, city, country: 'Turkey', address: fullAddress },
      basketItems: lines.map(line => ({ id: String(line.id), name: line.name, category1: 'Moda', itemType: 'PHYSICAL', price: line.total.toFixed(2) })),
    });

    if (payment.status !== 'success' || !payment.token || !payment.paymentPageUrl) {
      console.error('checkout-start iyzico initialization failed', payment.errorCode || 'unknown');
      throw new Error('iyzico ödeme oturumu açılamadı');
    }
    await db(env, `payment_attempts?id=eq.${orderId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ token: payment.token, status: 'pending' }),
    });
    return json(200, { paymentPageUrl: payment.paymentPageUrl });
  } catch (error) {
    console.error('checkout-start', error.message);
    return json(503, { error: 'Ödeme şu anda başlatılamıyor. Lütfen daha sonra deneyin.' });
  }
}

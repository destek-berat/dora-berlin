import { db, html, iyzico } from '../../cloudflare/server.js';

async function callback(request, env) {
  try {
    const params = new URLSearchParams(request.method === 'POST' ? await request.text() : new URL(request.url).search);
    const token = params.get('token');
    if (!token || token.length > 300) return html('İşlem doğrulanamadı', 'Lütfen destek ekibimizle iletişime geçin.');
    const attempts = await db(env, `payment_attempts?select=*&token=eq.${encodeURIComponent(token)}&limit=1`);
    const attempt = attempts?.[0];
    if (!attempt) return html('İşlem bulunamadı', 'Lütfen destek ekibimizle iletişime geçin.');
    if (attempt.status === 'paid') {
      // Reconcile orders created before payment status was explicitly persisted.
      if (attempt.payment_id) {
        await db(env, `orders?payment_attempt_id=eq.${attempt.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ payment_status: 'paid', iyzico_payment_id: String(attempt.payment_id) }),
        });
      }
      return html('Ödeme alındı', 'Siparişiniz daha önce başarıyla kaydedildi.');
    }

    const payment = await iyzico(env, '/payment/iyzipos/checkoutform/auth/ecom/detail', {
      locale: 'tr', conversationId: attempt.id, token,
    });
    const checks = {
      apiStatus: payment.status === 'success',
      paymentStatus: payment.paymentStatus === 'SUCCESS',
      currency: payment.currency === 'TRY',
      basketId: String(payment.basketId) === String(attempt.id),
      conversationId: String(payment.conversationId) === String(attempt.id),
      amount: Number.isFinite(Number(payment.paidPrice)) && Math.round(Number(payment.paidPrice) * 100) === Math.round(Number(attempt.amount) * 100),
      paymentId: !!payment.paymentId,
      fraudApproved: Number(payment.fraudStatus) === 1,
    };
    if (Object.values(checks).some(ok => !ok)) {
      // An ambiguous transaction may already have been charged. Do not mark it failed.
      console.error('checkout-callback verification incomplete', JSON.stringify({ checks, errorCode: payment.errorCode || null, fraudStatus: payment.fraudStatus ?? null }));
      return html('İşlem kontrol ediliyor', 'Ödeme sonucu kesinleştirilemedi. Yeniden ödeme yapmadan önce destek ekibimizle iletişime geçin.');
    }

    const order = {
      ...attempt.order_data,
      payment_attempt_id: attempt.id,
      payment_id: String(payment.paymentId),
      payment_status: 'paid',
      iyzico_payment_id: String(payment.paymentId),
    };
    await db(env, 'orders', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(order),
    });
    await db(env, `payment_attempts?id=eq.${attempt.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'paid', payment_id: String(payment.paymentId) }),
    });
    return html('Ödemeniz başarılı', 'Siparişiniz alındı. Teşekkür ederiz.');
  } catch (error) {
    console.error('checkout-callback', error.message);
    return html('İşlem kontrol ediliyor', 'Ödeme sonucu şu anda kesinleştirilemedi. Yeniden ödeme yapmadan önce destek ekibimizle iletişime geçin.');
  }
}

export async function onRequestPost({ request, env }) { return callback(request, env); }
export async function onRequestGet({ request, env }) { return callback(request, env); }

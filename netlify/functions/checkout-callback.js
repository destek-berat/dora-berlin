const Iyzipay=require('iyzipay');
function html(status,message){return {statusCode:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'},body:`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DORA BERLIN — Ödeme sonucu</title><body style="font:18px system-ui;background:#2b1b15;color:#f8f2e9;text-align:center;padding:12vh 20px"><h1>DORA BERLIN</h1><h2>${status}</h2><p>${message}</p><a style="color:#e8c8a1" href="/">Mağazaya dön</a></body></html>`};}
async function db(path,options={}){const key=process.env.SUPABASE_SECRET_KEY;const r=await fetch(process.env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/'+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...(options.headers||{})}});if(!r.ok)throw Error('DB '+r.status);const body=await r.text();return body?JSON.parse(body):null;}
function retrieve(client,token){return new Promise((resolve,reject)=>client.checkoutForm.retrieve({locale:Iyzipay.LOCALE.TR,token},(err,res)=>err?reject(err):resolve(res)));}
exports.handler=async(event)=>{
 if(!['POST','GET'].includes(event.httpMethod))return {statusCode:405,body:'Method not allowed'};
 try{
 const params=new URLSearchParams(event.httpMethod==='POST'?event.body||'':event.rawQuery||'');const token=params.get('token');if(!token||token.length>300)return html('İşlem doğrulanamadı','Lütfen destek ekibimizle iletişime geçin.');
 const matches=await db('payment_attempts?select=*&token=eq.'+encodeURIComponent(token)+'&limit=1');const attempt=matches[0];if(!attempt)return html('İşlem bulunamadı','Lütfen destek ekibimizle iletişime geçin.');
 if(attempt.status==='paid')return html('Ödeme alındı','Siparişiniz daha önce başarıyla kaydedildi.');
 const client=new Iyzipay({apiKey:process.env.IYZICO_API_KEY,secretKey:process.env.IYZICO_SECRET_KEY,uri:process.env.IYZICO_BASE_URL||'https://sandbox-api.iyzipay.com'});
 const payment=await retrieve(client,token);
 const valid=payment.status==='success'&&payment.paymentStatus==='SUCCESS'&&payment.currency==='TRY'&&String(payment.basketId)===String(attempt.id)&&String(payment.conversationId)===String(attempt.id)&&Math.round(Number(payment.paidPrice)*100)===Math.round(Number(attempt.amount)*100)&&!!payment.paymentId;
 if(!valid){await db('payment_attempts?id=eq.'+attempt.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'failed'})});return html('Ödeme onaylanmadı','Kartınızdan ödeme alınmadıysa tekrar deneyebilirsiniz. İşlem belirsizse destek ekibimizle iletişime geçin.');}
 // UNIQUE payment_attempt_id prevents duplicate order creation on repeated callbacks.
 const order={...attempt.order_data,payment_attempt_id:attempt.id,payment_id:String(payment.paymentId)};
 await db('orders',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(order)});
 await db('payment_attempts?id=eq.'+attempt.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'paid',payment_id:String(payment.paymentId)})});
 return html('Ödemeniz başarılı','Siparişiniz alındı. Teşekkür ederiz.');
 }catch(e){console.error('checkout-callback',e.message);return html('İşlem kontrol ediliyor','Ödeme sonucu şu anda kesinleştirilemedi. Yeniden ödeme yapmadan önce destek ekibimizle iletişime geçin.');}
};

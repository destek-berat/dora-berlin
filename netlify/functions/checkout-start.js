const crypto=require('node:crypto');
const Iyzipay=require('iyzipay');
const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
const response=(status,data)=>({statusCode:status,headers,body:JSON.stringify(data)});
function env(name){const v=process.env[name];if(!v)throw Error('Sunucu yapılandırması eksik: '+name);return v;}
async function supabase(path,options={}){const url=env('SUPABASE_URL').replace(/\/$/,'');const key=env('SUPABASE_SECRET_KEY');const r=await fetch(url+'/rest/v1/'+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...(options.headers||{})}});if(!r.ok)throw Error('Veritabanı hatası '+r.status);return r.status===204?null:r.json();}
function iyzi(){return new Iyzipay({apiKey:env('IYZICO_API_KEY'),secretKey:env('IYZICO_SECRET_KEY'),uri:process.env.IYZICO_BASE_URL||'https://sandbox-api.iyzipay.com'});}
function initialize(client,body){return new Promise((resolve,reject)=>client.checkoutFormInitialize.create(body,(err,res)=>err?reject(err):resolve(res)));}
exports.handler=async(event)=>{
 if(event.httpMethod!=='POST')return response(405,{error:'Method not allowed'});
 try{
 const input=JSON.parse(event.body||'{}');const items=input.items,customer=input.customer||{};
 if(!Array.isArray(items)||items.length<1||items.length>30)return response(400,{error:'Sepet geçersiz'});
 const counts=new Map();for(const item of items){const id=Number(item.id),qty=Number(item.qty);if(!Number.isSafeInteger(id)||!Number.isSafeInteger(qty)||qty<1||qty>10)return response(400,{error:'Ürün veya adet geçersiz'});counts.set(id,(counts.get(id)||0)+qty);}
 if([...counts.values()].some(q=>q>10))return response(400,{error:'Ürün adedi sınırı aşıldı'});
 const name=String(customer.name||'').trim(),email=String(customer.email||'').trim(),phone=String(customer.phone||'').replace(/\D/g,''),address=String(customer.address||'').trim(),city=String(customer.city||'').trim(),district=String(customer.district||'').trim();
 if(name.length<3||name.length>120||!name.includes(' ')||!/^\S+@\S+\.\S+$/.test(email)||email.length>180||phone.length<10||phone.length>13||![address,city,district].every(v=>v.length>=2&&v.length<=300))return response(400,{error:'Teslimat bilgileri eksik'});
 const ids=[...counts.keys()];const rows=await supabase('products?select=id,name,price,stock,is_active&id=in.('+ids.join(',')+')');
 if(rows.length!==ids.length)return response(400,{error:'Sepette yayında olmayan ürün var'});
 let totalKurus=0;const lines=[];
 for(const id of ids){const p=rows.find(r=>Number(r.id)===id),qty=counts.get(id);if(!p.is_active||Number(p.stock)<qty)return response(400,{error:'Ürün stokta yok: '+p.name});const kurus=Math.round(Number(p.price)*100);if(!Number.isSafeInteger(kurus)||kurus<=0)return response(400,{error:'Ürün fiyatı geçersiz'});totalKurus+=kurus*qty;lines.push({id,name:String(p.name),qty,price:kurus/100,total:kurus*qty/100});}
 if(totalKurus<=0||totalKurus>100000000)return response(400,{error:'Sipariş tutarı geçersiz'});
 // Shipping is deliberately zero until a verified shipping tariff is configured.
 const orderId=crypto.randomUUID(),amount=(totalKurus/100).toFixed(2),person=name.split(/\s+/),surname=person.pop();
 const basketItems=lines.map(x=>({id:String(x.id),name:x.name,category1:'Moda',itemType:Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,price:x.total.toFixed(2)}));
 const order={id:orderId,order_number:'DB-'+Date.now()+'-'+orderId.slice(0,6),customer_name:name,customer_email:email,customer_phone:phone,shipping_address:{address,city,district},items:lines,total_amount:Number(amount)};
 // A dedicated staging table avoids claiming payment before verification.
 await supabase('payment_attempts',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({id:orderId,order_data:order,amount:Number(amount),status:'initiating'})});
 const fullAddress=[address,district,city].join(', ');
 const result=await initialize(iyzi(),{locale:Iyzipay.LOCALE.TR,conversationId:orderId,price:amount,paidPrice:amount,currency:Iyzipay.CURRENCY.TRY,basketId:orderId,paymentGroup:Iyzipay.PAYMENT_GROUP.PRODUCT,callbackUrl:'https://doraberlin.com/.netlify/functions/checkout-callback',buyer:{id:orderId,name:person.join(' '),surname,identityNumber:'11111111111',email,gsmNumber:phone.startsWith('90')?'+'+phone:'+90'+phone.replace(/^0/,'') ,registrationAddress:fullAddress,city,country:'Turkey',ip:(event.headers['x-forwarded-for']||'').split(',')[0]||'127.0.0.1'},shippingAddress:{contactName:name,city,country:'Turkey',address:fullAddress},billingAddress:{contactName:name,city,country:'Turkey',address:fullAddress},basketItems});
 if(result.status!=='success'||!result.token||!result.paymentPageUrl)throw Error('iyzico ödeme oturumu açılamadı');
 await supabase('payment_attempts?id=eq.'+orderId,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({token:result.token,status:'pending'})});
 return response(200,{paymentPageUrl:result.paymentPageUrl});
 }catch(e){console.error('checkout-start',e.message);return response(503,{error:'Ödeme şu anda başlatılamıyor. Lütfen daha sonra deneyin.'});}
};

import crypto from 'node:crypto';
import { adminClient, cors, json, PLANS } from '../_lib.js';
export const config={api:{bodyParser:false}};
async function rawBody(req){const chunks=[];for await(const chunk of req)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));return Buffer.concat(chunks);}
export default async function handler(req,res){
  cors(res);if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
  try{const raw=await rawBody(req),sig=String(req.headers['x-paystack-signature']||''),expected=crypto.createHmac('sha512',process.env.PAYSTACK_SECRET_KEY).update(raw).digest('hex');
    if(!sig||sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return json(res,401,{error:'Invalid signature.'});
    const event=JSON.parse(raw.toString('utf8'));if(event.event!=='charge.success')return json(res,200,{received:true});const tx=event.data||{};const meta=typeof tx.metadata==='string'?JSON.parse(tx.metadata||'{}'):tx.metadata||{};const plan=meta.plan,userId=meta.user_id;if(!userId||!PLANS[plan])return json(res,200,{received:true});
    if(tx.status!=='success'||Number(tx.amount)!==PLANS[plan].amount||String(tx.currency||'').toUpperCase()!=='GHS')return json(res,200,{received:true});
    const supabase=adminClient(),r=await supabase.from('invoice_subscriptions').select('*').eq('user_id',userId).single();if(r.error||!r.data)return json(res,200,{received:true});const sub=r.data;
    if(sub.paystack_transaction_id===Number(tx.id)&&sub.subscription_end&&new Date(sub.subscription_end)>new Date())return json(res,200,{received:true});
    const now=new Date(),base=sub.subscription_end&&new Date(sub.subscription_end)>now?new Date(sub.subscription_end):now,end=new Date(base.getTime()+PLANS[plan].durationDays*86400000);
    await supabase.from('invoice_subscriptions').update({plan,status:'active',subscription_start:now.toISOString(),subscription_end:end.toISOString(),amount:PLANS[plan].amount,currency:'GHS',paystack_reference:tx.reference,subscription_reference:sub.subscription_reference||meta.subscription_reference||`NAB-SUB-${String(tx.reference).slice(-8).toUpperCase()}`,paystack_transaction_id:Number(tx.id)||null}).eq('user_id',userId);
    return json(res,200,{received:true});
  }catch(e){console.error(e);return json(res,400,{error:e.message||'Webhook processing failed.'});}
}

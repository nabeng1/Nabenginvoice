import { cors, getAuthenticatedUser, json, PLANS, paystack } from '../_lib.js';
export default async function handler(req,res){
  cors(res); if(req.method==='OPTIONS')return res.status(204).end(); if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
  try{const {supabase,user}=await getAuthenticatedUser(req); const reference=String(req.body?.reference||'').trim(); if(!reference)return json(res,400,{error:'Payment reference is required.'});
    const {data:sub,error:se}=await supabase.from('invoice_subscriptions').select('*').eq('user_id',user.id).eq('paystack_reference',reference).single(); if(se||!sub)return json(res,403,{error:'This payment reference is not linked to your account.'});
    const {data}=await paystack(`/transaction/verify/${encodeURIComponent(reference)}`),tx=data,expected=Number(sub.amount||0); if(tx.status!=='success')return json(res,400,{error:`Payment status is ${tx.status}.`});
    if(Number(tx.amount)!==expected||String(tx.currency||'').toUpperCase()!=='GHS')return json(res,400,{error:'Payment amount or currency does not match the selected plan.'});
    const plan=tx.metadata?.plan||(expected===PLANS.annual.amount?'annual':'monthly'); if(!PLANS[plan]||PLANS[plan].amount!==expected)return json(res,400,{error:'Payment plan could not be validated.'});
    const now=new Date(),base=sub.subscription_end&&new Date(sub.subscription_end)>now?new Date(sub.subscription_end):now,end=new Date(base.getTime()+PLANS[plan].durationDays*86400000);
    const update={plan,status:'active',subscription_start:now.toISOString(),subscription_end:end.toISOString(),amount:expected,currency:'GHS',paystack_reference:reference,subscription_reference:sub.subscription_reference||`NAB-SUB-${reference.slice(-8).toUpperCase()}`,paystack_transaction_id:Number(tx.id)||null};
    const r=await supabase.from('invoice_subscriptions').update(update).eq('user_id',user.id).select('*').single(); if(r.error)throw r.error; return json(res,200,{success:true,subscription:r.data});
  }catch(e){console.error(e);return json(res,500,{error:e.message||'Unable to verify payment.'});}
}

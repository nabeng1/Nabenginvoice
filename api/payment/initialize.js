import { cors, getAuthenticatedUser, json, PLANS, paystack, paystackReference } from '../_lib.js';
export default async function handler(req,res){
  cors(res); if(req.method==='OPTIONS')return res.status(204).end(); if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
  try{const {supabase,user}=await getAuthenticatedUser(req); const plan=String(req.body?.plan||'').toLowerCase(); const selected=PLANS[plan]; if(!selected)return json(res,400,{error:'Invalid subscription plan.'});
    const appUrl=(process.env.APP_URL||'').replace(/\/$/,''); if(!appUrl)return json(res,500,{error:'APP_URL is not configured on the server.'});
    const {data:sub,error:se}=await supabase.from('invoice_subscriptions').select('*').eq('user_id',user.id).single(); if(se||!sub)throw se||new Error('Subscription record not found.');
    const reference=paystackReference(),subRef=`NAB-SUB-${Math.random().toString(36).slice(2,10).toUpperCase()}`;
    const {error:ue}=await supabase.from('invoice_subscriptions').update({email:user.email||sub.email,paystack_reference:reference,subscription_reference:subRef,amount:selected.amount,currency:'GHS'}).eq('user_id',user.id); if(ue)throw ue;
    const result=await paystack('/transaction/initialize',{method:'POST',body:JSON.stringify({email:user.email,amount:String(selected.amount),currency:'GHS',reference,callback_url:`${appUrl}/?payment=success&reference=${encodeURIComponent(reference)}`,channels:['card','mobile_money','bank_transfer','ussd','bank','qr'],metadata:JSON.stringify({user_id:user.id,plan,subscription_reference:subRef,product:'Nabeng Invoice'})})});
    return json(res,200,{authorization_url:result.data.authorization_url,access_code:result.data.access_code,reference,subscription_reference:subRef,plan});
  }catch(e){console.error(e);return json(res,500,{error:e.message||'Unable to initialize payment.'});}
}

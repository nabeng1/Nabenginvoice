import { adminClient, cors, json, subscriptionAccess } from '../_lib.js';
export default async function handler(req,res){
  cors(res); if(req.method==='OPTIONS') return res.status(204).end(); if(req.method!=='GET') return json(res,405,{error:'Method not allowed.'});
  try{ const h=req.headers.authorization||''; const token=h.startsWith('Bearer ')?h.slice(7):''; if(!token)return json(res,401,{error:'Missing authorization token.'});
    const supabase=adminClient(); const {data:{user},error:ue}=await supabase.auth.getUser(token); if(ue||!user)return json(res,401,{error:'Invalid or expired session.'});
    let {data:row,error}=await supabase.from('invoice_subscriptions').select('*').eq('user_id',user.id).maybeSingle(); if(error)throw error;
    if(!row){const now=new Date(),end=new Date(now.getTime()+14*86400000); const r=await supabase.from('invoice_subscriptions').insert({user_id:user.id,email:user.email||'',plan:'trial',status:'active',trial_start:now.toISOString(),trial_end:end.toISOString()}).select('*').single(); if(r.error)throw r.error; row=r.data;}
    const access=subscriptionAccess(row); if(!access.accessActive&&row.status==='active'){const r=await supabase.from('invoice_subscriptions').update({status:'expired'}).eq('id',row.id).select('*').single(); if(r.data)row=r.data;}
    return json(res,200,{subscription:row,...subscriptionAccess(row)});
  }catch(e){console.error(e);return json(res,500,{error:e.message||'Unable to load subscription.'});}
}

import { createClient } from '@supabase/supabase-js';

export const PLANS = {
  monthly: { name: 'Monthly', amount: 3000, durationDays: 30 },
  annual: { name: 'Annual', amount: 30000, durationDays: 365 }
};

export function adminClient(){
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken:false, persistSession:false }
  });
}

export async function getAuthenticatedUser(req){
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if(!token) throw new Error('Missing authorization token.');
  const supabase = adminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if(error || !data.user) throw new Error('Invalid or expired session.');
  return { supabase, user:data.user };
}

export function json(res,status,payload){
  res.status(status).setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control','no-store');
  return res.end(JSON.stringify(payload));
}

export function cors(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
}

export function subscriptionAccess(row){
  if(!row) return {accessActive:false,state:'missing',daysRemaining:0};
  const now=Date.now();
  const end=row.plan==='trial' ? new Date(row.trial_end).getTime() : new Date(row.subscription_end||0).getTime();
  const accessActive=row.status==='active' && end>now;
  const daysRemaining=accessActive ? Math.max(0,Math.ceil((end-now)/86400000)) : 0;
  return {accessActive,state:accessActive ? row.plan : 'expired',daysRemaining};
}

export function subscriptionReference(){
  const token=Math.random().toString(36).slice(2,10).toUpperCase();
  return `NAB-SUB-${token}`;
}

export function paystackReference(){
  const token=Math.random().toString(36).slice(2,12).toUpperCase();
  return `NABENG-${Date.now()}-${token}`;
}

export async function paystack(path, options={}){
  const response=await fetch(`https://api.paystack.co${path}`,{
    ...options,
    headers:{
      Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type':'application/json',
      ...(options.headers||{})
    }
  });
  const data=await response.json();
  if(!response.ok || !data.status) throw new Error(data.message||'Paystack request failed.');
  return data;
}

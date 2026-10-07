import "../runtime.js";

async function niLoadAnalytics(){
  if(!NI.state.niSupabase||!NI.state.niSession)return;
  const {data,error}=await NI.state.niSupabase.from('invoices').select('total,amount_paid,status,invoice_date,currency').eq('user_id',NI.state.niSession.id).limit(1000);
  if(error){alert(error.message);return;}
  const rows=data||[]; const invoiced=rows.reduce((s,x)=>s+(Number(x.total)||0),0); const collected=rows.reduce((s,x)=>s+Math.min(Number(x.total)||0,Number(x.amount_paid)||0),0); const outstanding=Math.max(0,invoiced-collected);
  const paid=rows.filter(x=>NI.niCalculateStatus(x.total,x.amount_paid,null,x.status)==='paid').length; const overdue=rows.filter(x=>x.status==='overdue').length; const open=rows.length-paid;
  const cur=rows[0]?.currency||'Ghc';
  if(NI.$('metricInvoiced'))NI.$('metricInvoiced').textContent=cur+' '+NI.niMoney(invoiced);
  if(NI.$('metricCollected'))NI.$('metricCollected').textContent=cur+' '+NI.niMoney(collected);
  if(NI.$('metricOutstanding'))NI.$('metricOutstanding').textContent=cur+' '+NI.niMoney(outstanding);
  if(NI.$('metricPaidInvoices'))NI.$('metricPaidInvoices').textContent=paid;
  if(NI.$('metricOpenInvoices'))NI.$('metricOpenInvoices').textContent=open;
  if(NI.$('metricOverdueInvoices'))NI.$('metricOverdueInvoices').textContent=overdue;
  const months={}; rows.forEach(x=>{const m=String(x.invoice_date||'').slice(0,7)||'Unknown';months[m]=(months[m]||0)+(Number(x.total)||0);});
  const detail=NI.$('analyticsDetail'); if(detail){const top=Object.entries(months).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,6);detail.innerHTML=top.length?top.map(([m,v])=>`<div><span>${NI.niEscape(m)}</span><strong>${NI.niEscape(cur)} ${NI.niMoney(v)}</strong></div>`).join(''):'<p>No invoice data yet.</p>';}
}

Object.assign(NI, {
  niLoadAnalytics
});

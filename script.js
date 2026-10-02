
/* ============================================================
   NABENG INVOICE ACCOUNT PLATFORM
   Replace the two values below with your Supabase project values.
   Use the project's public anon key only — never put a service_role key here.
============================================================ */
const NABENG_SUPABASE_URL = "https://vbtppozknezdierutirp.supabase.co";
const NABENG_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZidHBwb3prbmV6ZGllcnV0aXJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MzY3NjQsImV4cCI6MjEwNjMxMjc2NH0.0eCglmdxpPwkok6A52D03TuHBbE4bZD92n9kFZ4o_t8";

let niSupabase = null;
let niSession = null;
let niProfile = null;
let niAuthMode = 'signin';
let niEditingInvoiceId = null;
let niProfileLogoDataUrl = '';
let niProfileLogoFile = null;
let niProfileSignatureDataUrl = '';
let niProfileSignatureFile = null;
let niRemoveLogo = false;
let niRemoveSignature = false;
let niCurrentInvoice = null;
let niCustomers = [];
let niEditingCustomerId = null;
let niCustomerStats = {};

const NABENG_INVOICE_BRAND_LOGO = 'assets/nabeng-invoice-logo.png';
const $ni = id => document.getElementById(id);

function niRefreshBrandLogos(){
  document.querySelectorAll('[data-ni-brand-logo]').forEach(img=>{ img.src=NABENG_INVOICE_BRAND_LOGO; });
}
function niShow(id){ $ni(id)?.classList.remove('ni-hidden'); }
function niHide(id){ $ni(id)?.classList.add('ni-hidden'); }
function niMsg(id,text,type='success'){ const el=$ni(id); if(!el)return; el.textContent=text; el.className='ni-msg show '+type; }
function niClearMsg(id){ const el=$ni(id); if(el) el.className='ni-msg'; }
function niInitial(name){ return (name||'N').trim().charAt(0).toUpperCase(); }
function niEscape(value){ const d=document.createElement('div'); d.textContent=String(value??''); return d.innerHTML; }
function niMoney(value){ const n=Number(value)||0; return n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function niInvoiceTotalFromItems(invoiceItems){ return (invoiceItems||[]).reduce((sum,item)=>{ const q=parseFloat(item.qty)||0; const r=parseFloat(item.rate)||0; return sum + q*r; },0); }
function niPricingSummary(invoiceItems){ const subtotal=niInvoiceTotalFromItems(invoiceItems); const type=$ni('invDiscountType')?.value||'none'; const value=Math.max(0,Number($ni('invDiscountValue')?.value)||0); const discount=type==='percent'?Math.min(subtotal,subtotal*value/100):type==='amount'?Math.min(subtotal,value):0; const taxRate=Math.max(0,Number($ni('invTaxRate')?.value)||0); const taxable=Math.max(0,subtotal-discount); const tax=taxable*taxRate/100; return {subtotal,discountType:type,discountValue:value,discountAmount:discount,taxRate,taxAmount:tax,total:taxable+tax}; }
function niPaymentStatusFromAmount(total,paid,dueDate){ return niCalculateStatus(total,paid,dueDate,'unpaid'); }
function niToday(){ return new Date().toISOString().slice(0,10); }
function niNormalStatus(status){ return ['unpaid','partial','paid','overdue'].includes(status) ? status : 'unpaid'; }
function niCalculateStatus(total,amountPaid,dueDate,status){
  const paid=Math.max(0,Number(amountPaid)||0);
  const totalNum=Math.max(0,Number(total)||0);
  if(totalNum>0 && paid>=totalNum) return 'paid';
  if(dueDate && dueDate < niToday() && paid < totalNum) return 'overdue';
  if(paid>0) return 'partial';
  return niNormalStatus(status)==='paid' ? 'unpaid' : 'unpaid';
}
function niBalance(total,amountPaid){ return Math.max(0,(Number(total)||0)-(Number(amountPaid)||0)); }
function niUpdatePaymentPreview(){
  const pricing=niPricingSummary(items||[]);
  const paid=Math.max(0,Number($ni('invAmountPaid')?.value)||0);
  const balance=niBalance(pricing.total,paid);
  const cur=$ni('currency')?.value||'Ghc';
  const el=$ni('invBalancePreview'); if(el)el.textContent=cur+' '+niMoney(balance);
  const totalEl=$ni('invTotalPreview'); if(totalEl)totalEl.textContent=cur+' '+niMoney(pricing.total);
  const status=$ni('invPaymentStatus');
  if(status){ if(balance<=0 && pricing.total>0)status.value='paid'; else if(paid>0)status.value='partial'; else status.value='unpaid'; }
  const pSub=$ni('pSubtotal'),pDisc=$ni('pDiscount'),pTax=$ni('pTax');
  if(pSub)pSub.textContent=cur+' '+niMoney(pricing.subtotal); if(pDisc)pDisc.textContent=cur+' '+niMoney(pricing.discountAmount); if(pTax)pTax.textContent=cur+' '+niMoney(pricing.taxAmount);
}

async function niGenerateInvoiceNumber(){
  if(!niSupabase||!niSession)return;
  const year=new Date().getFullYear();
  const prefix=`INV-${year}-`;
  const {data,error}=await niSupabase.from('invoices').select('invoice_number').eq('user_id',niSession.id).like('invoice_number',prefix+'%').order('invoice_number',{ascending:false}).limit(1);
  if(error){console.warn('Invoice number generation failed:',error.message);return;}
  const last=String(data?.[0]?.invoice_number||'');
  const n=parseInt(last.replace(prefix,''),10)||0;
  const el=$ni('invNumber');
  if(el && !el.value.trim())el.value=prefix+String(n+1).padStart(4,'0');
}
function niSetLogoPreview(src){ const box=$ni('profileLogoPreview'); if(!box)return; box.innerHTML=src?`<img src="${src}" alt="Business logo">`:'<span>LOGO</span>'; }
function niSetSignaturePreview(src){ const box=$ni('profileSignaturePreview'); if(!box)return; box.innerHTML=src?`<img src="${src}" alt="Digital signature">`:'<span>No signature</span>'; }
function niApplySignatureToEditor(src){ const img=$ni('pSignature'); const row=$ni('digitalSignatureRow'); if(!img||!row)return; if(src){ img.src=src; row.style.display='flex'; } else { img.removeAttribute('src'); row.style.display='none'; } }
function niApplyLogoToEditor(src){ if(!src)return; niProfileLogoDataUrl=src; logoPreview.innerHTML=`<img src="${src}" alt="logo">`; pLogoCircle.innerHTML=`<img src="${src}" alt="logo">`; }

function niInitSupabase(){
  if(!window.supabase){ console.error('Supabase JS failed to load.'); return false; }
  if(NABENG_SUPABASE_URL.startsWith('YOUR_') || NABENG_SUPABASE_ANON_KEY.startsWith('YOUR_')) return false;
  niSupabase = window.supabase.createClient(NABENG_SUPABASE_URL,NABENG_SUPABASE_ANON_KEY);
  return true;
}

function niOpenAuth(mode='signin'){
  niAuthMode=mode;
  niHide('landingScreen'); niHide('dashboardScreen'); niShow('authScreen');
  document.body.classList.add('ni-auth-mode');
  $ni('tabSignIn').classList.toggle('active',mode==='signin');
  $ni('tabSignUp').classList.toggle('active',mode==='signup');
  document.querySelectorAll('.ni-signup-only').forEach(x=>x.classList.toggle('ni-hidden',mode!=='signup'));
  $ni('authTitle').textContent=mode==='signup'?'Create your Nabeng Invoice account':'Welcome back';
  $ni('authSubtitle').textContent=mode==='signup'?'Create your account and save your business profile in the cloud.':'Sign in to access your saved invoice workspace.';
  $ni('authSubmit').textContent=mode==='signup'?'Create Account':'Sign In';
  niClearMsg('authMsg');
}

function niOpenLanding(){ niHide('authScreen');niHide('dashboardScreen');niHide('invoiceApp');niHide('editorBar');niShow('landingScreen'); }
function niOpenDashboard(){ niHide('landingScreen');niHide('authScreen');niHide('invoiceApp');niHide('editorBar');niShow('dashboardScreen'); }

async function niEnsureProfile(user){
  const {data,error}=await niSupabase.from('invoice_profiles').select('*').eq('user_id',user.id).maybeSingle();
  if(error){ console.error(error); throw error; }
  if(data) return data;
  const fallback={user_id:user.id,full_name:user.user_metadata?.full_name||'',business_name:'',business_email:user.email||'',business_phone:'',business_address:'',logo_url:'',signature_url:''};
  const {data:created,error:createError}=await niSupabase.from('invoice_profiles').insert(fallback).select().single();
  if(createError) throw createError;
  return created;
}

async function niLoadUser(user){
  niSession=user;
  try{ niProfile=await niEnsureProfile(user); }catch(e){ console.error('Profile load failed',e); niProfile={user_id:user.id,full_name:user.user_metadata?.full_name||'',business_name:'',business_email:user.email||'',business_phone:'',business_address:'',logo_url:'',signature_url:''}; }
  $ni('dashUserName').textContent=niProfile.full_name||user.email||'User';
  $ni('dashAvatar').textContent=niInitial(niProfile.full_name||user.email);
  $ni('dashGreeting').textContent='Welcome back, '+(niProfile.full_name||user.email?.split('@')[0]||'there');
  $ni('dashEmail').textContent=user.email||'—';
  $ni('dashBusinessName').textContent=niProfile.business_name||'Business profile not set';
  $ni('dashBusinessContact').textContent=niProfile.business_phone||niProfile.business_email||'Add your business profile so invoices can be prepared automatically.';
  $ni('profileBusinessName').value=niProfile.business_name||'';
  $ni('profileBusinessEmail').value=niProfile.business_email||user.email||'';
  $ni('profileBusinessPhone').value=niProfile.business_phone||'';
  $ni('profileBusinessAddress').value=niProfile.business_address||'';
  niProfileLogoDataUrl=niProfile.logo_url||'';
  niProfileSignatureDataUrl=niProfile.signature_url||'';
  niSetLogoPreview(niProfileLogoDataUrl);
  niSetSignaturePreview(niProfileSignatureDataUrl);
  niApplySignatureToEditor(niProfileSignatureDataUrl);
  await niLoadCustomers();
  await niLoadInvoiceHistory();
  niOpenDashboard();
}

async function niStart(){
  if(!niInitSupabase()){
    niOpenLanding();
    console.warn('Configure NABENG_SUPABASE_URL and NABENG_SUPABASE_ANON_KEY in this file to enable authentication.');
    return;
  }
  const {data:{session}}=await niSupabase.auth.getSession();
  if(session?.user) await niLoadUser(session.user); else niOpenLanding();
  niSupabase.auth.onAuthStateChange(async (_event,sessionNow)=>{
    if(sessionNow?.user && !niSession) await niLoadUser(sessionNow.user);
    if(!sessionNow?.user){ niSession=null;niProfile=null;niOpenLanding(); }
  });
}

async function niAuthSubmit(e){
  e.preventDefault(); niClearMsg('authMsg');
  if(!niSupabase){ niMsg('authMsg','Add your Supabase URL and anon key in the configuration section first.','error');return; }
  const email=$ni('authEmail').value.trim(); const password=$ni('authPassword').value; const name=$ni('authName').value.trim();
  $ni('authSubmit').disabled=true; $ni('authSubmit').textContent=niAuthMode==='signup'?'Creating account…':'Signing in…';
  try{
    if(niAuthMode==='signup'){
      if(!name){throw new Error('Please enter your full name.');}
      const {data,error}=await niSupabase.auth.signUp({email,password,options:{data:{full_name:name}}});
      if(error)throw error;
      if(data.session){ await niLoadUser(data.user); }
      else niMsg('authMsg','Account created. Check your email if email confirmation is enabled, then sign in.','success');
    }else{
      const {data,error}=await niSupabase.auth.signInWithPassword({email,password});
      if(error)throw error; await niLoadUser(data.user);
    }
  }catch(err){ console.error(err);niMsg('authMsg',err.message||'Authentication failed.','error'); }
  finally{ $ni('authSubmit').disabled=false;$ni('authSubmit').textContent=niAuthMode==='signup'?'Create Account':'Sign In'; }
}

async function niSignOut(){ if(niSupabase) await niSupabase.auth.signOut(); niSession=null;niProfile=null;niOpenLanding(); }

async function niSaveProfile(){
  if(!niSupabase||!niSession)return;
  const btn=$ni('saveProfileBtn'); if(btn){btn.disabled=true;btn.textContent='Saving…';}
  try{
    let logoUrl=niRemoveLogo?'':(niProfile?.logo_url||'');
    let signatureUrl=niRemoveSignature?'':(niProfile?.signature_url||'');
    if(niProfileLogoFile){
      const ext=niProfileLogoFile.type==='image/png'?'png':'jpg';
      const path=`${niSession.id}/business-logo.${ext}`;
      const {error}=await niSupabase.storage.from('invoice-assets').upload(path,niProfileLogoFile,{upsert:true,contentType:niProfileLogoFile.type,cacheControl:'3600'});
      if(error)throw error;
      const {data}=niSupabase.storage.from('invoice-assets').getPublicUrl(path); logoUrl=data.publicUrl+'?v='+Date.now();
    }
    if(niProfileSignatureFile){
      const ext=niProfileSignatureFile.type==='image/png'?'png':'jpg';
      const path=`${niSession.id}/business-signature.${ext}`;
      const {error}=await niSupabase.storage.from('invoice-assets').upload(path,niProfileSignatureFile,{upsert:true,contentType:niProfileSignatureFile.type,cacheControl:'3600'});
      if(error)throw error;
      const {data}=niSupabase.storage.from('invoice-assets').getPublicUrl(path); signatureUrl=data.publicUrl+'?v='+Date.now();
    }
    const payload={full_name:niProfile?.full_name||niSession.user_metadata?.full_name||'',business_name:$ni('profileBusinessName').value.trim(),business_email:$ni('profileBusinessEmail').value.trim(),business_phone:$ni('profileBusinessPhone').value.trim(),business_address:$ni('profileBusinessAddress').value.trim(),logo_url:logoUrl,signature_url:signatureUrl,updated_at:new Date().toISOString()};
    const {data,error}=await niSupabase.from('invoice_profiles').upsert({user_id:niSession.id,...payload},{onConflict:'user_id'}).select().single();
    if(error)throw error;
    niProfile=data; niProfileLogoFile=null;niProfileSignatureFile=null;niRemoveLogo=false;niRemoveSignature=false;
    niProfileLogoDataUrl=logoUrl;niProfileSignatureDataUrl=signatureUrl;niSetLogoPreview(logoUrl);niSetSignaturePreview(signatureUrl);niApplySignatureToEditor(signatureUrl);if(logoUrl)niApplyLogoToEditor(logoUrl);
    niMsg('profileMsg','Business profile, logo and signature saved successfully.','success');
    $ni('dashBusinessName').textContent=data.business_name||'Business profile not set';
    $ni('dashBusinessContact').textContent=data.business_phone||data.business_email||'Profile saved';
  }catch(e){console.error('Profile save failed',e);niMsg('profileMsg',e.message||'Unable to save profile.','error');}
  finally{if(btn){btn.disabled=false;btn.textContent='Save Business Profile';}}
}

async function niLoadInvoiceHistory(){
  const list=$ni('invoiceHistoryList'); if(!list||!niSupabase||!niSession)return;
  list.innerHTML='<div class="ni-history-empty">Loading invoices...</div>';
  const {data,error}=await niSupabase.from('invoices').select('id,invoice_number,client_name,invoice_date,due_date,total,amount_paid,balance_due,currency,status,payment_date,payment_method,created_at').eq('user_id',niSession.id).order('created_at',{ascending:false}).limit(100);
  if(error){ console.error(error); list.innerHTML=`<div class="ni-history-empty">Unable to load invoice history: ${niEscape(error.message)}</div>`; return; }
  if(!data?.length){ list.innerHTML='<div class="ni-history-empty">No invoices yet. Create your first invoice and it will appear here.</div>'; return; }
  window.niInvoiceHistoryData=data.map(inv=>({...inv,status:niCalculateStatus(inv.total,inv.amount_paid,inv.due_date,inv.status)}));
  niRenderInvoiceHistory();
}

function niRenderInvoiceHistory(){
  const list=$ni('invoiceHistoryList'); if(!list)return;
  const q=($ni('invoiceHistorySearch')?.value||'').trim().toLowerCase();
  const filter=$ni('invoiceHistoryStatus')?.value||'all';
  const rows=(window.niInvoiceHistoryData||[]).filter(inv=>{
    const matchesSearch=!q || String(inv.invoice_number||'').toLowerCase().includes(q) || String(inv.client_name||'').toLowerCase().includes(q);
    return matchesSearch && (filter==='all'||inv.status===filter);
  });
  if(!rows.length){ list.innerHTML='<div class="ni-history-empty">No invoices match your filter.</div>'; return; }
  list.innerHTML=rows.map(inv=>{
    const paid=Number(inv.amount_paid)||0, balance=niBalance(inv.total,paid), status=inv.status;
    const due=inv.due_date?`Due ${niEscape(inv.due_date)}`:'No due date';
    return `<div class="ni-history-item">
      <div class="ni-history-main"><strong>${niEscape(inv.invoice_number||'Untitled invoice')}</strong><span>${niEscape(inv.client_name||'No client')} • ${niEscape(inv.invoice_date||'No date')}</span></div>
      <div class="ni-history-status"><span class="ni-status ni-status-${status}">${status==='partial'?'Partially Paid':status.charAt(0).toUpperCase()+status.slice(1)}</span><small>${due}</small></div>
      <div class="ni-history-total"><strong>${niEscape(inv.currency||'Ghc')} ${niMoney(inv.total)}</strong><small>Paid ${niMoney(paid)} • Balance ${niMoney(balance)}</small></div>
      <div class="ni-history-actions"><button class="ni-history-action primary" data-open-invoice="${inv.id}">Open</button><button class="ni-history-action" data-record-payment="${inv.id}">Payment</button><button class="ni-history-action" data-receipt-invoice="${inv.id}">Receipt</button>${status==='overdue'?`<button class="ni-history-action" data-reminder-invoice="${inv.id}">Reminder</button>`:''}<button class="ni-history-action danger" data-delete-invoice="${inv.id}">Delete</button></div>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-open-invoice]').forEach(btn=>btn.onclick=()=>niOpenSavedInvoice(btn.dataset.openInvoice));
  list.querySelectorAll('[data-delete-invoice]').forEach(btn=>btn.onclick=()=>niDeleteInvoice(btn.dataset.deleteInvoice));
  list.querySelectorAll('[data-record-payment]').forEach(btn=>btn.onclick=()=>niOpenPaymentModal(btn.dataset.recordPayment));
  list.querySelectorAll('[data-receipt-invoice]').forEach(btn=>btn.onclick=()=>niShowReceiptForInvoice(btn.dataset.receiptInvoice));
  list.querySelectorAll('[data-reminder-invoice]').forEach(btn=>btn.onclick=()=>niSendOverdueReminder(btn.dataset.reminderInvoice));
}

async function niOpenSavedInvoice(id){
  const {data,error}=await niSupabase.from('invoices').select('*').eq('id',id).eq('user_id',niSession.id).single();
  if(error){alert(error.message);return;}
  niEditingInvoiceId=data.id; niCurrentInvoice=data;
  items=Array.isArray(data.items)?data.items.map(x=>({qty:x.qty||'',desc:x.desc||'',rate:x.rate??''})):[];
  if(!items.length)items=[{qty:'',desc:'',rate:''}];
  const set=(id,val)=>{const el=$ni(id);if(el)el.value=val??'';};
  niApplySignatureToEditor(data.signature_url||niProfile?.signature_url||'');set('invoiceCustomer',data.customer_id||'');set('clientName',data.client_name);set('clientAddress',data.client_address);set('clientNumber',data.client_number);set('invDate',data.invoice_date);set('invNumber',data.invoice_number);set('currency',data.currency||'Ghc');set('invDueDate',data.due_date);set('invAmountPaid',data.amount_paid??0);set('invPaymentDate',data.payment_date);set('invPaymentMethod',data.payment_method);set('invPaymentStatus',niNormalStatus(data.status));set('invDiscountType',data.discount_type||'none');set('invDiscountValue',data.discount_value??0);set('invTaxRate',data.tax_rate??0);
  niOpenEditor(); renderItemRows(); renderPreview(); niUpdatePaymentPreview();
}

async function niDeleteInvoice(id){
  if(!confirm('Delete this saved invoice from your history?'))return;
  const {error}=await niSupabase.from('invoices').delete().eq('id',id).eq('user_id',niSession.id);
  if(error){alert(error.message);return;}
  if(niEditingInvoiceId===id)niEditingInvoiceId=null;
  await niLoadInvoiceHistory();
}

function niNewInvoice(){
  niEditingInvoiceId=null; niCurrentInvoice=null;
  items=Array.from({length:10},()=>({qty:'',desc:'',rate:''}));
  ['invoiceCustomer','clientName','clientAddress','clientNumber','invNumber','invDueDate','invPaymentDate'].forEach(id=>{const el=$ni(id);if(el)el.value='';});
  $ni('invDate').value=niToday();
  $ni('invDueDate').value=niToday();
  $ni('currency').value='Ghc';
  $ni('invAmountPaid').value='0';
  $ni('invPaymentStatus').value='unpaid';
  $ni('invPaymentMethod').value='';
  $ni('invDiscountType').value='none';$ni('invDiscountValue').value='0';$ni('invTaxRate').value='0';
  renderItemRows(); renderPreview(); niUpdatePaymentPreview();
  niGenerateInvoiceNumber();
}

async function niSaveInvoiceRecord(){
  if(!niSupabase||!niSession)return null;
  const cleanItems=items.filter(x=>x.qty||x.desc||x.rate).map(x=>({qty:x.qty||'',desc:x.desc||'',rate:x.rate||''}));
  const pricing=niPricingSummary(cleanItems);
  const total=pricing.total;
  const amountPaid=Math.min(total,Math.max(0,Number($ni('invAmountPaid')?.value)||0));
  const dueDate=$ni('invDueDate')?.value||null;
  const status=niCalculateStatus(total,amountPaid,dueDate,$ni('invPaymentStatus')?.value||'unpaid');
  if($ni('invPaymentStatus'))$ni('invPaymentStatus').value=status==='overdue'?'unpaid':status;
  const customerId=await niFindOrCreateCustomer();
  const payload={user_id:niSession.id,customer_id:customerId||null,business_name:$ni('bizName').value.trim(),business_address:$ni('bizAddress').value.trim(),business_phone:$ni('bizTel').value.trim(),logo_url:niProfile?.logo_url||niProfileLogoDataUrl||'',signature_url:niProfile?.signature_url||niProfileSignatureDataUrl||'',client_name:$ni('clientName').value.trim(),client_address:$ni('clientAddress').value.trim(),client_number:$ni('clientNumber').value.trim(),invoice_date:$ni('invDate').value||null,due_date:dueDate,invoice_number:$ni('invNumber').value.trim()||null,currency:$ni('currency').value.trim()||'Ghc',items:cleanItems,subtotal:pricing.subtotal,discount_type:pricing.discountType,discount_value:pricing.discountValue,discount_amount:pricing.discountAmount,tax_rate:pricing.taxRate,tax_amount:pricing.taxAmount,total,amount_paid:amountPaid,balance_due:niBalance(total,amountPaid),status,payment_date:$ni('invPaymentDate')?.value||null,payment_method:$ni('invPaymentMethod')?.value||null,updated_at:new Date().toISOString()};
  let result;
  if(niEditingInvoiceId){ result=await niSupabase.from('invoices').update(payload).eq('id',niEditingInvoiceId).eq('user_id',niSession.id).select().single(); }
  else { result=await niSupabase.from('invoices').insert(payload).select().single(); }
  if(result.error)throw result.error;
  niEditingInvoiceId=result.data.id; niCurrentInvoice=result.data; await niLoadInvoiceHistory(); await niLoadAnalytics(); return result.data;
}


async function niLoadCustomers(){
  const list=$ni('customerList'); if(!list||!niSupabase||!niSession)return;
  list.innerHTML='<div class="ni-history-empty">Loading customers...</div>';
  const {data,error}=await niSupabase.from('customers').select('*').eq('user_id',niSession.id).order('name',{ascending:true});
  if(error){console.error(error);list.innerHTML=`<div class="ni-history-empty">Unable to load customers: ${niEscape(error.message)}</div>`;return;}
  niCustomers=data||[];
  const invoiceStats=await niSupabase.from('invoices').select('customer_id,total,amount_paid').eq('user_id',niSession.id).not('customer_id','is',null);
  niCustomerStats={};
  (invoiceStats.data||[]).forEach(inv=>{const id=String(inv.customer_id);if(!niCustomerStats[id])niCustomerStats[id]={count:0,balance:0};niCustomerStats[id].count++;niCustomerStats[id].balance+=niBalance(inv.total,inv.amount_paid);});
  niPopulateCustomerSelect();
  niRenderCustomers();
}

function niPopulateCustomerSelect(selectedId=''){
  const select=$ni('invoiceCustomer'); if(!select)return;
  select.innerHTML='<option value="">Select a saved customer or enter details below</option>'+niCustomers.map(c=>`<option value="${niEscape(c.id)}">${niEscape(c.name)}${c.phone?' • '+niEscape(c.phone):''}</option>`).join('');
  if(selectedId)select.value=selectedId;
}

function niApplySelectedCustomer(){
  const id=$ni('invoiceCustomer')?.value; if(!id)return;
  const c=niCustomers.find(x=>String(x.id)===String(id)); if(!c)return;
  $ni('clientName').value=c.name||'';$ni('clientAddress').value=c.address||'';$ni('clientNumber').value=c.phone||'';
  if($ni('clientName'))$ni('clientName').dispatchEvent(new Event('input',{bubbles:true}));
  if($ni('clientAddress'))$ni('clientAddress').dispatchEvent(new Event('input',{bubbles:true}));
  if($ni('clientNumber'))$ni('clientNumber').dispatchEvent(new Event('input',{bubbles:true}));
}

function niRenderCustomers(){
  const list=$ni('customerList');if(!list)return;
  const q=($ni('customerSearch')?.value||'').trim().toLowerCase();
  const rows=niCustomers.filter(c=>!q||[c.name,c.phone,c.email,c.address].some(v=>String(v||'').toLowerCase().includes(q)));
  if(!rows.length){list.innerHTML='<div class="ni-history-empty">No customers found.</div>';return;}
  list.innerHTML=rows.map(c=>`<div class="ni-customer-row"><div><strong>${niEscape(c.name)}</strong><span>${niEscape(c.phone||'No phone')} ${c.email?'• '+niEscape(c.email):''}</span><small>${niEscape(c.address||'No address')}</small><small>${niCustomerStats[String(c.id)]?.count||0} invoice(s) • Outstanding ${niMoney(niCustomerStats[String(c.id)]?.balance||0)}</small></div><div class="ni-customer-actions"><button class="ni-history-action primary" data-edit-customer="${c.id}">Edit</button><button class="ni-history-action danger" data-delete-customer="${c.id}">Delete</button></div></div>`).join('');
  list.querySelectorAll('[data-edit-customer]').forEach(b=>b.onclick=()=>niEditCustomer(b.dataset.editCustomer));
  list.querySelectorAll('[data-delete-customer]').forEach(b=>b.onclick=()=>niDeleteCustomer(b.dataset.deleteCustomer));
}

function niEditCustomer(id){
  const c=niCustomers.find(x=>String(x.id)===String(id));if(!c)return;
  niEditingCustomerId=c.id;$ni('customerEditId').value=c.id;$ni('customerName').value=c.name||'';$ni('customerPhone').value=c.phone||'';$ni('customerEmail').value=c.email||'';$ni('customerAddress').value=c.address||'';$ni('customerNotes').value=c.notes||'';
  $ni('saveCustomerBtn').textContent='Update Customer';$ni('customerName').focus();
}

function niClearCustomerForm(){
  niEditingCustomerId=null;['customerEditId','customerName','customerPhone','customerEmail','customerAddress','customerNotes'].forEach(id=>{const e=$ni(id);if(e)e.value='';});
  $ni('saveCustomerBtn').textContent='Save Customer';
}

async function niSaveCustomer(){
  if(!niSupabase||!niSession)return;
  const name=$ni('customerName').value.trim();if(!name){alert('Please enter the customer name.');return;}
  const payload={user_id:niSession.id,name,phone:$ni('customerPhone').value.trim(),email:$ni('customerEmail').value.trim(),address:$ni('customerAddress').value.trim(),notes:$ni('customerNotes').value.trim(),updated_at:new Date().toISOString()};
  const result=niEditingCustomerId?await niSupabase.from('customers').update(payload).eq('id',niEditingCustomerId).eq('user_id',niSession.id).select().single():await niSupabase.from('customers').insert(payload).select().single();
  if(result.error){alert(result.error.message);return;}
  niClearCustomerForm();await niLoadCustomers();$ni('invoiceCustomer').value=result.data.id;niApplySelectedCustomer();
}

async function niDeleteCustomer(id){
  const c=niCustomers.find(x=>String(x.id)===String(id));if(!c)return;
  if(!confirm(`Delete ${c.name} from your customer list? Existing invoices will remain.`))return;
  const {error}=await niSupabase.from('customers').delete().eq('id',id).eq('user_id',niSession.id);
  if(error){alert(error.message);return;}
  if(String($ni('invoiceCustomer')?.value)===String(id)){$ni('invoiceCustomer').value='';}
  await niLoadCustomers();
}

async function niFindOrCreateCustomer(){
  if(!niSupabase||!niSession)return null;
  const selected=$ni('invoiceCustomer')?.value||'';
  if(selected)return selected;
  const name=$ni('clientName')?.value.trim()||'';if(!name)return null;
  const phone=$ni('clientNumber')?.value.trim()||'';
  const existing=niCustomers.find(c=>c.name.trim().toLowerCase()===name.toLowerCase() && (!phone||String(c.phone||'').trim()===phone));
  if(existing){$ni('invoiceCustomer').value=existing.id;return existing.id;}
  const payload={user_id:niSession.id,name,phone,address:$ni('clientAddress')?.value.trim()||'',email:'',notes:'',updated_at:new Date().toISOString()};
  const {data,error}=await niSupabase.from('customers').insert(payload).select().single();
  if(error)throw error;
  niCustomers.push(data);niPopulateCustomerSelect(data.id);return data.id;
}

function niOpenEditor(){
  niHide('landingScreen');niHide('authScreen');niHide('dashboardScreen');niShow('invoiceApp');niShow('editorBar');document.body.classList.remove('ni-auth-mode');document.body.classList.add('ni-editor-mode');
  // Load the signed-in business profile into the existing invoice form.
  if(niProfile){
    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val||'';};
    set('bizName',niProfile.business_name);set('bizAddress',niProfile.business_address);set('bizTel',niProfile.business_phone);if(niProfile.logo_url)niApplyLogoToEditor(niProfile.logo_url);niApplySignatureToEditor(niProfile.signature_url||'');renderPreview();
  }
}

async function niLoadAnalytics(){
  if(!niSupabase||!niSession)return;
  const {data,error}=await niSupabase.from('invoices').select('total,amount_paid,status,invoice_date,currency').eq('user_id',niSession.id).limit(1000);
  if(error){alert(error.message);return;}
  const rows=data||[]; const invoiced=rows.reduce((s,x)=>s+(Number(x.total)||0),0); const collected=rows.reduce((s,x)=>s+Math.min(Number(x.total)||0,Number(x.amount_paid)||0),0); const outstanding=Math.max(0,invoiced-collected);
  const paid=rows.filter(x=>niCalculateStatus(x.total,x.amount_paid,null,x.status)==='paid').length; const overdue=rows.filter(x=>x.status==='overdue').length; const open=rows.length-paid;
  const cur=rows[0]?.currency||'Ghc';
  if($ni('metricInvoiced'))$ni('metricInvoiced').textContent=cur+' '+niMoney(invoiced);
  if($ni('metricCollected'))$ni('metricCollected').textContent=cur+' '+niMoney(collected);
  if($ni('metricOutstanding'))$ni('metricOutstanding').textContent=cur+' '+niMoney(outstanding);
  if($ni('metricPaidInvoices'))$ni('metricPaidInvoices').textContent=paid;
  if($ni('metricOpenInvoices'))$ni('metricOpenInvoices').textContent=open;
  if($ni('metricOverdueInvoices'))$ni('metricOverdueInvoices').textContent=overdue;
  const months={}; rows.forEach(x=>{const m=String(x.invoice_date||'').slice(0,7)||'Unknown';months[m]=(months[m]||0)+(Number(x.total)||0);});
  const detail=$ni('analyticsDetail'); if(detail){const top=Object.entries(months).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,6);detail.innerHTML=top.length?top.map(([m,v])=>`<div><span>${niEscape(m)}</span><strong>${niEscape(cur)} ${niMoney(v)}</strong></div>`).join(''):'<p>No invoice data yet.</p>';}
}

async function niOpenPaymentModal(invoiceId){
  if(!niSupabase||!niSession)return;
  const {data,error}=await niSupabase.from('invoices').select('*').eq('id',invoiceId).eq('user_id',niSession.id).single();
  if(error){alert(error.message);return;}
  niCurrentInvoice=data; niEditingInvoiceId=data.id;
  $ni('paymentModal').classList.remove('ni-hidden'); $ni('paymentModalInvoice').textContent=(data.invoice_number||'Invoice')+' • '+(data.client_name||'');
  $ni('recordPaymentAmount').value='';$ni('recordPaymentDate').value=niToday();$ni('recordPaymentMethod').value=data.payment_method||'Cash';$ni('recordPaymentReference').value='';$ni('recordPaymentNotes').value='';
}
function niClosePaymentModal(){ $ni('paymentModal')?.classList.add('ni-hidden'); }
async function niSavePayment(){
  if(!niCurrentInvoice||!niSupabase||!niSession)return;
  const amount=Number($ni('recordPaymentAmount').value)||0; const remaining=niBalance(niCurrentInvoice.total,niCurrentInvoice.amount_paid);
  if(amount<=0){alert('Enter a payment amount greater than zero.');return;} if(amount>remaining+0.0001){alert('Payment cannot be greater than the remaining balance.');return;}
  const payload={user_id:niSession.id,invoice_id:niCurrentInvoice.id,amount,payment_date:$ni('recordPaymentDate').value||niToday(),payment_method:$ni('recordPaymentMethod').value||null,reference:$ni('recordPaymentReference').value.trim()||null,notes:$ni('recordPaymentNotes').value.trim()||null};
  const {error}=await niSupabase.from('invoice_payments').insert(payload); if(error){alert(error.message);return;}
  const newPaid=(Number(niCurrentInvoice.amount_paid)||0)+amount; const status=niPaymentStatusFromAmount(niCurrentInvoice.total,newPaid,niCurrentInvoice.due_date);
  const {error:updateError}=await niSupabase.from('invoices').update({amount_paid:newPaid,balance_due:niBalance(niCurrentInvoice.total,newPaid),status,payment_date:payload.payment_date,payment_method:payload.payment_method,updated_at:new Date().toISOString()}).eq('id',niCurrentInvoice.id).eq('user_id',niSession.id);
  if(updateError){alert(updateError.message);return;}
  niClosePaymentModal(); await niLoadInvoiceHistory(); await niLoadAnalytics(); alert('Payment recorded successfully.');
}

function niReceiptMarkup(inv,payment=null){
  const cur=inv.currency||'Ghc'; const paid=Number(payment?.amount||0); const total=Number(inv.total)||0;
  return `<div class="ni-receipt" id="receiptSheet"><div class="ni-receipt-brand"><strong>${niEscape(inv.business_name||niProfile?.business_name||'Nabeng Invoice')}</strong><span>PAYMENT RECEIPT</span></div><div class="ni-receipt-meta"><div><small>Receipt for</small><strong>${niEscape(inv.client_name||'Customer')}</strong></div><div><small>Invoice</small><strong>${niEscape(inv.invoice_number||'—')}</strong></div><div><small>Payment date</small><strong>${niEscape(payment?.payment_date||inv.payment_date||niToday())}</strong></div></div><div class="ni-receipt-amount"><span>Amount received</span><strong>${niEscape(cur)} ${niMoney(paid || inv.amount_paid)}</strong></div><div class="ni-receipt-lines"><div><span>Invoice total</span><strong>${niEscape(cur)} ${niMoney(total)}</strong></div><div><span>Total paid</span><strong>${niEscape(cur)} ${niMoney(inv.amount_paid)}</strong></div><div><span>Balance remaining</span><strong>${niEscape(cur)} ${niMoney(inv.balance_due??niBalance(total,inv.amount_paid))}</strong></div><div><span>Method</span><strong>${niEscape(payment?.payment_method||inv.payment_method||'—')}</strong></div></div><p class="ni-receipt-note">Thank you for your payment.</p></div>`;
}
async function niShowReceiptForInvoice(invoiceId){
  const {data,error}=await niSupabase.from('invoices').select('*').eq('id',invoiceId).eq('user_id',niSession.id).single(); if(error){alert(error.message);return;}
  const pay=await niSupabase.from('invoice_payments').select('*').eq('invoice_id',invoiceId).eq('user_id',niSession.id).order('created_at',{ascending:false}).limit(1); const latest=pay.data?.[0]||null;
  $ni('receiptContent').innerHTML=niReceiptMarkup(data,latest); $ni('receiptModal').classList.remove('ni-hidden'); $ni('downloadReceiptBtn').onclick=()=>niDownloadReceiptPdf(data,latest);
}
async function niDownloadReceiptPdf(inv,payment){
  const sheet=$ni('receiptSheet'); if(!sheet||!window.jspdf||typeof html2canvas==='undefined')return alert('PDF tools could not be loaded.');
  const canvas=await html2canvas(sheet,{scale:2.5,useCORS:true,backgroundColor:'#fff'}); const {jsPDF}=window.jspdf; const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a5'}); const w=pdf.internal.pageSize.getWidth()-16; const h=canvas.height*w/canvas.width; pdf.addImage(canvas.toDataURL('image/png'),'PNG',8,8,w,Math.min(h,pdf.internal.pageSize.getHeight()-16)); pdf.save(`${inv.invoice_number||'payment-receipt'}.pdf`);
}
function niCloseReceipt(){ $ni('receiptModal')?.classList.add('ni-hidden'); }
function niShareWhatsApp(){
  const name=$ni('clientName')?.value.trim()||'Customer', number=($ni('clientNumber')?.value||'').replace(/[^0-9]/g,''), inv=$ni('invNumber')?.value.trim()||'Invoice', cur=$ni('currency')?.value||'Ghc'; const pricing=niPricingSummary(items||[]); const paid=Number($ni('invAmountPaid')?.value)||0; const balance=niBalance(pricing.total,paid); const msg=`Hello ${name},%0A%0AHere are your invoice details from ${encodeURIComponent($ni('bizName')?.value.trim()||'our business')}.%0AInvoice: ${encodeURIComponent(inv)}%0ATotal: ${encodeURIComponent(cur)} ${niMoney(pricing.total)}%0APaid: ${encodeURIComponent(cur)} ${niMoney(paid)}%0ABalance: ${encodeURIComponent(cur)} ${niMoney(balance)}%0ADue date: ${encodeURIComponent($ni('invDueDate')?.value||'Not specified')}%0A%0AThank you.`; const url=number?`https://wa.me/${number}?text=${msg}`:`https://wa.me/?text=${msg}`; window.open(url,'_blank','noopener');
}

/* =========================================================
   PHASE 4 — RECURRING INVOICES, EXPENSES & REPORTING
========================================================= */
function niDateAdd(dateStr,frequency){
  const d=new Date((dateStr||niToday())+'T00:00:00');
  if(frequency==='weekly') d.setDate(d.getDate()+7);
  else if(frequency==='quarterly') d.setMonth(d.getMonth()+3);
  else if(frequency==='yearly') d.setFullYear(d.getFullYear()+1);
  else d.setMonth(d.getMonth()+1);
  return d.toISOString().slice(0,10);
}
function niSetPhase4Panel(id){
  ['recurringPanel','expensesPanel','reportsPanel','customerPanel','profilePanel','analyticsPanel'].forEach(x=>{const el=$ni(x);if(el&&x!==id)el.classList.add('ni-hidden');});
  const target=$ni(id);if(target)target.classList.remove('ni-hidden');
}
function niPopulateRecurringCustomerSelect(){
  const el=$ni('recurringCustomer');if(!el)return;
  const current=el.value;
  el.innerHTML='<option value="">Select customer</option>'+(niCustomers||[]).map(c=>`<option value="${niEscape(c.id)}">${niEscape(c.name)}</option>`).join('');
  if(current)el.value=current;
}
async function niLoadRecurring(){
  const list=$ni('recurringList');if(!list||!niSupabase||!niSession)return;
  list.innerHTML='<div class="ni-history-empty">Loading schedules...</div>';
  const {data,error}=await niSupabase.from('recurring_invoices').select('*').eq('user_id',niSession.id).order('next_invoice_date',{ascending:true});
  if(error){list.innerHTML=`<div class="ni-history-empty">Unable to load schedules: ${niEscape(error.message)}</div>`;return;}
  const rows=data||[];
  if(!rows.length){list.innerHTML='<div class="ni-history-empty">No recurring invoice schedules yet.</div>';return;}
  list.innerHTML=rows.map(r=>`<div class="ni-phase4-row"><div><strong>${niEscape(r.name||'Recurring invoice')}</strong><span>${niEscape(r.client_name||'Customer')} • ${niEscape(r.frequency||'monthly')}</span></div><div><small>Next invoice</small><strong>${niEscape(r.next_invoice_date||'—')}</strong></div><div><span class="ni-status ${r.active?'ni-status-paid':'ni-status-unpaid'}">${r.active?'Active':'Paused'}</span></div><div class="ni-customer-actions"><button class="ni-history-action primary" data-generate-recurring="${r.id}">Generate</button><button class="ni-history-action" data-toggle-recurring="${r.id}" data-active="${r.active}">${r.active?'Pause':'Activate'}</button><button class="ni-history-action danger" data-delete-recurring="${r.id}">Delete</button></div></div>`).join('');
  list.querySelectorAll('[data-generate-recurring]').forEach(b=>b.onclick=()=>niGenerateRecurringInvoice(b.dataset.generateRecurring));
  list.querySelectorAll('[data-toggle-recurring]').forEach(b=>b.onclick=()=>niToggleRecurring(b.dataset.toggleRecurring,b.dataset.active==='true'));
  list.querySelectorAll('[data-delete-recurring]').forEach(b=>b.onclick=()=>niDeleteRecurring(b.dataset.deleteRecurring));
}
async function niSaveRecurring(){
  if(!niSupabase||!niSession)return;
  const name=$ni('recurringName')?.value.trim();const customerId=$ni('recurringCustomer')?.value||null;const frequency=$ni('recurringFrequency')?.value||'monthly';const nextDate=$ni('recurringNextDate')?.value||niToday();const dueDays=Math.max(0,Number($ni('recurringDueDays')?.value)||0);const active=$ni('recurringActive')?.value!=='false';
  const cleanItems=items.filter(x=>x.qty||x.desc||x.rate).map(x=>({qty:x.qty||'',desc:x.desc||'',rate:x.rate||''}));
  if(!name){alert('Enter a schedule name.');return;} if(!$ni('clientName')?.value.trim()){alert('Enter a customer on the current invoice first.');return;} if(!cleanItems.length){alert('Add at least one invoice item first.');return;}
  const pricing=niPricingSummary(cleanItems);
  const payload={user_id:niSession.id,name,customer_id:customerId,client_name:$ni('clientName').value.trim(),client_address:$ni('clientAddress').value.trim(),client_number:$ni('clientNumber').value.trim(),business_name:$ni('bizName').value.trim(),business_address:$ni('bizAddress').value.trim(),business_phone:$ni('bizTel').value.trim(),currency:$ni('currency').value.trim()||'Ghc',items:cleanItems,subtotal:pricing.subtotal,discount_type:pricing.discountType,discount_value:pricing.discountValue,discount_amount:pricing.discountAmount,tax_rate:pricing.taxRate,tax_amount:pricing.taxAmount,due_days:dueDays,frequency,next_invoice_date:nextDate,active,updated_at:new Date().toISOString()};
  const {error}=await niSupabase.from('recurring_invoices').insert(payload);if(error){alert(error.message);return;}
  alert('Recurring invoice schedule saved.');await niLoadRecurring();
}
async function niGenerateRecurringInvoice(id){
  const {data,error}=await niSupabase.from('recurring_invoices').select('*').eq('id',id).eq('user_id',niSession.id).single();if(error){alert(error.message);return;}
  if(!data.active){alert('This recurring schedule is paused. Activate it first.');return;}
  niNewInvoice();
  $ni('invoiceCustomer').value=data.customer_id||'';niApplySelectedCustomer();
  $ni('clientName').value=data.client_name||$ni('clientName').value;$ni('clientAddress').value=data.client_address||$ni('clientAddress').value;$ni('clientNumber').value=data.client_number||$ni('clientNumber').value;$ni('bizName').value=data.business_name||$ni('bizName').value;$ni('bizAddress').value=data.business_address||$ni('bizAddress').value;$ni('bizTel').value=data.business_phone||$ni('bizTel').value;$ni('currency').value=data.currency||'Ghc';
  items=(data.items||[]).map(x=>({qty:x.qty||'',desc:x.desc||'',rate:x.rate??''}));if(!items.length)items=[{qty:'',desc:'',rate:''}];
  $ni('invDiscountType').value=data.discount_type||'none';$ni('invDiscountValue').value=data.discount_value??0;$ni('invTaxRate').value=data.tax_rate??0;$ni('invDueDate').value=(()=>{const d=new Date(niToday()+'T00:00:00');d.setDate(d.getDate()+Math.max(0,Number(data.due_days)||0));return d.toISOString().slice(0,10);})();
  renderItemRows();renderPreview();niUpdatePaymentPreview();niOpenEditor();
  await niSupabase.from('recurring_invoices').update({next_invoice_date:niDateAdd(data.next_invoice_date||niToday(),data.frequency),updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',niSession.id);
  await niLoadRecurring();
}
async function niToggleRecurring(id,current){const {error}=await niSupabase.from('recurring_invoices').update({active:!current,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',niSession.id);if(error){alert(error.message);return;}await niLoadRecurring();}
async function niDeleteRecurring(id){if(!confirm('Delete this recurring invoice schedule?'))return;const {error}=await niSupabase.from('recurring_invoices').delete().eq('id',id).eq('user_id',niSession.id);if(error){alert(error.message);return;}await niLoadRecurring();}
async function niLoadExpenses(){
  const list=$ni('expenseList');if(!list||!niSupabase||!niSession)return;list.innerHTML='<div class="ni-history-empty">Loading expenses...</div>';
  const {data,error}=await niSupabase.from('expenses').select('*').eq('user_id',niSession.id).order('expense_date',{ascending:false}).limit(200);
  if(error){list.innerHTML=`<div class="ni-history-empty">Unable to load expenses: ${niEscape(error.message)}</div>`;return;}
  const rows=data||[];if(!rows.length){list.innerHTML='<div class="ni-history-empty">No expenses recorded yet.</div>';return;}
  const cur=rows[0]?.currency||'Ghc';list.innerHTML=rows.map(r=>`<div class="ni-phase4-row"><div><strong>${niEscape(r.description)}</strong><span>${niEscape(r.category||'Other')} • ${niEscape(r.expense_date||'—')}</span></div><div><strong>${niEscape(r.currency||cur)} ${niMoney(r.amount)}</strong></div><div class="ni-customer-actions"><button class="ni-history-action" data-edit-expense="${r.id}">Edit</button><button class="ni-history-action danger" data-delete-expense="${r.id}">Delete</button></div></div>`).join('');
  list.querySelectorAll('[data-edit-expense]').forEach(b=>b.onclick=()=>niEditExpense(b.dataset.editExpense));list.querySelectorAll('[data-delete-expense]').forEach(b=>b.onclick=()=>niDeleteExpense(b.dataset.deleteExpense));
}
async function niSaveExpense(){
  if(!niSupabase||!niSession)return;const description=$ni('expenseDescription')?.value.trim();const amount=Number($ni('expenseAmount')?.value)||0;if(!description||amount<=0){alert('Enter an expense description and a valid amount.');return;}
  const payload={user_id:niSession.id,description,category:$ni('expenseCategory')?.value||'Other',amount,expense_date:$ni('expenseDate')?.value||niToday(),currency:$ni('currency')?.value||'Ghc',notes:$ni('expenseNotes')?.value.trim()||null,updated_at:new Date().toISOString()};const id=$ni('expenseEditId')?.value||'';
  const result=id?await niSupabase.from('expenses').update(payload).eq('id',id).eq('user_id',niSession.id):await niSupabase.from('expenses').insert(payload);if(result.error){alert(result.error.message);return;}niClearExpenseForm();await niLoadExpenses();await niLoadAnalytics();
}
async function niEditExpense(id){const {data,error}=await niSupabase.from('expenses').select('*').eq('id',id).eq('user_id',niSession.id).single();if(error){alert(error.message);return;}$ni('expenseEditId').value=data.id;$ni('expenseDescription').value=data.description||'';$ni('expenseCategory').value=data.category||'Other';$ni('expenseAmount').value=data.amount||'';$ni('expenseDate').value=data.expense_date||niToday();$ni('expenseNotes').value=data.notes||'';}
function niClearExpenseForm(){$ni('expenseEditId').value='';$ni('expenseDescription').value='';$ni('expenseAmount').value='';$ni('expenseDate').value=niToday();$ni('expenseNotes').value='';}
async function niDeleteExpense(id){if(!confirm('Delete this expense?'))return;const {error}=await niSupabase.from('expenses').delete().eq('id',id).eq('user_id',niSession.id);if(error){alert(error.message);return;}await niLoadExpenses();await niLoadAnalytics();}
async function niRunReport(){
  if(!niSupabase||!niSession)return;const from=$ni('reportFrom')?.value||'0000-01-01';const to=$ni('reportTo')?.value||'9999-12-31';
  const [invRes,expRes,payRes]=await Promise.all([niSupabase.from('invoices').select('id,total,amount_paid,invoice_date,currency,status').eq('user_id',niSession.id).gte('invoice_date',from).lte('invoice_date',to),niSupabase.from('expenses').select('amount,expense_date,currency,category').eq('user_id',niSession.id).gte('expense_date',from).lte('expense_date',to),niSupabase.from('invoice_payments').select('id,amount,payment_date').eq('user_id',niSession.id).gte('payment_date',from).lte('payment_date',to)]);
  if(invRes.error){alert(invRes.error.message);return;}if(expRes.error){alert(expRes.error.message);return;}if(payRes.error){alert(payRes.error.message);return;}
  const inv=invRes.data||[],exp=expRes.data||[],pay=payRes.data||[];const cur=inv[0]?.currency||exp[0]?.currency||'Ghc';const revenue=inv.reduce((s,x)=>s+(Number(x.total)||0),0);const collected=pay.length?pay.reduce((s,x)=>s+(Number(x.amount)||0),0):inv.reduce((s,x)=>s+Math.min(Number(x.total)||0,Number(x.amount_paid)||0),0);const expenses=exp.reduce((s,x)=>s+(Number(x.amount)||0),0);const profit=collected-expenses;
  $ni('reportRevenue').textContent=cur+' '+niMoney(revenue);$ni('reportCollected').textContent=cur+' '+niMoney(collected);$ni('reportExpenses').textContent=cur+' '+niMoney(expenses);$ni('reportProfit').textContent=cur+' '+niMoney(profit);$ni('reportInvoiceCount').textContent=inv.length;$ni('reportPaymentCount').textContent=pay.length;
  const cats={};exp.forEach(x=>cats[x.category||'Other']=(cats[x.category||'Other']||0)+(Number(x.amount)||0));const breakdown=$ni('reportBreakdown');breakdown.innerHTML=Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div><span>${niEscape(k)}</span><strong>${niEscape(cur)} ${niMoney(v)}</strong></div>`).join('')||'<p>No expense breakdown for this period.</p>';
}
function niOpenReports(){niSetPhase4Panel('reportsPanel');$ni('reportFrom').value=$ni('reportFrom').value||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10);$ni('reportTo').value=$ni('reportTo').value||niToday();niRunReport();}
function niOpenRecurring(){niSetPhase4Panel('recurringPanel');niPopulateRecurringCustomerSelect();$ni('recurringNextDate').value=$ni('recurringNextDate').value||niToday();niLoadRecurring();}
function niOpenExpenses(){niSetPhase4Panel('expensesPanel');if(!$ni('expenseDate').value)$ni('expenseDate').value=niToday();niLoadExpenses();}
async function niSendOverdueReminder(id){const {data,error}=await niSupabase.from('invoices').select('*').eq('id',id).eq('user_id',niSession.id).single();if(error){alert(error.message);return;}const number=(data.client_number||'').replace(/[^0-9]/g,'');const cur=data.currency||'Ghc';const msg=`Hello ${data.client_name||'Customer'},%0A%0AThis is a friendly payment reminder for invoice ${data.invoice_number||''}.%0AOutstanding balance: ${encodeURIComponent(cur)} ${niMoney(data.balance_due??niBalance(data.total,data.amount_paid))}%0ADue date: ${encodeURIComponent(data.due_date||'')}.%0A%0AThank you.`;window.open(number?`https://wa.me/${number}?text=${msg}`:`https://wa.me/?text=${msg}`,'_blank','noopener');}
function niWire(){
  const onClick=(id,fn)=>{const el=$ni(id);if(el)el.onclick=fn;};
  const onInput=(id,fn)=>{const el=$ni(id);if(el)el.addEventListener('input',fn);};
  const onChange=(id,fn)=>{const el=$ni(id);if(el)el.addEventListener('change',fn);};
  const onSubmit=(id,fn)=>{const el=$ni(id);if(el)el.addEventListener('submit',fn);};

  onClick('landingSignIn',()=>niOpenAuth('signin'));
  onClick('landingSignUp',()=>niOpenAuth('signup'));
  onClick('heroGetStarted',()=>niOpenAuth('signup'));
  onClick('heroSignIn',()=>niOpenAuth('signin'));
  onClick('tabSignIn',()=>niOpenAuth('signin'));
  onClick('tabSignUp',()=>niOpenAuth('signup'));
  onClick('backToLanding',niOpenLanding);
  onSubmit('authForm',niAuthSubmit);

  onClick('dashLogout',niSignOut);
  onClick('customersBtn',()=>{
    niSetPhase4Panel('customerPanel');
    niLoadCustomers();
  });
  onClick('refreshCustomersBtn',niLoadCustomers);
  onClick('saveCustomerBtn',niSaveCustomer);
  onClick('cancelCustomerBtn',niClearCustomerForm);
  onInput('customerSearch',niRenderCustomers);
  onChange('invoiceCustomer',niApplySelectedCustomer);
  onInput('invoiceHistorySearch',niRenderInvoiceHistory);
  onChange('invoiceHistoryStatus',niRenderInvoiceHistory);

  onClick('editorSignOut',niSignOut);
  onClick('newInvoiceBtn',()=>{niNewInvoice();niOpenEditor();});
  onClick('dashboardInvoiceBtn',()=>{niNewInvoice();niOpenEditor();});
  onClick('backDashboardBtn',()=>{niLoadInvoiceHistory();niOpenDashboard();});
  onClick('refreshInvoicesBtn',niLoadInvoiceHistory);

  onClick('editProfileBtn',()=>{
    niSetPhase4Panel('profilePanel');
  });
  onClick('analyticsBtn',()=>{
    niSetPhase4Panel('analyticsPanel');
    niLoadAnalytics();
  });
  onClick('refreshAnalyticsBtn',niLoadAnalytics);
  onClick('recurringBtn',niOpenRecurring);
  onClick('refreshRecurringBtn',niLoadRecurring);
  onClick('saveRecurringBtn',niSaveRecurring);
  onClick('clearRecurringBtn',()=>{if($ni('recurringName'))$ni('recurringName').value='';if($ni('recurringNextDate'))$ni('recurringNextDate').value=niToday();});
  onClick('expensesBtn',niOpenExpenses);
  onClick('refreshExpensesBtn',niLoadExpenses);
  onClick('saveExpenseBtn',niSaveExpense);
  onClick('clearExpenseBtn',niClearExpenseForm);
  onClick('reportsBtn',niOpenReports);
  onClick('refreshReportsBtn',niRunReport);
  onClick('runReportBtn',niRunReport);
  onClick('closePaymentModal',niClosePaymentModal);
  onClick('cancelPaymentBtn',niClosePaymentModal);
  onClick('savePaymentBtn',niSavePayment);
  onClick('closeReceiptModal',niCloseReceipt);
  onClick('closeReceiptBtn',niCloseReceipt);
  onClick('whatsappBtn',niShareWhatsApp);
  onClick('receiptBtn',async()=>{
    if(!niEditingInvoiceId){alert('Save the invoice first.');return;}
    await niShowReceiptForInvoice(niEditingInvoiceId);
  });

  onClick('saveProfileBtn',niSaveProfile);

  const logoInput=$ni('profileLogoInput');
  if(logoInput)logoInput.addEventListener('change',e=>{
    const file=e.target.files?.[0];
    if(!file)return;
    if(!['image/png','image/jpeg','image/jpg'].includes(file.type)){
      alert('Please upload a PNG or JPG logo.');
      e.target.value='';
      return;
    }
    if(file.size>2*1024*1024){
      alert('Logo must be 2MB or smaller.');
      e.target.value='';
      return;
    }
    niProfileLogoFile=file;
    niRemoveLogo=false;
    const reader=new FileReader();
    reader.onload=()=>{
      niProfileLogoDataUrl=reader.result;
      niSetLogoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  });

  const profileSignatureInput=$ni('profileSignatureInput');
  if(profileSignatureInput)profileSignatureInput.addEventListener('change',e=>{
    const file=e.target.files?.[0];
    if(!file)return;
    if(!['image/png','image/jpeg','image/jpg'].includes(file.type)){
      alert('Please upload a PNG or JPG signature.');
      e.target.value='';
      return;
    }
    if(file.size>2*1024*1024){
      alert('Signature must be 2MB or smaller.');
      e.target.value='';
      return;
    }
    niProfileSignatureFile=file;
    niRemoveSignature=false;
    const reader=new FileReader();
    reader.onload=()=>{
      niProfileSignatureDataUrl=reader.result;
      niSetSignaturePreview(reader.result);
      niApplySignatureToEditor(reader.result);
    };
    reader.readAsDataURL(file);
  });

  onClick('removeLogoBtn',()=>{
    niProfileLogoFile=null;
    niProfileLogoDataUrl='';
    niRemoveLogo=true;
    niSetLogoPreview('');
  });
  onClick('removeSignatureBtn',()=>{
    niProfileSignatureFile=null;
    niProfileSignatureDataUrl='';
    niRemoveSignature=true;
    niSetSignaturePreview('');
    niApplySignatureToEditor('');
  });
}




  // Start with 10 blank rows, like the paper template
  let items = Array.from({length: 10}, () => ({ qty: '', desc: '', rate: '' }));

  const itemsWrap = document.getElementById('itemsWrap');
  const addItemBtn = document.getElementById('addItemBtn');
  const printBtn = document.getElementById('printBtn');
  const logoInput = document.getElementById('logoInput');
  const logoPreview = document.getElementById('logoPreview');
  const pLogoCircle = document.getElementById('pLogoCircle');

  function fmt(n){
    const val = isNaN(n) ? 0 : n;
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function escapeAttr(str){
    return String(str).replace(/"/g, '&quot;');
  }

  function escapeHtml(str){
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function renderItemRows(){
    itemsWrap.innerHTML = '';
    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div>
          ${idx === 0 ? '<label>Qty</label>' : ''}
          <input type="text" class="i-qty" value="${escapeAttr(item.qty)}">
        </div>
        <div>
          ${idx === 0 ? '<label>Description</label>' : ''}
          <input type="text" class="i-desc" value="${escapeAttr(item.desc)}" placeholder="Item description">
        </div>
        <div>
          ${idx === 0 ? '<label>Unit cost</label>' : ''}
          <input type="number" class="i-rate" value="${item.rate}" min="0" step="0.01">
        </div>
        <div>
          ${idx === 0 ? '<label>&nbsp;</label>' : ''}
          <button type="button" class="remove-item" ${items.length <= 1 ? 'disabled' : ''} title="Remove row">&times;</button>
        </div>
      `;
      row.querySelector('.i-qty').addEventListener('input', e => { item.qty = e.target.value; renderPreview(); });
      row.querySelector('.i-desc').addEventListener('input', e => { item.desc = e.target.value; renderPreview(); });
      row.querySelector('.i-rate').addEventListener('input', e => { item.rate = e.target.value; renderPreview(); });
      row.querySelector('.remove-item').addEventListener('click', () => {
        items.splice(idx, 1);
        renderItemRows();
        renderPreview();
      });
      itemsWrap.appendChild(row);
    });
  }

  function formatDate(value){
    if (!value) return '';
    const d = new Date(value + 'T00:00:00');
    if (isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function renderPreview(){
    document.getElementById('pBizName').textContent = document.getElementById('bizName').value || 'Business Name';
    document.getElementById('pBizAddress').textContent = document.getElementById('bizAddress').value;
    document.getElementById('pBizTel').textContent = document.getElementById('bizTel').value ? ('Tel: ' + document.getElementById('bizTel').value) : '';

    document.getElementById('pClientName').textContent = document.getElementById('clientName').value || '\u00A0';
    document.getElementById('pClientAddress').textContent = document.getElementById('clientAddress').value || '\u00A0';
    document.getElementById('pClientNumber').textContent = document.getElementById('clientNumber').value || '\u00A0';
    document.getElementById('pInvDate').textContent = formatDate(document.getElementById('invDate').value) || '\u00A0';
    document.getElementById('pInvNumber').textContent = document.getElementById('invNumber').value || '\u00A0';
    const dueDate=document.getElementById('invDueDate')?.value || '';
    const pricingPreview=niPricingSummary(items||[]);
    const paidPreview=Math.min(pricingPreview.total,Math.max(0,Number(document.getElementById('invAmountPaid')?.value)||0));
    document.getElementById('pInvDueDate').textContent = formatDate(dueDate) || '\u00A0';
    document.getElementById('pInvBalance').textContent = (document.getElementById('currency').value || 'Ghc')+' '+niMoney(niBalance(pricingPreview.total,paidPreview));

    const cur = document.getElementById('currency').value || '';
    document.getElementById('pRateHeader').innerHTML = 'Unit Cost<br>' + escapeHtml(cur);
    document.getElementById('pAmountHeader').innerHTML = 'Sub Total<br>' + escapeHtml(cur);

    const body = document.getElementById('pItemsBody');
    body.innerHTML = '';
    let total = 0;
    items.forEach(item => {
      const qtyNum = parseFloat(item.qty) || 0;
      const rateNum = parseFloat(item.rate) || 0;
      const hasContent = item.qty || item.desc || item.rate;
      const amount = qtyNum * rateNum;
      if (hasContent) total += amount;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="qty-cell">${item.qty ? escapeHtml(item.qty) : '&nbsp;'}</td>
        <td class="desc-cell">${item.desc ? escapeHtml(item.desc) : '&nbsp;'}</td>
        <td class="num">${item.rate ? fmt(rateNum) : '&nbsp;'}</td>
        <td class="num">${hasContent ? fmt(amount) : '&nbsp;'}</td>
      `;
      body.appendChild(tr);
    });

    const pricing=niPricingSummary(items||[]);
    document.getElementById('pTotal').textContent = fmt(pricing.total);
    if($ni('pSubtotal'))$ni('pSubtotal').textContent=(document.getElementById('currency').value||'Ghc')+' '+niMoney(pricing.subtotal);
    if($ni('pDiscount'))$ni('pDiscount').textContent=(document.getElementById('currency').value||'Ghc')+' '+niMoney(pricing.discountAmount);
    if($ni('pTax'))$ni('pTax').textContent=(document.getElementById('currency').value||'Ghc')+' '+niMoney(pricing.taxAmount);
  }

  addItemBtn.addEventListener('click', () => {
    items.push({ qty: '', desc: '', rate: '' });
    renderItemRows();
    renderPreview();
  });

  printBtn.addEventListener('click', async () => {
    const button = printBtn;
    const sheet = document.getElementById('sheet');

    if (!sheet || typeof html2canvas === 'undefined' || !window.jspdf) {
      alert('PDF tools could not be loaded. Please check your internet connection and try again.');
      return;
    }

    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = 'Creating PDF...';

    try {
      if(niSupabase && niSession && !$ni('invNumber').value.trim()){
        await niGenerateInvoiceNumber();
        renderPreview();
      }
      // Capture the invoice exactly as it is rendered in the preview.
      const canvas = await html2canvas(sheet, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Keep the invoice proportions while fitting it cleanly on A4.
      const margin = 8;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;

      const ratio = Math.min(
        maxWidth / canvas.width,
        maxHeight / canvas.height
      );

      const imgWidth = canvas.width * ratio;
      const imgHeight = canvas.height * ratio;
      const x = (pageWidth - imgWidth) / 2;
      const y = (pageHeight - imgHeight) / 2;

      const imageData = canvas.toDataURL('image/jpeg', 0.96);
      pdf.addImage(imageData, 'JPEG', x, y, imgWidth, imgHeight, undefined, 'FAST');

      const invoiceNo = document.getElementById('invNumber').value.trim();
      const clientName = document.getElementById('clientName').value.trim();

      let fileName = invoiceNo
        ? `Invoice-${invoiceNo}`
        : clientName
          ? `Invoice-${clientName}`
          : 'Nabeng-Invoice';

      fileName = fileName
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '-');

      pdf.save(`${fileName}.pdf`);
      if(niSupabase && niSession){
        try{ await niSaveInvoiceRecord(); }catch(saveError){ console.error('Invoice history save failed:',saveError); alert('PDF downloaded, but the invoice could not be saved to invoice history: '+(saveError.message||'Unknown error')); }
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Unable to create the PDF. Please try again.');
    } finally {
      button.disabled = false;
      button.innerHTML = originalText;
    }
  });

  logoInput.addEventListener('change', () => {
    const file = logoInput.files[0];
    if (!file) return;
    if (!['image/png','image/jpeg','image/jpg'].includes(file.type)) { alert('Please upload a PNG or JPG logo.'); logoInput.value=''; return; }
    if (file.size > 2 * 1024 * 1024) { alert('Logo must be 2MB or smaller.'); logoInput.value=''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      niProfileLogoFile=file;
      niProfileLogoDataUrl=reader.result;
      niApplyLogoToEditor(reader.result);
    };
    reader.readAsDataURL(file);
  });


  // ---------- DIGITAL SIGNATURE ----------
  const signatureInput = document.getElementById('signatureInput');
  const signaturePreview = document.getElementById('signaturePreview');
  const removeSignatureBtn = document.getElementById('removeSignatureBtn');
  const digitalSignatureRow = document.getElementById('digitalSignatureRow');
  const pSignature = document.getElementById('pSignature');

  signatureInput.addEventListener('change', () => {
    const file = signatureInput.files[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      alert('Please upload a PNG or JPG signature image.');
      signatureInput.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Signature image must be 2MB or smaller.');
      signatureInput.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const src = reader.result;

      signaturePreview.innerHTML = `<img src="${src}" alt="Digital signature">`;
      pSignature.src = src;
      digitalSignatureRow.style.display = 'flex';
    };

    reader.readAsDataURL(file);
  });

  removeSignatureBtn.addEventListener('click', () => {
    signatureInput.value = '';
    signaturePreview.innerHTML = '<span>No signature</span>';
    pSignature.removeAttribute('src');
    digitalSignatureRow.style.display = 'none';
  });

  ['bizName','bizAddress','bizTel','clientName','clientAddress','clientNumber','invDate','invNumber','invDueDate','invPaymentDate','currency']
    .forEach(id => {
      const el=document.getElementById(id);
      if(el)el.addEventListener('input',()=>{ renderPreview(); niUpdatePaymentPreview(); });
    });
  ['invAmountPaid','invPaymentStatus','invPaymentMethod','invDiscountType','invDiscountValue','invTaxRate'].forEach(id=>{ const el=document.getElementById(id); if(el)el.addEventListener('input',niUpdatePaymentPreview); if(el)el.addEventListener('change',niUpdatePaymentPreview); });

  document.getElementById('invDate').value = niToday();
  document.getElementById('invDueDate').value = niToday();

  renderItemRows();
  renderPreview();


niWire();
niStart();


// Keep all application branding tied to the single logo asset.
if(document.readyState !== 'loading') niRefreshBrandLogos();
else document.addEventListener('DOMContentLoaded', niRefreshBrandLogos);

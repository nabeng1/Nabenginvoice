
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
function niSetLogoPreview(src){ const box=$ni('profileLogoPreview'); if(!box)return; box.innerHTML=src?`<img src="${src}" alt="Business logo">`:'<span>LOGO</span>'; }
function niSetSignaturePreview(src){ const box=$ni('profileSignaturePreview'); if(!box)return; box.innerHTML=src?`<img src="${src}" alt="Digital signature">`:'<span>✍️ No signature</span>'; }
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
  const {data,error}=await niSupabase.from('invoices').select('id,invoice_number,client_name,invoice_date,total,currency,status,created_at').eq('user_id',niSession.id).order('created_at',{ascending:false}).limit(50);
  if(error){ console.error(error); list.innerHTML=`<div class="ni-history-empty">Unable to load invoice history: ${niEscape(error.message)}</div>`; return; }
  if(!data?.length){ list.innerHTML='<div class="ni-history-empty">No invoices yet. Create your first invoice and it will appear here.</div>'; return; }
  list.innerHTML=data.map(inv=>`<div class="ni-history-item"><div class="ni-history-main"><strong>${niEscape(inv.invoice_number||'Untitled invoice')}</strong><span>${niEscape(inv.client_name||'No client')} • ${niEscape(inv.invoice_date||'No date')}</span></div><div class="ni-history-meta">Created ${new Date(inv.created_at).toLocaleDateString()}</div><div class="ni-history-total">${niEscape(inv.currency||'Ghc')} ${niMoney(inv.total)}</div><div class="ni-history-actions"><button class="ni-history-action primary" data-open-invoice="${inv.id}">Open</button><button class="ni-history-action danger" data-delete-invoice="${inv.id}">Delete</button></div></div>`).join('');
  list.querySelectorAll('[data-open-invoice]').forEach(btn=>btn.onclick=()=>niOpenSavedInvoice(btn.dataset.openInvoice));
  list.querySelectorAll('[data-delete-invoice]').forEach(btn=>btn.onclick=()=>niDeleteInvoice(btn.dataset.deleteInvoice));
}

async function niOpenSavedInvoice(id){
  const {data,error}=await niSupabase.from('invoices').select('*').eq('id',id).eq('user_id',niSession.id).single();
  if(error){alert(error.message);return;}
  niEditingInvoiceId=data.id; niCurrentInvoice=data;
  items=Array.isArray(data.items)?data.items.map(x=>({qty:x.qty||'',desc:x.desc||'',rate:x.rate??''})):[];
  if(!items.length)items=[{qty:'',desc:'',rate:''}];
  const set=(id,val)=>{const el=$ni(id);if(el)el.value=val??'';};
  niApplySignatureToEditor(data.signature_url||niProfile?.signature_url||'');set('clientName',data.client_name);set('clientAddress',data.client_address);set('clientNumber',data.client_number);set('invDate',data.invoice_date);set('invNumber',data.invoice_number);set('currency',data.currency||'Ghc');
  niOpenEditor(); renderItemRows(); renderPreview();
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
  ['clientName','clientAddress','clientNumber','invNumber'].forEach(id=>{const el=$ni(id);if(el)el.value='';});
  $ni('invDate').valueAsDate=new Date();
  $ni('currency').value='Ghc';
  renderItemRows(); renderPreview();
}

async function niSaveInvoiceRecord(){
  if(!niSupabase||!niSession)return null;
  const cleanItems=items.filter(x=>x.qty||x.desc||x.rate).map(x=>({qty:x.qty||'',desc:x.desc||'',rate:x.rate||''}));
  const total=niInvoiceTotalFromItems(cleanItems);
  const payload={user_id:niSession.id,business_name:$ni('bizName').value.trim(),business_address:$ni('bizAddress').value.trim(),business_phone:$ni('bizTel').value.trim(),logo_url:niProfile?.logo_url||niProfileLogoDataUrl||'',signature_url:niProfile?.signature_url||niProfileSignatureDataUrl||'',client_name:$ni('clientName').value.trim(),client_address:$ni('clientAddress').value.trim(),client_number:$ni('clientNumber').value.trim(),invoice_date:$ni('invDate').value||null,invoice_number:$ni('invNumber').value.trim()||null,currency:$ni('currency').value.trim()||'Ghc',items:cleanItems,total,status:'generated',updated_at:new Date().toISOString()};
  let result;
  if(niEditingInvoiceId){ result=await niSupabase.from('invoices').update(payload).eq('id',niEditingInvoiceId).eq('user_id',niSession.id).select().single(); }
  else { result=await niSupabase.from('invoices').insert(payload).select().single(); }
  if(result.error)throw result.error;
  niEditingInvoiceId=result.data.id; niCurrentInvoice=result.data; await niLoadInvoiceHistory(); return result.data;
}

function niOpenEditor(){
  niHide('landingScreen');niHide('authScreen');niHide('dashboardScreen');niShow('invoiceApp');niShow('editorBar');document.body.classList.remove('ni-auth-mode');document.body.classList.add('ni-editor-mode');
  // Load the signed-in business profile into the existing invoice form.
  if(niProfile){
    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val||'';};
    set('bizName',niProfile.business_name);set('bizAddress',niProfile.business_address);set('bizTel',niProfile.business_phone);if(niProfile.logo_url)niApplyLogoToEditor(niProfile.logo_url);niApplySignatureToEditor(niProfile.signature_url||'');renderPreview();
  }
}

function niWire(){
  $ni('landingSignIn').onclick=()=>niOpenAuth('signin');$ni('landingSignUp').onclick=()=>niOpenAuth('signup');$ni('heroGetStarted').onclick=()=>niOpenAuth('signup');$ni('heroSignIn').onclick=()=>niOpenAuth('signin');
  $ni('tabSignIn').onclick=()=>niOpenAuth('signin');$ni('tabSignUp').onclick=()=>niOpenAuth('signup');$ni('backToLanding').onclick=niOpenLanding;$ni('authForm').addEventListener('submit',niAuthSubmit);
  $ni('dashLogout').onclick=niSignOut;$ni('editorSignOut').onclick=niSignOut;$ni('newInvoiceBtn').onclick=()=>{niNewInvoice();niOpenEditor();};$ni('dashboardInvoiceBtn').onclick=()=>{niNewInvoice();niOpenEditor();};$ni('backDashboardBtn').onclick=()=>{niLoadInvoiceHistory();niOpenDashboard();};$ni('refreshInvoicesBtn').onclick=niLoadInvoiceHistory;
  $ni('editProfileBtn').onclick=()=>{ $ni('profilePanel').classList.toggle('ni-hidden'); };
  $ni('saveProfileBtn').onclick=niSaveProfile;
  $ni('profileLogoInput').addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;if(!['image/png','image/jpeg','image/jpg'].includes(file.type)){alert('Please upload a PNG or JPG logo.');e.target.value='';return;}if(file.size>2*1024*1024){alert('Logo must be 2MB or smaller.');e.target.value='';return;}niProfileLogoFile=file;niRemoveLogo=false;const reader=new FileReader();reader.onload=()=>{niProfileLogoDataUrl=reader.result;niSetLogoPreview(reader.result);};reader.readAsDataURL(file);});
  $ni('profileSignatureInput').addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;if(!['image/png','image/jpeg','image/jpg'].includes(file.type)){alert('Please upload a PNG or JPG signature.');e.target.value='';return;}if(file.size>2*1024*1024){alert('Signature must be 2MB or smaller.');e.target.value='';return;}niProfileSignatureFile=file;niRemoveSignature=false;const reader=new FileReader();reader.onload=()=>{niProfileSignatureDataUrl=reader.result;niSetSignaturePreview(reader.result);niApplySignatureToEditor(reader.result);};reader.readAsDataURL(file);});
  $ni('removeLogoBtn').onclick=()=>{niProfileLogoFile=null;niProfileLogoDataUrl='';niRemoveLogo=true;niSetLogoPreview('');};
  $ni('removeSignatureBtn').onclick=()=>{niProfileSignatureFile=null;niProfileSignatureDataUrl='';niRemoveSignature=true;niSetSignaturePreview('');niApplySignatureToEditor('');};
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

    document.getElementById('pTotal').textContent = fmt(total);
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
    signaturePreview.innerHTML = '<span>✍️ No signature</span>';
    pSignature.removeAttribute('src');
    digitalSignatureRow.style.display = 'none';
  });

  ['bizName','bizAddress','bizTel','clientName','clientAddress','clientNumber','invDate','invNumber','currency']
    .forEach(id => {
      document.getElementById(id).addEventListener('input', renderPreview);
    });

  document.getElementById('invDate').valueAsDate = new Date();

  renderItemRows();
  renderPreview();


niWire();
niStart();


// Keep all application branding tied to the single logo asset.
if(document.readyState !== 'loading') niRefreshBrandLogos();
else document.addEventListener('DOMContentLoaded', niRefreshBrandLogos);

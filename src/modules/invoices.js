import "../runtime.js";

async function niGenerateInvoiceNumber(){
  if(!NI.state.niSupabase||!NI.state.niSession)return;
  const year=new Date().getFullYear();
  const prefix=`INV-${year}-`;
  const {data,error}=await NI.state.niSupabase.from('invoices').select('invoice_number').eq('user_id',NI.state.niSession.id).like('invoice_number',prefix+'%').order('invoice_number',{ascending:false}).limit(1);
  if(error){console.warn('Invoice number generation failed:',error.message);return;}
  const last=String(data?.[0]?.invoice_number||'');
  const n=parseInt(last.replace(prefix,''),10)||0;
  const el=NI.$('invNumber');
  if(el && !el.value.trim())el.value=prefix+String(n+1).padStart(4,'0');
}
async function niLoadInvoiceHistory(){
  const list=NI.$('invoiceHistoryList'); if(!list||!NI.state.niSupabase||!NI.state.niSession)return;
  list.innerHTML='<div class="ni-history-empty">Loading invoices...</div>';
  const {data,error}=await NI.state.niSupabase.from('invoices').select('id,invoice_number,client_name,invoice_date,due_date,total,amount_paid,balance_due,currency,status,payment_date,payment_method,created_at').eq('user_id',NI.state.niSession.id).order('created_at',{ascending:false}).limit(100);
  if(error){ console.error(error); list.innerHTML=`<div class="ni-history-empty">Unable to load invoice history: ${NI.niEscape(error.message)}</div>`; return; }
  if(!data?.length){ list.innerHTML='<div class="ni-history-empty">No invoices yet. Create your first invoice and it will appear here.</div>'; return; }
  window.niInvoiceHistoryData=data.map(inv=>({...inv,status:NI.niCalculateStatus(inv.total,inv.amount_paid,inv.due_date,inv.status)}));
  NI.niRenderInvoiceHistory();
}

function niRenderInvoiceHistory(){
  const list=NI.$('invoiceHistoryList'); if(!list)return;
  const q=(NI.$('invoiceHistorySearch')?.value||'').trim().toLowerCase();
  const filter=NI.$('invoiceHistoryStatus')?.value||'all';
  const rows=(window.niInvoiceHistoryData||[]).filter(inv=>{
    const matchesSearch=!q || String(inv.invoice_number||'').toLowerCase().includes(q) || String(inv.client_name||'').toLowerCase().includes(q);
    return matchesSearch && (filter==='all'||inv.status===filter);
  });
  if(!rows.length){ list.innerHTML='<div class="ni-history-empty">No invoices match your filter.</div>'; return; }
  list.innerHTML=rows.map(inv=>{
    const paid=Number(inv.amount_paid)||0, balance=NI.niBalance(inv.total,paid), status=inv.status;
    const due=inv.due_date?`Due ${NI.niEscape(inv.due_date)}`:'No due date';
    return `<div class="ni-history-item">
      <div class="ni-history-main"><strong>${NI.niEscape(inv.invoice_number||'Untitled invoice')}</strong><span>${NI.niEscape(inv.client_name||'No client')} • ${NI.niEscape(inv.invoice_date||'No date')}</span></div>
      <div class="ni-history-status"><span class="ni-status ni-status-${status}">${status==='partial'?'Partially Paid':status.charAt(0).toUpperCase()+status.slice(1)}</span><small>${due}</small></div>
      <div class="ni-history-total"><strong>${NI.niEscape(inv.currency||'Ghc')} ${NI.niMoney(inv.total)}</strong><small>Paid ${NI.niMoney(paid)} • Balance ${NI.niMoney(balance)}</small></div>
      <div class="ni-history-actions"><button class="ni-history-action primary" data-open-invoice="${inv.id}">Open</button><button class="ni-history-action" data-record-payment="${inv.id}">Payment</button><button class="ni-history-action" data-receipt-invoice="${inv.id}">Receipt</button>${status==='overdue'?`<button class="ni-history-action" data-reminder-invoice="${inv.id}">Reminder</button>`:''}<button class="ni-history-action danger" data-delete-invoice="${inv.id}">Delete</button></div>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-open-invoice]').forEach(btn=>btn.onclick=()=>NI.niOpenSavedInvoice(btn.dataset.openInvoice));
  list.querySelectorAll('[data-delete-invoice]').forEach(btn=>btn.onclick=()=>NI.niDeleteInvoice(btn.dataset.deleteInvoice));
  list.querySelectorAll('[data-record-payment]').forEach(btn=>btn.onclick=()=>NI.niOpenPaymentModal(btn.dataset.recordPayment));
  list.querySelectorAll('[data-receipt-invoice]').forEach(btn=>btn.onclick=()=>NI.niShowReceiptForInvoice(btn.dataset.receiptInvoice));
  list.querySelectorAll('[data-reminder-invoice]').forEach(btn=>btn.onclick=()=>NI.niSendOverdueReminder(btn.dataset.reminderInvoice));
}

async function niOpenSavedInvoice(id){
  const {data,error}=await NI.state.niSupabase.from('invoices').select('*').eq('id',id).eq('user_id',NI.state.niSession.id).single();
  if(error){alert(error.message);return;}
  NI.state.niEditingInvoiceId=data.id; NI.state.niCurrentInvoice=data;
  NI.state.items=Array.isArray(data.NI.state.items)?data.NI.state.items.map(x=>({qty:x.qty||'',desc:x.desc||'',rate:x.rate??''})):[];
  if(!NI.state.items.length)NI.state.items=[{qty:'',desc:'',rate:''}];
  const set=(id,val)=>{const el=NI.$(id);if(el)el.value=val??'';};
  NI.niApplySignatureToEditor(data.signature_url||NI.state.niProfile?.signature_url||'');set('invoiceCustomer',data.customer_id||'');set('clientName',data.client_name);set('clientAddress',data.client_address);set('clientNumber',data.client_number);set('invDate',data.invoice_date);set('invNumber',data.invoice_number);set('currency',data.currency||'Ghc');set('invDueDate',data.due_date);set('invAmountPaid',data.amount_paid??0);set('invPaymentDate',data.payment_date);set('invPaymentMethod',data.payment_method);set('invPaymentStatus',NI.niNormalStatus(data.status));set('invDiscountType',data.discount_type||'none');set('invDiscountValue',data.discount_value??0);set('invTaxRate',data.tax_rate??0);
  NI.niOpenEditor(); NI.renderItemRows(); NI.renderPreview(); NI.niUpdatePaymentPreview();
}

async function niDeleteInvoice(id){
  if(!confirm('Delete this saved invoice from your history?'))return;
  const {error}=await NI.state.niSupabase.from('invoices').delete().eq('id',id).eq('user_id',NI.state.niSession.id);
  if(error){alert(error.message);return;}
  if(NI.state.niEditingInvoiceId===id)NI.state.niEditingInvoiceId=null;
  await NI.niLoadInvoiceHistory();
}

function niNewInvoice(){
  NI.state.niEditingInvoiceId=null; NI.state.niCurrentInvoice=null;
  NI.state.items=Array.from({length:10},()=>({qty:'',desc:'',rate:''}));
  ['invoiceCustomer','clientName','clientAddress','clientNumber','invNumber','invDueDate','invPaymentDate'].forEach(id=>{const el=NI.$(id);if(el)el.value='';});
  NI.$('invDate').value=NI.niToday();
  NI.$('invDueDate').value=NI.niToday();
  NI.$('currency').value='Ghc';
  NI.$('invAmountPaid').value='0';
  NI.$('invPaymentStatus').value='unpaid';
  NI.$('invPaymentMethod').value='';
  NI.$('invDiscountType').value='none';NI.$('invDiscountValue').value='0';NI.$('invTaxRate').value='0';
  NI.renderItemRows(); NI.renderPreview(); NI.niUpdatePaymentPreview();
  NI.niGenerateInvoiceNumber();
}

async function niSaveInvoiceRecord(){
  if(!NI.state.niSupabase||!NI.state.niSession)return null;
  const cleanItems=NI.state.items.filter(x=>x.qty||x.desc||x.rate).map(x=>({qty:x.qty||'',desc:x.desc||'',rate:x.rate||''}));
  const pricing=NI.niPricingSummary(cleanItems);
  const total=pricing.total;
  const amountPaid=Math.min(total,Math.max(0,Number(NI.$('invAmountPaid')?.value)||0));
  const dueDate=NI.$('invDueDate')?.value||null;
  const status=NI.niCalculateStatus(total,amountPaid,dueDate,NI.$('invPaymentStatus')?.value||'unpaid');
  if(NI.$('invPaymentStatus'))NI.$('invPaymentStatus').value=status==='overdue'?'unpaid':status;
  const customerId=await NI.niFindOrCreateCustomer();
  const payload={user_id:NI.state.niSession.id,customer_id:customerId||null,business_name:NI.$('bizName').value.trim(),business_address:NI.$('bizAddress').value.trim(),business_phone:NI.$('bizTel').value.trim(),logo_url:NI.state.niProfile?.logo_url||NI.state.niProfileLogoDataUrl||'',signature_url:NI.state.niProfile?.signature_url||NI.state.niProfileSignatureDataUrl||'',client_name:NI.$('clientName').value.trim(),client_address:NI.$('clientAddress').value.trim(),client_number:NI.$('clientNumber').value.trim(),invoice_date:NI.$('invDate').value||null,due_date:dueDate,invoice_number:NI.$('invNumber').value.trim()||null,currency:NI.$('currency').value.trim()||'Ghc',items:cleanItems,subtotal:pricing.subtotal,discount_type:pricing.discountType,discount_value:pricing.discountValue,discount_amount:pricing.discountAmount,tax_rate:pricing.taxRate,tax_amount:pricing.taxAmount,total,amount_paid:amountPaid,balance_due:NI.niBalance(total,amountPaid),status,payment_date:NI.$('invPaymentDate')?.value||null,payment_method:NI.$('invPaymentMethod')?.value||null,updated_at:new Date().toISOString()};
  let result;
  if(NI.state.niEditingInvoiceId){ result=await NI.state.niSupabase.from('invoices').update(payload).eq('id',NI.state.niEditingInvoiceId).eq('user_id',NI.state.niSession.id).select().single(); }
  else { result=await NI.state.niSupabase.from('invoices').insert(payload).select().single(); }
  if(result.error)throw result.error;
  NI.state.niEditingInvoiceId=result.data.id; NI.state.niCurrentInvoice=result.data; await NI.niLoadInvoiceHistory(); await NI.niLoadAnalytics(); return result.data;
}
function niOpenEditor(){
  NI.niHide('landingScreen');NI.niHide('authScreen');NI.niHide('dashboardScreen');NI.niShow('invoiceApp');NI.niShow('editorBar');document.body.classList.remove('ni-auth-mode');document.body.classList.add('ni-editor-mode');
  // Load the signed-in business profile into the existing invoice form.
  if(NI.state.niProfile){
    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val||'';};
    set('bizName',NI.state.niProfile.business_name);set('bizAddress',NI.state.niProfile.business_address);set('bizTel',NI.state.niProfile.business_phone);if(NI.state.niProfile.logo_url)NI.niApplyLogoToEditor(NI.state.niProfile.logo_url);NI.niApplySignatureToEditor(NI.state.niProfile.signature_url||'');NI.renderPreview();
  }
}

Object.assign(NI, {
  niGenerateInvoiceNumber,
  niLoadInvoiceHistory,
  niRenderInvoiceHistory,
  niOpenSavedInvoice,
  niDeleteInvoice,
  niNewInvoice,
  niSaveInvoiceRecord,
  niOpenEditor
});

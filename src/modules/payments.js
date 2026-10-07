import "../runtime.js";

async function niOpenPaymentModal(invoiceId){
  if(!NI.state.niSupabase||!NI.state.niSession)return;
  const {data,error}=await NI.state.niSupabase.from('invoices').select('*').eq('id',invoiceId).eq('user_id',NI.state.niSession.id).single();
  if(error){alert(error.message);return;}
  NI.state.niCurrentInvoice=data; NI.state.niEditingInvoiceId=data.id;
  NI.$('paymentModal').classList.remove('ni-hidden'); NI.$('paymentModalInvoice').textContent=(data.invoice_number||'Invoice')+' • '+(data.client_name||'');
  NI.$('recordPaymentAmount').value='';NI.$('recordPaymentDate').value=NI.niToday();NI.$('recordPaymentMethod').value=data.payment_method||'Cash';NI.$('recordPaymentReference').value='';NI.$('recordPaymentNotes').value='';
}
function niClosePaymentModal(){ NI.$('paymentModal')?.classList.add('ni-hidden'); }
async function niSavePayment(){
  if(!NI.state.niCurrentInvoice||!NI.state.niSupabase||!NI.state.niSession)return;
  const amount=Number(NI.$('recordPaymentAmount').value)||0; const remaining=NI.niBalance(NI.state.niCurrentInvoice.total,NI.state.niCurrentInvoice.amount_paid);
  if(amount<=0){alert('Enter a payment amount greater than zero.');return;} if(amount>remaining+0.0001){alert('Payment cannot be greater than the remaining balance.');return;}
  const payload={user_id:NI.state.niSession.id,invoice_id:NI.state.niCurrentInvoice.id,amount,payment_date:NI.$('recordPaymentDate').value||NI.niToday(),payment_method:NI.$('recordPaymentMethod').value||null,reference:NI.$('recordPaymentReference').value.trim()||null,notes:NI.$('recordPaymentNotes').value.trim()||null};
  const {error}=await NI.state.niSupabase.from('invoice_payments').insert(payload); if(error){alert(error.message);return;}
  const newPaid=(Number(NI.state.niCurrentInvoice.amount_paid)||0)+amount; const status=NI.niPaymentStatusFromAmount(NI.state.niCurrentInvoice.total,newPaid,NI.state.niCurrentInvoice.due_date);
  const {error:updateError}=await NI.state.niSupabase.from('invoices').update({amount_paid:newPaid,balance_due:NI.niBalance(NI.state.niCurrentInvoice.total,newPaid),status,payment_date:payload.payment_date,payment_method:payload.payment_method,updated_at:new Date().toISOString()}).eq('id',NI.state.niCurrentInvoice.id).eq('user_id',NI.state.niSession.id);
  if(updateError){alert(updateError.message);return;}
  NI.niClosePaymentModal(); await NI.niLoadInvoiceHistory(); await NI.niLoadAnalytics(); alert('Payment recorded successfully.');
}

function niReceiptMarkup(inv,payment=null){
  const cur=inv.currency||'Ghc'; const paid=Number(payment?.amount||0); const total=Number(inv.total)||0;
  return `<div class="ni-receipt" id="receiptSheet"><div class="ni-receipt-brand"><strong>${NI.niEscape(inv.business_name||NI.state.niProfile?.business_name||'Nabeng Invoice')}</strong><span>PAYMENT RECEIPT</span></div><div class="ni-receipt-meta"><div><small>Receipt for</small><strong>${NI.niEscape(inv.client_name||'Customer')}</strong></div><div><small>Invoice</small><strong>${NI.niEscape(inv.invoice_number||'—')}</strong></div><div><small>Payment date</small><strong>${NI.niEscape(payment?.payment_date||inv.payment_date||NI.niToday())}</strong></div></div><div class="ni-receipt-amount"><span>Amount received</span><strong>${NI.niEscape(cur)} ${NI.niMoney(paid || inv.amount_paid)}</strong></div><div class="ni-receipt-lines"><div><span>Invoice total</span><strong>${NI.niEscape(cur)} ${NI.niMoney(total)}</strong></div><div><span>Total paid</span><strong>${NI.niEscape(cur)} ${NI.niMoney(inv.amount_paid)}</strong></div><div><span>Balance remaining</span><strong>${NI.niEscape(cur)} ${NI.niMoney(inv.balance_due??NI.niBalance(total,inv.amount_paid))}</strong></div><div><span>Method</span><strong>${NI.niEscape(payment?.payment_method||inv.payment_method||'—')}</strong></div></div><p class="ni-receipt-note">Thank you for your payment.</p></div>`;
}
async function niShowReceiptForInvoice(invoiceId){
  const {data,error}=await NI.state.niSupabase.from('invoices').select('*').eq('id',invoiceId).eq('user_id',NI.state.niSession.id).single(); if(error){alert(error.message);return;}
  const pay=await NI.state.niSupabase.from('invoice_payments').select('*').eq('invoice_id',invoiceId).eq('user_id',NI.state.niSession.id).order('created_at',{ascending:false}).limit(1); const latest=pay.data?.[0]||null;
  NI.$('receiptContent').innerHTML=NI.niReceiptMarkup(data,latest); NI.$('receiptModal').classList.remove('ni-hidden'); NI.$('downloadReceiptBtn').onclick=()=>NI.niDownloadReceiptPdf(data,latest);
}
async function niDownloadReceiptPdf(inv,payment){
  const sheet=NI.$('receiptSheet'); if(!sheet||!NI.jsPDF||!NI.html2canvas)return alert('PDF tools could not be loaded.');
  const canvas=await NI.html2canvas(sheet,{scale:2.5,useCORS:true,backgroundColor:'#fff'}); const jsPDF=NI.jsPDF; const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a5'}); const w=pdf.internal.pageSize.getWidth()-16; const h=canvas.height*w/canvas.width; pdf.addImage(canvas.toDataURL('image/png'),'PNG',8,8,w,Math.min(h,pdf.internal.pageSize.getHeight()-16)); pdf.save(`${inv.invoice_number||'payment-receipt'}.pdf`);
}
function niCloseReceipt(){ NI.$('receiptModal')?.classList.add('ni-hidden'); }
function niShareWhatsApp(){
  const name=NI.$('clientName')?.value.trim()||'Customer', number=(NI.$('clientNumber')?.value||'').replace(/[^0-9]/g,''), inv=NI.$('invNumber')?.value.trim()||'Invoice', cur=NI.$('currency')?.value||'Ghc'; const pricing=NI.niPricingSummary(NI.state.items||[]); const paid=Number(NI.$('invAmountPaid')?.value)||0; const balance=NI.niBalance(pricing.total,paid); const msg=`Hello ${name},%0A%0AHere are your invoice details from ${encodeURIComponent(NI.$('bizName')?.value.trim()||'our business')}.%0AInvoice: ${encodeURIComponent(inv)}%0ATotal: ${encodeURIComponent(cur)} ${NI.niMoney(pricing.total)}%0APaid: ${encodeURIComponent(cur)} ${NI.niMoney(paid)}%0ABalance: ${encodeURIComponent(cur)} ${NI.niMoney(balance)}%0ADue date: ${encodeURIComponent(NI.$('invDueDate')?.value||'Not specified')}%0A%0AThank you.`; const url=number?`https://wa.me/${number}?text=${msg}`:`https://wa.me/?text=${msg}`; window.open(url,'_blank','noopener');
}

/* =========================================================
   PHASE 4 — RECURRING INVOICES, EXPENSES & REPORTING
========================================================= */

Object.assign(NI, {
  niOpenPaymentModal,
  niClosePaymentModal,
  niSavePayment,
  niReceiptMarkup,
  niShowReceiptForInvoice,
  niDownloadReceiptPdf,
  niCloseReceipt,
  niShareWhatsApp
});

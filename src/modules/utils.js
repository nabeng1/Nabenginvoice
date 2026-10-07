import "../runtime.js";

function niRefreshBrandLogos(){
  document.querySelectorAll('[data-ni-brand-logo]').forEach(img=>{ img.src=NI.config.brandLogo; });
}
function niShow(id){ NI.$(id)?.classList.remove('ni-hidden'); }
function niHide(id){ NI.$(id)?.classList.add('ni-hidden'); }
function niMsg(id,text,type='success'){ const el=NI.$(id); if(!el)return; el.textContent=text; el.className='ni-msg show '+type; }
function niClearMsg(id){ const el=NI.$(id); if(el) el.className='ni-msg'; }
function niInitial(name){ return (name||'N').trim().charAt(0).toUpperCase(); }
function niEscape(value){ const d=document.createElement('div'); d.textContent=String(value??''); return d.innerHTML; }
function niMoney(value){ const n=Number(value)||0; return n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function niInvoiceTotalFromItems(invoiceItems){ return (invoiceItems||[]).reduce((sum,item)=>{ const q=parseFloat(item.qty)||0; const r=parseFloat(item.rate)||0; return sum + q*r; },0); }
function niPricingSummary(invoiceItems){ const subtotal=NI.niInvoiceTotalFromItems(invoiceItems); const type=NI.$('invDiscountType')?.value||'none'; const value=Math.max(0,Number(NI.$('invDiscountValue')?.value)||0); const discount=type==='percent'?Math.min(subtotal,subtotal*value/100):type==='amount'?Math.min(subtotal,value):0; const taxRate=Math.max(0,Number(NI.$('invTaxRate')?.value)||0); const taxable=Math.max(0,subtotal-discount); const tax=taxable*taxRate/100; return {subtotal,discountType:type,discountValue:value,discountAmount:discount,taxRate,taxAmount:tax,total:taxable+tax}; }
function niPaymentStatusFromAmount(total,paid,dueDate){ return NI.niCalculateStatus(total,paid,dueDate,'unpaid'); }
function niToday(){ return new Date().toISOString().slice(0,10); }
function niNormalStatus(status){ return ['unpaid','partial','paid','overdue'].includes(status) ? status : 'unpaid'; }
function niCalculateStatus(total,amountPaid,dueDate,status){
  const paid=Math.max(0,Number(amountPaid)||0);
  const totalNum=Math.max(0,Number(total)||0);
  if(totalNum>0 && paid>=totalNum) return 'paid';
  if(dueDate && dueDate < NI.niToday() && paid < totalNum) return 'overdue';
  if(paid>0) return 'partial';
  return NI.niNormalStatus(status)==='paid' ? 'unpaid' : 'unpaid';
}
function niBalance(total,amountPaid){ return Math.max(0,(Number(total)||0)-(Number(amountPaid)||0)); }
function niUpdatePaymentPreview(){
  const pricing=NI.niPricingSummary(NI.state.items||[]);
  const paid=Math.max(0,Number(NI.$('invAmountPaid')?.value)||0);
  const balance=NI.niBalance(pricing.total,paid);
  const cur=NI.$('currency')?.value||'Ghc';
  const el=NI.$('invBalancePreview'); if(el)el.textContent=cur+' '+NI.niMoney(balance);
  const totalEl=NI.$('invTotalPreview'); if(totalEl)totalEl.textContent=cur+' '+NI.niMoney(pricing.total);
  const status=NI.$('invPaymentStatus');
  if(status){ if(balance<=0 && pricing.total>0)status.value='paid'; else if(paid>0)status.value='partial'; else status.value='unpaid'; }
  const pSub=NI.$('pSubtotal'),pDisc=NI.$('pDiscount'),pTax=NI.$('pTax');
  if(pSub)pSub.textContent=cur+' '+NI.niMoney(pricing.subtotal); if(pDisc)pDisc.textContent=cur+' '+NI.niMoney(pricing.discountAmount); if(pTax)pTax.textContent=cur+' '+NI.niMoney(pricing.taxAmount);
}

Object.assign(NI, {
  niRefreshBrandLogos,
  niShow,
  niHide,
  niMsg,
  niClearMsg,
  niInitial,
  niEscape,
  niMoney,
  niInvoiceTotalFromItems,
  niPricingSummary,
  niPaymentStatusFromAmount,
  niToday,
  niNormalStatus,
  niCalculateStatus,
  niBalance,
  niUpdatePaymentPreview
});

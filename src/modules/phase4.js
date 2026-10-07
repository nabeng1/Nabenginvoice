import "../runtime.js";

function niDateAdd(dateStr,frequency){
  const d=new Date((dateStr||NI.niToday())+'T00:00:00');
  if(frequency==='weekly') d.setDate(d.getDate()+7);
  else if(frequency==='quarterly') d.setMonth(d.getMonth()+3);
  else if(frequency==='yearly') d.setFullYear(d.getFullYear()+1);
  else d.setMonth(d.getMonth()+1);
  return d.toISOString().slice(0,10);
}
function niSetPhase4Panel(id){
  ['recurringPanel','expensesPanel','reportsPanel','customerPanel','profilePanel','analyticsPanel'].forEach(x=>{const el=NI.$(x);if(el&&x!==id)el.classList.add('ni-hidden');});
  const target=NI.$(id);if(target)target.classList.remove('ni-hidden');
}
function niPopulateRecurringCustomerSelect(){
  const el=NI.$('recurringCustomer');if(!el)return;
  const current=el.value;
  el.innerHTML='<option value="">Select customer</option>'+(NI.state.niCustomers||[]).map(c=>`<option value="${NI.niEscape(c.id)}">${NI.niEscape(c.name)}</option>`).join('');
  if(current)el.value=current;
}
async function niLoadRecurring(){
  const list=NI.$('recurringList');if(!list||!NI.state.niSupabase||!NI.state.niSession)return;
  list.innerHTML='<div class="ni-history-empty">Loading schedules...</div>';
  const {data,error}=await NI.state.niSupabase.from('recurring_invoices').select('*').eq('user_id',NI.state.niSession.id).order('next_invoice_date',{ascending:true});
  if(error){list.innerHTML=`<div class="ni-history-empty">Unable to load schedules: ${NI.niEscape(error.message)}</div>`;return;}
  const rows=data||[];
  if(!rows.length){list.innerHTML='<div class="ni-history-empty">No recurring invoice schedules yet.</div>';return;}
  list.innerHTML=rows.map(r=>`<div class="ni-phase4-row"><div><strong>${NI.niEscape(r.name||'Recurring invoice')}</strong><span>${NI.niEscape(r.client_name||'Customer')} • ${NI.niEscape(r.frequency||'monthly')}</span></div><div><small>Next invoice</small><strong>${NI.niEscape(r.next_invoice_date||'—')}</strong></div><div><span class="ni-status ${r.active?'ni-status-paid':'ni-status-unpaid'}">${r.active?'Active':'Paused'}</span></div><div class="ni-customer-actions"><button class="ni-history-action primary" data-generate-recurring="${r.id}">Generate</button><button class="ni-history-action" data-toggle-recurring="${r.id}" data-active="${r.active}">${r.active?'Pause':'Activate'}</button><button class="ni-history-action danger" data-delete-recurring="${r.id}">Delete</button></div></div>`).join('');
  list.querySelectorAll('[data-generate-recurring]').forEach(b=>b.onclick=()=>NI.niGenerateRecurringInvoice(b.dataset.generateRecurring));
  list.querySelectorAll('[data-toggle-recurring]').forEach(b=>b.onclick=()=>NI.niToggleRecurring(b.dataset.toggleRecurring,b.dataset.active==='true'));
  list.querySelectorAll('[data-delete-recurring]').forEach(b=>b.onclick=()=>NI.niDeleteRecurring(b.dataset.deleteRecurring));
}
async function niSaveRecurring(){
  if(!NI.state.niSupabase||!NI.state.niSession)return;
  const name=NI.$('recurringName')?.value.trim();const customerId=NI.$('recurringCustomer')?.value||null;const frequency=NI.$('recurringFrequency')?.value||'monthly';const nextDate=NI.$('recurringNextDate')?.value||NI.niToday();const dueDays=Math.max(0,Number(NI.$('recurringDueDays')?.value)||0);const active=NI.$('recurringActive')?.value!=='false';
  const cleanItems=NI.state.items.filter(x=>x.qty||x.desc||x.rate).map(x=>({qty:x.qty||'',desc:x.desc||'',rate:x.rate||''}));
  if(!name){alert('Enter a schedule name.');return;} if(!NI.$('clientName')?.value.trim()){alert('Enter a customer on the current invoice first.');return;} if(!cleanItems.length){alert('Add at least one invoice item first.');return;}
  const pricing=NI.niPricingSummary(cleanItems);
  const payload={user_id:NI.state.niSession.id,name,customer_id:customerId,client_name:NI.$('clientName').value.trim(),client_address:NI.$('clientAddress').value.trim(),client_number:NI.$('clientNumber').value.trim(),business_name:NI.$('bizName').value.trim(),business_address:NI.$('bizAddress').value.trim(),business_phone:NI.$('bizTel').value.trim(),currency:NI.$('currency').value.trim()||'Ghc',items:cleanItems,subtotal:pricing.subtotal,discount_type:pricing.discountType,discount_value:pricing.discountValue,discount_amount:pricing.discountAmount,tax_rate:pricing.taxRate,tax_amount:pricing.taxAmount,due_days:dueDays,frequency,next_invoice_date:nextDate,active,updated_at:new Date().toISOString()};
  const {error}=await NI.state.niSupabase.from('recurring_invoices').insert(payload);if(error){alert(error.message);return;}
  alert('Recurring invoice schedule saved.');await NI.niLoadRecurring();
}
async function niGenerateRecurringInvoice(id){
  const {data,error}=await NI.state.niSupabase.from('recurring_invoices').select('*').eq('id',id).eq('user_id',NI.state.niSession.id).single();if(error){alert(error.message);return;}
  if(!data.active){alert('This recurring schedule is paused. Activate it first.');return;}
  NI.niNewInvoice();
  NI.$('invoiceCustomer').value=data.customer_id||'';NI.niApplySelectedCustomer();
  NI.$('clientName').value=data.client_name||NI.$('clientName').value;NI.$('clientAddress').value=data.client_address||NI.$('clientAddress').value;NI.$('clientNumber').value=data.client_number||NI.$('clientNumber').value;NI.$('bizName').value=data.business_name||NI.$('bizName').value;NI.$('bizAddress').value=data.business_address||NI.$('bizAddress').value;NI.$('bizTel').value=data.business_phone||NI.$('bizTel').value;NI.$('currency').value=data.currency||'Ghc';
  NI.state.items=(data.NI.state.items||[]).map(x=>({qty:x.qty||'',desc:x.desc||'',rate:x.rate??''}));if(!NI.state.items.length)NI.state.items=[{qty:'',desc:'',rate:''}];
  NI.$('invDiscountType').value=data.discount_type||'none';NI.$('invDiscountValue').value=data.discount_value??0;NI.$('invTaxRate').value=data.tax_rate??0;NI.$('invDueDate').value=(()=>{const d=new Date(NI.niToday()+'T00:00:00');d.setDate(d.getDate()+Math.max(0,Number(data.due_days)||0));return d.toISOString().slice(0,10);})();
  NI.renderItemRows();NI.renderPreview();NI.niUpdatePaymentPreview();NI.niOpenEditor();
  await NI.state.niSupabase.from('recurring_invoices').update({next_invoice_date:NI.niDateAdd(data.next_invoice_date||NI.niToday(),data.frequency),updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',NI.state.niSession.id);
  await NI.niLoadRecurring();
}
async function niToggleRecurring(id,current){const {error}=await NI.state.niSupabase.from('recurring_invoices').update({active:!current,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',NI.state.niSession.id);if(error){alert(error.message);return;}await NI.niLoadRecurring();}
async function niDeleteRecurring(id){if(!confirm('Delete this recurring invoice schedule?'))return;const {error}=await NI.state.niSupabase.from('recurring_invoices').delete().eq('id',id).eq('user_id',NI.state.niSession.id);if(error){alert(error.message);return;}await NI.niLoadRecurring();}
async function niLoadExpenses(){
  const list=NI.$('expenseList');if(!list||!NI.state.niSupabase||!NI.state.niSession)return;list.innerHTML='<div class="ni-history-empty">Loading expenses...</div>';
  const {data,error}=await NI.state.niSupabase.from('expenses').select('*').eq('user_id',NI.state.niSession.id).order('expense_date',{ascending:false}).limit(200);
  if(error){list.innerHTML=`<div class="ni-history-empty">Unable to load expenses: ${NI.niEscape(error.message)}</div>`;return;}
  const rows=data||[];if(!rows.length){list.innerHTML='<div class="ni-history-empty">No expenses recorded yet.</div>';return;}
  const cur=rows[0]?.currency||'Ghc';list.innerHTML=rows.map(r=>`<div class="ni-phase4-row"><div><strong>${NI.niEscape(r.description)}</strong><span>${NI.niEscape(r.category||'Other')} • ${NI.niEscape(r.expense_date||'—')}</span></div><div><strong>${NI.niEscape(r.currency||cur)} ${NI.niMoney(r.amount)}</strong></div><div class="ni-customer-actions"><button class="ni-history-action" data-edit-expense="${r.id}">Edit</button><button class="ni-history-action danger" data-delete-expense="${r.id}">Delete</button></div></div>`).join('');
  list.querySelectorAll('[data-edit-expense]').forEach(b=>b.onclick=()=>NI.niEditExpense(b.dataset.editExpense));list.querySelectorAll('[data-delete-expense]').forEach(b=>b.onclick=()=>NI.niDeleteExpense(b.dataset.deleteExpense));
}
async function niSaveExpense(){
  if(!NI.state.niSupabase||!NI.state.niSession)return;const description=NI.$('expenseDescription')?.value.trim();const amount=Number(NI.$('expenseAmount')?.value)||0;if(!description||amount<=0){alert('Enter an expense description and a valid amount.');return;}
  const payload={user_id:NI.state.niSession.id,description,category:NI.$('expenseCategory')?.value||'Other',amount,expense_date:NI.$('expenseDate')?.value||NI.niToday(),currency:NI.$('currency')?.value||'Ghc',notes:NI.$('expenseNotes')?.value.trim()||null,updated_at:new Date().toISOString()};const id=NI.$('expenseEditId')?.value||'';
  const result=id?await NI.state.niSupabase.from('expenses').update(payload).eq('id',id).eq('user_id',NI.state.niSession.id):await NI.state.niSupabase.from('expenses').insert(payload);if(result.error){alert(result.error.message);return;}NI.niClearExpenseForm();await NI.niLoadExpenses();await NI.niLoadAnalytics();
}
async function niEditExpense(id){const {data,error}=await NI.state.niSupabase.from('expenses').select('*').eq('id',id).eq('user_id',NI.state.niSession.id).single();if(error){alert(error.message);return;}NI.$('expenseEditId').value=data.id;NI.$('expenseDescription').value=data.description||'';NI.$('expenseCategory').value=data.category||'Other';NI.$('expenseAmount').value=data.amount||'';NI.$('expenseDate').value=data.expense_date||NI.niToday();NI.$('expenseNotes').value=data.notes||'';}
function niClearExpenseForm(){NI.$('expenseEditId').value='';NI.$('expenseDescription').value='';NI.$('expenseAmount').value='';NI.$('expenseDate').value=NI.niToday();NI.$('expenseNotes').value='';}
async function niDeleteExpense(id){if(!confirm('Delete this expense?'))return;const {error}=await NI.state.niSupabase.from('expenses').delete().eq('id',id).eq('user_id',NI.state.niSession.id);if(error){alert(error.message);return;}await NI.niLoadExpenses();await NI.niLoadAnalytics();}
async function niRunReport(){
  if(!NI.state.niSupabase||!NI.state.niSession)return;const from=NI.$('reportFrom')?.value||'0000-01-01';const to=NI.$('reportTo')?.value||'9999-12-31';
  const [invRes,expRes,payRes]=await Promise.all([NI.state.niSupabase.from('invoices').select('id,total,amount_paid,invoice_date,currency,status').eq('user_id',NI.state.niSession.id).gte('invoice_date',from).lte('invoice_date',to),NI.state.niSupabase.from('expenses').select('amount,expense_date,currency,category').eq('user_id',NI.state.niSession.id).gte('expense_date',from).lte('expense_date',to),NI.state.niSupabase.from('invoice_payments').select('id,amount,payment_date').eq('user_id',NI.state.niSession.id).gte('payment_date',from).lte('payment_date',to)]);
  if(invRes.error){alert(invRes.error.message);return;}if(expRes.error){alert(expRes.error.message);return;}if(payRes.error){alert(payRes.error.message);return;}
  const inv=invRes.data||[],exp=expRes.data||[],pay=payRes.data||[];const cur=inv[0]?.currency||exp[0]?.currency||'Ghc';const revenue=inv.reduce((s,x)=>s+(Number(x.total)||0),0);const collected=pay.length?pay.reduce((s,x)=>s+(Number(x.amount)||0),0):inv.reduce((s,x)=>s+Math.min(Number(x.total)||0,Number(x.amount_paid)||0),0);const expenses=exp.reduce((s,x)=>s+(Number(x.amount)||0),0);const profit=collected-expenses;
  NI.$('reportRevenue').textContent=cur+' '+NI.niMoney(revenue);NI.$('reportCollected').textContent=cur+' '+NI.niMoney(collected);NI.$('reportExpenses').textContent=cur+' '+NI.niMoney(expenses);NI.$('reportProfit').textContent=cur+' '+NI.niMoney(profit);NI.$('reportInvoiceCount').textContent=inv.length;NI.$('reportPaymentCount').textContent=pay.length;
  const cats={};exp.forEach(x=>cats[x.category||'Other']=(cats[x.category||'Other']||0)+(Number(x.amount)||0));const breakdown=NI.$('reportBreakdown');breakdown.innerHTML=Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div><span>${NI.niEscape(k)}</span><strong>${NI.niEscape(cur)} ${NI.niMoney(v)}</strong></div>`).join('')||'<p>No expense breakdown for this period.</p>';
}
function niOpenReports(){NI.niSetPhase4Panel('reportsPanel');NI.$('reportFrom').value=NI.$('reportFrom').value||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10);NI.$('reportTo').value=NI.$('reportTo').value||NI.niToday();NI.niRunReport();}
function niOpenRecurring(){NI.niSetPhase4Panel('recurringPanel');NI.niPopulateRecurringCustomerSelect();NI.$('recurringNextDate').value=NI.$('recurringNextDate').value||NI.niToday();NI.niLoadRecurring();}
function niOpenExpenses(){NI.niSetPhase4Panel('expensesPanel');if(!NI.$('expenseDate').value)NI.$('expenseDate').value=NI.niToday();NI.niLoadExpenses();}
async function niSendOverdueReminder(id){const {data,error}=await NI.state.niSupabase.from('invoices').select('*').eq('id',id).eq('user_id',NI.state.niSession.id).single();if(error){alert(error.message);return;}const number=(data.client_number||'').replace(/[^0-9]/g,'');const cur=data.currency||'Ghc';const msg=`Hello ${data.client_name||'Customer'},%0A%0AThis is a friendly payment reminder for invoice ${data.invoice_number||''}.%0AOutstanding balance: ${encodeURIComponent(cur)} ${NI.niMoney(data.balance_due??NI.niBalance(data.total,data.amount_paid))}%0ADue date: ${encodeURIComponent(data.due_date||'')}.%0A%0AThank you.`;window.open(number?`https://wa.me/${number}?text=${msg}`:`https://wa.me/?text=${msg}`,'_blank','noopener');}

Object.assign(NI, {
  niDateAdd,
  niSetPhase4Panel,
  niPopulateRecurringCustomerSelect,
  niLoadRecurring,
  niSaveRecurring,
  niGenerateRecurringInvoice,
  niToggleRecurring,
  niDeleteRecurring,
  niLoadExpenses,
  niSaveExpense,
  niEditExpense,
  niClearExpenseForm,
  niDeleteExpense,
  niRunReport,
  niOpenReports,
  niOpenRecurring,
  niOpenExpenses,
  niSendOverdueReminder
});

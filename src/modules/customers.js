import "../runtime.js";

async function niLoadCustomers(){
  const list=NI.$('customerList'); if(!list||!NI.state.niSupabase||!NI.state.niSession)return;
  list.innerHTML='<div class="ni-history-empty">Loading customers...</div>';
  const {data,error}=await NI.state.niSupabase.from('customers').select('*').eq('user_id',NI.state.niSession.id).order('name',{ascending:true});
  if(error){console.error(error);list.innerHTML=`<div class="ni-history-empty">Unable to load customers: ${NI.niEscape(error.message)}</div>`;return;}
  NI.state.niCustomers=data||[];
  const invoiceStats=await NI.state.niSupabase.from('invoices').select('customer_id,total,amount_paid').eq('user_id',NI.state.niSession.id).not('customer_id','is',null);
  NI.state.niCustomerStats={};
  (invoiceStats.data||[]).forEach(inv=>{const id=String(inv.customer_id);if(!NI.state.niCustomerStats[id])NI.state.niCustomerStats[id]={count:0,balance:0};NI.state.niCustomerStats[id].count++;NI.state.niCustomerStats[id].balance+=NI.niBalance(inv.total,inv.amount_paid);});
  NI.niPopulateCustomerSelect();
  NI.niRenderCustomers();
}

function niPopulateCustomerSelect(selectedId=''){
  const select=NI.$('invoiceCustomer'); if(!select)return;
  select.innerHTML='<option value="">Select a saved customer or enter details below</option>'+NI.state.niCustomers.map(c=>`<option value="${NI.niEscape(c.id)}">${NI.niEscape(c.name)}${c.phone?' • '+NI.niEscape(c.phone):''}</option>`).join('');
  if(selectedId)select.value=selectedId;
}

function niApplySelectedCustomer(){
  const id=NI.$('invoiceCustomer')?.value; if(!id)return;
  const c=NI.state.niCustomers.find(x=>String(x.id)===String(id)); if(!c)return;
  NI.$('clientName').value=c.name||'';NI.$('clientAddress').value=c.address||'';NI.$('clientNumber').value=c.phone||'';
  if(NI.$('clientName'))NI.$('clientName').dispatchEvent(new Event('input',{bubbles:true}));
  if(NI.$('clientAddress'))NI.$('clientAddress').dispatchEvent(new Event('input',{bubbles:true}));
  if(NI.$('clientNumber'))NI.$('clientNumber').dispatchEvent(new Event('input',{bubbles:true}));
}

function niRenderCustomers(){
  const list=NI.$('customerList');if(!list)return;
  const q=(NI.$('customerSearch')?.value||'').trim().toLowerCase();
  const rows=NI.state.niCustomers.filter(c=>!q||[c.name,c.phone,c.email,c.address].some(v=>String(v||'').toLowerCase().includes(q)));
  if(!rows.length){list.innerHTML='<div class="ni-history-empty">No customers found.</div>';return;}
  list.innerHTML=rows.map(c=>`<div class="ni-customer-row"><div><strong>${NI.niEscape(c.name)}</strong><span>${NI.niEscape(c.phone||'No phone')} ${c.email?'• '+NI.niEscape(c.email):''}</span><small>${NI.niEscape(c.address||'No address')}</small><small>${NI.state.niCustomerStats[String(c.id)]?.count||0} invoice(s) • Outstanding ${NI.niMoney(NI.state.niCustomerStats[String(c.id)]?.balance||0)}</small></div><div class="ni-customer-actions"><button class="ni-history-action primary" data-edit-customer="${c.id}">Edit</button><button class="ni-history-action danger" data-delete-customer="${c.id}">Delete</button></div></div>`).join('');
  list.querySelectorAll('[data-edit-customer]').forEach(b=>b.onclick=()=>NI.niEditCustomer(b.dataset.editCustomer));
  list.querySelectorAll('[data-delete-customer]').forEach(b=>b.onclick=()=>NI.niDeleteCustomer(b.dataset.deleteCustomer));
}

function niEditCustomer(id){
  const c=NI.state.niCustomers.find(x=>String(x.id)===String(id));if(!c)return;
  NI.state.niEditingCustomerId=c.id;NI.$('customerEditId').value=c.id;NI.$('customerName').value=c.name||'';NI.$('customerPhone').value=c.phone||'';NI.$('customerEmail').value=c.email||'';NI.$('customerAddress').value=c.address||'';NI.$('customerNotes').value=c.notes||'';
  NI.$('saveCustomerBtn').textContent='Update Customer';NI.$('customerName').focus();
}

function niClearCustomerForm(){
  NI.state.niEditingCustomerId=null;['customerEditId','customerName','customerPhone','customerEmail','customerAddress','customerNotes'].forEach(id=>{const e=NI.$(id);if(e)e.value='';});
  NI.$('saveCustomerBtn').textContent='Save Customer';
}

async function niSaveCustomer(){
  if(!NI.state.niSupabase||!NI.state.niSession)return;
  const name=NI.$('customerName').value.trim();if(!name){alert('Please enter the customer name.');return;}
  const payload={user_id:NI.state.niSession.id,name,phone:NI.$('customerPhone').value.trim(),email:NI.$('customerEmail').value.trim(),address:NI.$('customerAddress').value.trim(),notes:NI.$('customerNotes').value.trim(),updated_at:new Date().toISOString()};
  const result=NI.state.niEditingCustomerId?await NI.state.niSupabase.from('customers').update(payload).eq('id',NI.state.niEditingCustomerId).eq('user_id',NI.state.niSession.id).select().single():await NI.state.niSupabase.from('customers').insert(payload).select().single();
  if(result.error){alert(result.error.message);return;}
  NI.niClearCustomerForm();await NI.niLoadCustomers();NI.$('invoiceCustomer').value=result.data.id;NI.niApplySelectedCustomer();
}

async function niDeleteCustomer(id){
  const c=NI.state.niCustomers.find(x=>String(x.id)===String(id));if(!c)return;
  if(!confirm(`Delete ${c.name} from your customer list? Existing invoices will remain.`))return;
  const {error}=await NI.state.niSupabase.from('customers').delete().eq('id',id).eq('user_id',NI.state.niSession.id);
  if(error){alert(error.message);return;}
  if(String(NI.$('invoiceCustomer')?.value)===String(id)){NI.$('invoiceCustomer').value='';}
  await NI.niLoadCustomers();
}

async function niFindOrCreateCustomer(){
  if(!NI.state.niSupabase||!NI.state.niSession)return null;
  const selected=NI.$('invoiceCustomer')?.value||'';
  if(selected)return selected;
  const name=NI.$('clientName')?.value.trim()||'';if(!name)return null;
  const phone=NI.$('clientNumber')?.value.trim()||'';
  const existing=NI.state.niCustomers.find(c=>c.name.trim().toLowerCase()===name.toLowerCase() && (!phone||String(c.phone||'').trim()===phone));
  if(existing){NI.$('invoiceCustomer').value=existing.id;return existing.id;}
  const payload={user_id:NI.state.niSession.id,name,phone,address:NI.$('clientAddress')?.value.trim()||'',email:'',notes:'',updated_at:new Date().toISOString()};
  const {data,error}=await NI.state.niSupabase.from('customers').insert(payload).select().single();
  if(error)throw error;
  NI.state.niCustomers.push(data);NI.niPopulateCustomerSelect(data.id);return data.id;
}

Object.assign(NI, {
  niLoadCustomers,
  niPopulateCustomerSelect,
  niApplySelectedCustomer,
  niRenderCustomers,
  niEditCustomer,
  niClearCustomerForm,
  niSaveCustomer,
  niDeleteCustomer,
  niFindOrCreateCustomer
});

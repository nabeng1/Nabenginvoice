import "../runtime.js";

function niWire(){
  const onClick=(id,fn)=>{const el=NI.$(id);if(el)el.onclick=fn;};
  const onInput=(id,fn)=>{const el=NI.$(id);if(el)el.addEventListener('input',fn);};
  const onChange=(id,fn)=>{const el=NI.$(id);if(el)el.addEventListener('change',fn);};
  const onSubmit=(id,fn)=>{const el=NI.$(id);if(el)el.addEventListener('submit',fn);};

  onClick('landingSignIn',()=>NI.niOpenAuth('signin'));
  onClick('landingSignUp',()=>NI.niOpenAuth('signup'));
  onClick('heroGetStarted',()=>NI.niOpenAuth('signup'));
  onClick('heroSignIn',()=>NI.niOpenAuth('signin'));
  onClick('tabSignIn',()=>NI.niOpenAuth('signin'));
  onClick('tabSignUp',()=>NI.niOpenAuth('signup'));
  onClick('backToLanding',NI.niOpenLanding);
  onSubmit('authForm',NI.niAuthSubmit);

  onClick('dashLogout',NI.niSignOut);
  onClick('customersBtn',()=>{
    NI.niSetPhase4Panel('customerPanel');
    NI.niLoadCustomers();
  });
  onClick('refreshCustomersBtn',NI.niLoadCustomers);
  onClick('saveCustomerBtn',NI.niSaveCustomer);
  onClick('cancelCustomerBtn',NI.niClearCustomerForm);
  onInput('customerSearch',NI.niRenderCustomers);
  onChange('invoiceCustomer',NI.niApplySelectedCustomer);
  onInput('invoiceHistorySearch',NI.niRenderInvoiceHistory);
  onChange('invoiceHistoryStatus',NI.niRenderInvoiceHistory);

  onClick('editorSignOut',NI.niSignOut);
  onClick('newInvoiceBtn',()=>{NI.niNewInvoice();NI.niOpenEditor();});
  onClick('dashboardInvoiceBtn',()=>{NI.niNewInvoice();NI.niOpenEditor();});
  onClick('backDashboardBtn',()=>{NI.niLoadInvoiceHistory();NI.niOpenDashboard();});
  onClick('refreshInvoicesBtn',NI.niLoadInvoiceHistory);

  onClick('editProfileBtn',()=>{
    NI.niSetPhase4Panel('profilePanel');
  });
  onClick('analyticsBtn',()=>{
    NI.niSetPhase4Panel('analyticsPanel');
    NI.niLoadAnalytics();
  });
  onClick('refreshAnalyticsBtn',NI.niLoadAnalytics);
  onClick('recurringBtn',NI.niOpenRecurring);
  onClick('refreshRecurringBtn',NI.niLoadRecurring);
  onClick('saveRecurringBtn',NI.niSaveRecurring);
  onClick('clearRecurringBtn',()=>{if(NI.$('recurringName'))NI.$('recurringName').value='';if(NI.$('recurringNextDate'))NI.$('recurringNextDate').value=NI.niToday();});
  onClick('expensesBtn',NI.niOpenExpenses);
  onClick('refreshExpensesBtn',NI.niLoadExpenses);
  onClick('saveExpenseBtn',NI.niSaveExpense);
  onClick('clearExpenseBtn',NI.niClearExpenseForm);
  onClick('reportsBtn',NI.niOpenReports);
  onClick('refreshReportsBtn',NI.niRunReport);
  onClick('runReportBtn',NI.niRunReport);
  onClick('closePaymentModal',NI.niClosePaymentModal);
  onClick('cancelPaymentBtn',NI.niClosePaymentModal);
  onClick('savePaymentBtn',NI.niSavePayment);
  onClick('closeReceiptModal',NI.niCloseReceipt);
  onClick('closeReceiptBtn',NI.niCloseReceipt);
  onClick('whatsappBtn',NI.niShareWhatsApp);
  onClick('receiptBtn',async()=>{
    if(!NI.state.niEditingInvoiceId){alert('Save the invoice first.');return;}
    await NI.niShowReceiptForInvoice(NI.state.niEditingInvoiceId);
  });

  onClick('saveProfileBtn',NI.niSaveProfile);

  const logoInput=NI.$('profileLogoInput');
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
    NI.state.niProfileLogoFile=file;
    NI.state.niRemoveLogo=false;
    const reader=new FileReader();
    reader.onload=()=>{
      NI.state.niProfileLogoDataUrl=reader.result;
      NI.niSetLogoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  });

  const profileSignatureInput=NI.$('profileSignatureInput');
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
    NI.state.niProfileSignatureFile=file;
    NI.state.niRemoveSignature=false;
    const reader=new FileReader();
    reader.onload=()=>{
      NI.state.niProfileSignatureDataUrl=reader.result;
      NI.niSetSignaturePreview(reader.result);
      NI.niApplySignatureToEditor(reader.result);
    };
    reader.readAsDataURL(file);
  });

  onClick('removeLogoBtn',()=>{
    NI.state.niProfileLogoFile=null;
    NI.state.niProfileLogoDataUrl='';
    NI.state.niRemoveLogo=true;
    NI.niSetLogoPreview('');
  });
  onClick('removeSignatureBtn',()=>{
    NI.state.niProfileSignatureFile=null;
    NI.state.niProfileSignatureDataUrl='';
    NI.state.niRemoveSignature=true;
    NI.niSetSignaturePreview('');
    NI.niApplySignatureToEditor('');
  });
}

Object.assign(NI, {
  niWire
});

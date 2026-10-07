import "../runtime.js";

  // Start with 10 blank rows, like the paper template
  NI.state.items = NI.state.items || Array.from({length: 10}, () => ({ qty: '', desc: '', rate: '' }));

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
    NI.state.items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div>
          ${idx === 0 ? '<label>Qty</label>' : ''}
          <input type="text" class="i-qty" value="${NI.escapeAttr(item.qty)}">
        </div>
        <div>
          ${idx === 0 ? '<label>Description</label>' : ''}
          <input type="text" class="i-desc" value="${NI.escapeAttr(item.desc)}" placeholder="Item description">
        </div>
        <div>
          ${idx === 0 ? '<label>Unit cost</label>' : ''}
          <input type="number" class="i-rate" value="${item.rate}" min="0" step="0.01">
        </div>
        <div>
          ${idx === 0 ? '<label>&nbsp;</label>' : ''}
          <button type="button" class="remove-item" ${NI.state.items.length <= 1 ? 'disabled' : ''} title="Remove row">&times;</button>
        </div>
      `;
      row.querySelector('.i-qty').addEventListener('input', e => { item.qty = e.target.value; NI.renderPreview(); });
      row.querySelector('.i-desc').addEventListener('input', e => { item.desc = e.target.value; NI.renderPreview(); });
      row.querySelector('.i-rate').addEventListener('input', e => { item.rate = e.target.value; NI.renderPreview(); });
      row.querySelector('.remove-item').addEventListener('click', () => {
        NI.state.items.splice(idx, 1);
        NI.renderItemRows();
        NI.renderPreview();
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
    document.getElementById('pInvDate').textContent = NI.formatDate(document.getElementById('invDate').value) || '\u00A0';
    document.getElementById('pInvNumber').textContent = document.getElementById('invNumber').value || '\u00A0';
    const dueDate=document.getElementById('invDueDate')?.value || '';
    const pricingPreview=NI.niPricingSummary(NI.state.items||[]);
    const paidPreview=Math.min(pricingPreview.total,Math.max(0,Number(document.getElementById('invAmountPaid')?.value)||0));
    document.getElementById('pInvDueDate').textContent = NI.formatDate(dueDate) || '\u00A0';
    document.getElementById('pInvBalance').textContent = (document.getElementById('currency').value || 'Ghc')+' '+NI.niMoney(NI.niBalance(pricingPreview.total,paidPreview));

    const cur = document.getElementById('currency').value || '';
    document.getElementById('pRateHeader').innerHTML = 'Unit Cost<br>' + NI.escapeHtml(cur);
    document.getElementById('pAmountHeader').innerHTML = 'Sub Total<br>' + NI.escapeHtml(cur);

    const body = document.getElementById('pItemsBody');
    body.innerHTML = '';
    let total = 0;
    NI.state.items.forEach(item => {
      const qtyNum = parseFloat(item.qty) || 0;
      const rateNum = parseFloat(item.rate) || 0;
      const hasContent = item.qty || item.desc || item.rate;
      const amount = qtyNum * rateNum;
      if (hasContent) total += amount;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="qty-cell">${item.qty ? NI.escapeHtml(item.qty) : '&nbsp;'}</td>
        <td class="desc-cell">${item.desc ? NI.escapeHtml(item.desc) : '&nbsp;'}</td>
        <td class="num">${item.rate ? NI.fmt(rateNum) : '&nbsp;'}</td>
        <td class="num">${hasContent ? NI.fmt(amount) : '&nbsp;'}</td>
      `;
      body.appendChild(tr);
    });

    const pricing=NI.niPricingSummary(NI.state.items||[]);
    document.getElementById('pTotal').textContent = NI.fmt(pricing.total);
    if(NI.$('pSubtotal'))NI.$('pSubtotal').textContent=(document.getElementById('currency').value||'Ghc')+' '+NI.niMoney(pricing.subtotal);
    if(NI.$('pDiscount'))NI.$('pDiscount').textContent=(document.getElementById('currency').value||'Ghc')+' '+NI.niMoney(pricing.discountAmount);
    if(NI.$('pTax'))NI.$('pTax').textContent=(document.getElementById('currency').value||'Ghc')+' '+NI.niMoney(pricing.taxAmount);
  }

  addItemBtn.addEventListener('click', () => {
    NI.state.items.push({ qty: '', desc: '', rate: '' });
    NI.renderItemRows();
    NI.renderPreview();
  });

  printBtn.addEventListener('click', async () => {
    const button = printBtn;
    const sheet = document.getElementById('sheet');

    if (!sheet || !NI.html2canvas || !NI.jsPDF) {
      alert('PDF tools could not be loaded. Please check your internet connection and try again.');
      return;
    }

    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = 'Creating PDF...';

    try {
      if(NI.state.niSupabase && NI.state.niSession && !NI.$('invNumber').value.trim()){
        await NI.niGenerateInvoiceNumber();
        NI.renderPreview();
      }
      // Capture the invoice exactly as it is rendered in the preview.
      const canvas = await NI.html2canvas(sheet, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const jsPDF = NI.jsPDF;
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
      if(NI.state.niSupabase && NI.state.niSession){
        try{ await NI.niSaveInvoiceRecord(); }catch(saveError){ console.error('Invoice history save failed:',saveError); alert('PDF downloaded, but the invoice could not be saved to invoice history: '+(saveError.message||'Unknown error')); }
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
      NI.state.niProfileLogoFile=file;
      NI.state.niProfileLogoDataUrl=reader.result;
      NI.niApplyLogoToEditor(reader.result);
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
      if(el)el.addEventListener('input',()=>{ NI.renderPreview(); NI.niUpdatePaymentPreview(); });
    });
  ['invAmountPaid','invPaymentStatus','invPaymentMethod','invDiscountType','invDiscountValue','invTaxRate'].forEach(id=>{ const el=document.getElementById(id); if(el)el.addEventListener('input',NI.niUpdatePaymentPreview); if(el)el.addEventListener('change',NI.niUpdatePaymentPreview); });

  document.getElementById('invDate').value = NI.niToday();
  document.getElementById('invDueDate').value = NI.niToday();

  NI.renderItemRows();
  NI.renderPreview();


NI.niWire();

import "../runtime.js";

function niSetLogoPreview(src){ const box=NI.$('profileLogoPreview'); if(!box)return; box.innerHTML=src?`<img src="${src}" alt="Business logo">`:'<span>LOGO</span>'; }
function niSetSignaturePreview(src){ const box=NI.$('profileSignaturePreview'); if(!box)return; box.innerHTML=src?`<img src="${src}" alt="Digital signature">`:'<span>No signature</span>'; }
function niApplySignatureToEditor(src){ const img=NI.$('pSignature'); const row=NI.$('digitalSignatureRow'); if(!img||!row)return; if(src){ img.src=src; row.style.display='flex'; } else { img.removeAttribute('src'); row.style.display='none'; } }
function niApplyLogoToEditor(src){ if(!src)return; NI.state.niProfileLogoDataUrl=src; logoPreview.innerHTML=`<img src="${src}" alt="logo">`; pLogoCircle.innerHTML=`<img src="${src}" alt="logo">`; }
async function niSaveProfile(){
  if(!NI.state.niSupabase||!NI.state.niSession)return;
  const btn=NI.$('saveProfileBtn'); if(btn){btn.disabled=true;btn.textContent='Saving…';}
  try{
    let logoUrl=NI.state.niRemoveLogo?'':(NI.state.niProfile?.logo_url||'');
    let signatureUrl=NI.state.niRemoveSignature?'':(NI.state.niProfile?.signature_url||'');
    if(NI.state.niProfileLogoFile){
      const ext=NI.state.niProfileLogoFile.type==='image/png'?'png':'jpg';
      const path=`${NI.state.niSession.id}/business-logo.${ext}`;
      const {error}=await NI.state.niSupabase.storage.from('invoice-assets').upload(path,NI.state.niProfileLogoFile,{upsert:true,contentType:NI.state.niProfileLogoFile.type,cacheControl:'3600'});
      if(error)throw error;
      const {data}=NI.state.niSupabase.storage.from('invoice-assets').getPublicUrl(path); logoUrl=data.publicUrl+'?v='+Date.now();
    }
    if(NI.state.niProfileSignatureFile){
      const ext=NI.state.niProfileSignatureFile.type==='image/png'?'png':'jpg';
      const path=`${NI.state.niSession.id}/business-signature.${ext}`;
      const {error}=await NI.state.niSupabase.storage.from('invoice-assets').upload(path,NI.state.niProfileSignatureFile,{upsert:true,contentType:NI.state.niProfileSignatureFile.type,cacheControl:'3600'});
      if(error)throw error;
      const {data}=NI.state.niSupabase.storage.from('invoice-assets').getPublicUrl(path); signatureUrl=data.publicUrl+'?v='+Date.now();
    }
    const payload={full_name:NI.state.niProfile?.full_name||NI.state.niSession.user_metadata?.full_name||'',business_name:NI.$('profileBusinessName').value.trim(),business_email:NI.$('profileBusinessEmail').value.trim(),business_phone:NI.$('profileBusinessPhone').value.trim(),business_address:NI.$('profileBusinessAddress').value.trim(),logo_url:logoUrl,signature_url:signatureUrl,updated_at:new Date().toISOString()};
    const {data,error}=await NI.state.niSupabase.from('invoice_profiles').upsert({user_id:NI.state.niSession.id,...payload},{onConflict:'user_id'}).select().single();
    if(error)throw error;
    NI.state.niProfile=data; NI.state.niProfileLogoFile=null;NI.state.niProfileSignatureFile=null;NI.state.niRemoveLogo=false;NI.state.niRemoveSignature=false;
    NI.state.niProfileLogoDataUrl=logoUrl;NI.state.niProfileSignatureDataUrl=signatureUrl;NI.niSetLogoPreview(logoUrl);NI.niSetSignaturePreview(signatureUrl);NI.niApplySignatureToEditor(signatureUrl);if(logoUrl)NI.niApplyLogoToEditor(logoUrl);
    NI.niMsg('profileMsg','Business profile, logo and signature saved successfully.','success');
    NI.$('dashBusinessName').textContent=data.business_name||'Business profile not set';
    NI.$('dashBusinessContact').textContent=data.business_phone||data.business_email||'Profile saved';
  }catch(e){console.error('Profile save failed',e);NI.niMsg('profileMsg',e.message||'Unable to save profile.','error');}
  finally{if(btn){btn.disabled=false;btn.textContent='Save Business Profile';}}
}

Object.assign(NI, {
  niSetLogoPreview,
  niSetSignaturePreview,
  niApplySignatureToEditor,
  niApplyLogoToEditor,
  niSaveProfile
});

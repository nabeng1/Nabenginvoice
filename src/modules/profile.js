import "../runtime.js";

function niSetLogoPreview(src){
  const box=NI.$('profileLogoPreview');
  if(!box)return;
  box.innerHTML=src?`<img src="${src}" alt="Business logo">`:'<span>LOGO</span>';
}

function niSetSignaturePreview(src){
  const box=NI.$('profileSignaturePreview');
  if(!box)return;
  box.innerHTML=src?`<img src="${src}" alt="Digital signature">`:'<span>No signature</span>';
}

function niSetAvatarPreview(src){
  const box=NI.$('profileAvatarPreview');
  if(!box)return;
  if(src){
    box.innerHTML=`<img src="${src}" alt="Profile photo">`;
    box.classList.add('has-photo');
  }else{
    box.innerHTML='<i class="fas fa-user" aria-hidden="true"></i>';
    box.classList.remove('has-photo');
  }
}

/** Update avatar everywhere: top nav, home pill, sidebar */
function niApplyAvatar(src){
  const apply=(el)=>{
    if(!el)return;
    if(src){
      el.innerHTML=`<img src="${src}" alt="Profile photo">`;
      el.classList.add('has-photo');
    }else{
      el.innerHTML='<i class="fas fa-user" aria-hidden="true"></i>';
      el.classList.remove('has-photo');
    }
  };
  apply(NI.$('dashAvatar'));
  apply(NI.$('dashAvatarHome'));
  apply(NI.$('sidebarAvatar'));
  NI.state.niProfileAvatarDataUrl=src||'';
}

function niApplySignatureToEditor(src){
  const img=NI.$('pSignature');
  const row=NI.$('digitalSignatureRow');
  if(!img||!row)return;
  if(src){ img.src=src; row.style.display='flex'; }
  else { img.removeAttribute('src'); row.style.display='none'; }
}

function niApplyLogoToEditor(src){
  if(!src)return;
  NI.state.niProfileLogoDataUrl=src;
  const logoEl=document.getElementById('logoPreview');
  const circleEl=document.getElementById('pLogoCircle');
  if(logoEl) logoEl.innerHTML=`<img src="${src}" alt="logo">`;
  if(circleEl) circleEl.innerHTML=`<img src="${src}" alt="logo">`;
  const sheet=document.getElementById('sheet');
  if(sheet){
    let wm=sheet.querySelector('.sheet-watermark');
    if(!wm){
      wm=document.createElement('img');
      wm.className='sheet-watermark';
      wm.alt='';
      wm.setAttribute('aria-hidden','true');
      sheet.prepend(wm);
    }
    wm.src=src;
  }
}

function niSyncDisplayName(name){
  const n=name||'User';
  const set=(id)=>{ const el=NI.$(id); if(el) el.textContent=n; };
  set('dashUserName');
  set('dashUserNameHome');
  set('sidebarUserName');
}

async function niSaveProfile(){
  if(!NI.state.niSupabase||!NI.state.niSession)return;
  const btn=NI.$('saveProfileBtn');
  if(btn){btn.disabled=true;btn.textContent='Saving…';}
  try{
    let logoUrl=NI.state.niRemoveLogo?'':(NI.state.niProfile?.logo_url||'');
    let signatureUrl=NI.state.niRemoveSignature?'':(NI.state.niProfile?.signature_url||'');
    let avatarUrl=NI.state.niRemoveAvatar?'':(NI.state.niProfile?.avatar_url||'');

    if(NI.state.niProfileAvatarFile){
      const ext=NI.state.niProfileAvatarFile.type==='image/png'?'png':'jpg';
      const path=`${NI.state.niSession.id}/profile-avatar.${ext}`;
      const {error}=await NI.state.niSupabase.storage.from('invoice-assets').upload(path,NI.state.niProfileAvatarFile,{upsert:true,contentType:NI.state.niProfileAvatarFile.type,cacheControl:'3600'});
      if(error)throw error;
      const {data}=NI.state.niSupabase.storage.from('invoice-assets').getPublicUrl(path);
      avatarUrl=data.publicUrl+'?v='+Date.now();
    }
    if(NI.state.niProfileLogoFile){
      const ext=NI.state.niProfileLogoFile.type==='image/png'?'png':'jpg';
      const path=`${NI.state.niSession.id}/business-logo.${ext}`;
      const {error}=await NI.state.niSupabase.storage.from('invoice-assets').upload(path,NI.state.niProfileLogoFile,{upsert:true,contentType:NI.state.niProfileLogoFile.type,cacheControl:'3600'});
      if(error)throw error;
      const {data}=NI.state.niSupabase.storage.from('invoice-assets').getPublicUrl(path);
      logoUrl=data.publicUrl+'?v='+Date.now();
    }
    if(NI.state.niProfileSignatureFile){
      const ext=NI.state.niProfileSignatureFile.type==='image/png'?'png':'jpg';
      const path=`${NI.state.niSession.id}/business-signature.${ext}`;
      const {error}=await NI.state.niSupabase.storage.from('invoice-assets').upload(path,NI.state.niProfileSignatureFile,{upsert:true,contentType:NI.state.niProfileSignatureFile.type,cacheControl:'3600'});
      if(error)throw error;
      const {data}=NI.state.niSupabase.storage.from('invoice-assets').getPublicUrl(path);
      signatureUrl=data.publicUrl+'?v='+Date.now();
    }

    const fullName=(NI.$('profileFullName')?.value||'').trim() || NI.state.niProfile?.full_name || NI.state.niSession.user_metadata?.full_name || '';

    const payload={
      full_name: fullName,
      business_name: NI.$('profileBusinessName').value.trim(),
      business_email: NI.$('profileBusinessEmail').value.trim(),
      business_phone: NI.$('profileBusinessPhone').value.trim(),
      business_address: NI.$('profileBusinessAddress').value.trim(),
      logo_url: logoUrl,
      signature_url: signatureUrl,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString()
    };

    let data, error;
    ({data,error}=await NI.state.niSupabase
      .from('invoice_profiles')
      .upsert({user_id:NI.state.niSession.id,...payload},{onConflict:'user_id'})
      .select()
      .single());
    // If avatar_url column is missing in DB, retry without it so other fields still save
    if(error && /avatar_url/i.test(error.message||'')){
      console.warn('avatar_url column missing — run migration. Saving other profile fields.');
      const {avatar_url, ...rest}=payload;
      ({data,error}=await NI.state.niSupabase
        .from('invoice_profiles')
        .upsert({user_id:NI.state.niSession.id,...rest},{onConflict:'user_id'})
        .select()
        .single());
      if(!error && data) data={...data, avatar_url: avatarUrl};
    }
    if(error)throw error;

    NI.state.niProfile=data;
    NI.state.niProfileLogoFile=null;
    NI.state.niProfileSignatureFile=null;
    NI.state.niProfileAvatarFile=null;
    NI.state.niRemoveLogo=false;
    NI.state.niRemoveSignature=false;
    NI.state.niRemoveAvatar=false;

    NI.state.niProfileLogoDataUrl=logoUrl;
    NI.state.niProfileSignatureDataUrl=signatureUrl;
    NI.state.niProfileAvatarDataUrl=avatarUrl;

    NI.niSetLogoPreview(logoUrl);
    NI.niSetSignaturePreview(signatureUrl);
    NI.niSetAvatarPreview(avatarUrl);
    NI.niApplyAvatar(avatarUrl);
    NI.niApplySignatureToEditor(signatureUrl);
    if(logoUrl) NI.niApplyLogoToEditor(logoUrl);
    NI.niSyncDisplayName(data.full_name || fullName || 'User');

    NI.niMsg('profileMsg','Profile, photo, logo and signature saved successfully.','success');
    NI.$('dashBusinessName').textContent=data.business_name||'Business profile not set';
    NI.$('dashBusinessContact').textContent=data.business_phone||data.business_email||'Profile saved';
  }catch(e){
    console.error('Profile save failed',e);
    NI.niMsg('profileMsg',e.message||'Unable to save profile.','error');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Save Business Profile';}
  }
}

Object.assign(NI, {
  niSetLogoPreview,
  niSetSignaturePreview,
  niSetAvatarPreview,
  niApplyAvatar,
  niApplySignatureToEditor,
  niApplyLogoToEditor,
  niSyncDisplayName,
  niSaveProfile
});

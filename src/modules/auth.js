import "../runtime.js";

function niInitSupabase(){
  
  if(NI.config.supabaseUrl.startsWith('YOUR_') || NI.config.supabaseAnonKey.startsWith('YOUR_')) return false;
  NI.state.niSupabase = NI.createClient(NI.config.supabaseUrl,NI.config.supabaseAnonKey);
  return true;
}

function niOpenAuth(mode='signin'){
  NI.state.niAuthMode=mode;
  NI.niHide('landingScreen'); NI.niHide('dashboardScreen'); NI.niShow('authScreen');
  document.body.classList.add('ni-auth-mode');
  NI.$('tabSignIn').classList.toggle('active',mode==='signin');
  NI.$('tabSignUp').classList.toggle('active',mode==='signup');
  document.querySelectorAll('.ni-signup-only').forEach(x=>x.classList.toggle('ni-hidden',mode!=='signup'));
  NI.$('authTitle').textContent=mode==='signup'?'Create your Nabeng Invoice account':'Welcome back';
  NI.$('authSubtitle').textContent=mode==='signup'?'Create your account and save your business profile in the cloud.':'Sign in to access your saved invoice workspace.';
  NI.$('authSubmit').textContent=mode==='signup'?'Create Account':'Sign In';
  NI.niClearMsg('authMsg');
}

function niOpenLanding(){ NI.niHide('authScreen');NI.niHide('dashboardScreen');NI.niHide('invoiceApp');NI.niHide('editorBar');NI.niShow('landingScreen'); }
function niOpenDashboard(){ NI.niHide('landingScreen');NI.niHide('authScreen');NI.niHide('invoiceApp');NI.niHide('editorBar');NI.niShow('dashboardScreen'); }

async function niEnsureProfile(user){
  const {data,error}=await NI.state.niSupabase.from('invoice_profiles').select('*').eq('user_id',user.id).maybeSingle();
  if(error){ console.error(error); throw error; }
  if(data) return data;
  const fallback={user_id:user.id,full_name:user.user_metadata?.full_name||'',business_name:'',business_email:user.email||'',business_phone:'',business_address:'',logo_url:'',signature_url:''};
  const {data:created,error:createError}=await NI.state.niSupabase.from('invoice_profiles').insert(fallback).select().single();
  if(createError) throw createError;
  return created;
}

async function niLoadUser(user){
  NI.state.niSession=user;
  try{ NI.state.niProfile=await NI.niEnsureProfile(user); }catch(e){ console.error('Profile load failed',e); NI.state.niProfile={user_id:user.id,full_name:user.user_metadata?.full_name||'',business_name:'',business_email:user.email||'',business_phone:'',business_address:'',logo_url:'',signature_url:''}; }
  NI.$('dashUserName').textContent=NI.state.niProfile.full_name||user.email||'User';
  NI.$('dashAvatar').textContent=NI.niInitial(NI.state.niProfile.full_name||user.email);
  NI.$('dashGreeting').textContent='Welcome back, '+(NI.state.niProfile.full_name||user.email?.split('@')[0]||'there');
  NI.$('dashEmail').textContent=user.email||'—';
  NI.$('dashBusinessName').textContent=NI.state.niProfile.business_name||'Business profile not set';
  NI.$('dashBusinessContact').textContent=NI.state.niProfile.business_phone||NI.state.niProfile.business_email||'Add your business profile so invoices can be prepared automatically.';
  NI.$('profileBusinessName').value=NI.state.niProfile.business_name||'';
  NI.$('profileBusinessEmail').value=NI.state.niProfile.business_email||user.email||'';
  NI.$('profileBusinessPhone').value=NI.state.niProfile.business_phone||'';
  NI.$('profileBusinessAddress').value=NI.state.niProfile.business_address||'';
  NI.state.niProfileLogoDataUrl=NI.state.niProfile.logo_url||'';
  NI.state.niProfileSignatureDataUrl=NI.state.niProfile.signature_url||'';
  NI.niSetLogoPreview(NI.state.niProfileLogoDataUrl);
  NI.niSetSignaturePreview(NI.state.niProfileSignatureDataUrl);
  NI.niApplySignatureToEditor(NI.state.niProfileSignatureDataUrl);
  await NI.niLoadCustomers();
  await NI.niLoadInvoiceHistory();
  NI.niOpenDashboard();
}

async function niStart(){
  if(!NI.niInitSupabase()){
    NI.niOpenLanding();
    console.warn('Configure NI.config.supabaseUrl and NI.config.supabaseAnonKey in this file to enable authentication.');
    return;
  }
  const {data:{session}}=await NI.state.niSupabase.auth.getSession();
  if(session?.user) await NI.niLoadUser(session.user); else NI.niOpenLanding();
  NI.state.niSupabase.auth.onAuthStateChange(async (_event,sessionNow)=>{
    if(sessionNow?.user && !NI.state.niSession) await NI.niLoadUser(sessionNow.user);
    if(!sessionNow?.user){ NI.state.niSession=null;NI.state.niProfile=null;NI.niOpenLanding(); }
  });
}

async function niAuthSubmit(e){
  e.preventDefault(); NI.niClearMsg('authMsg');
  if(!NI.state.niSupabase){ NI.niMsg('authMsg','Add your Supabase URL and anon key in the configuration section first.','error');return; }
  const email=NI.$('authEmail').value.trim(); const password=NI.$('authPassword').value; const name=NI.$('authName').value.trim();
  NI.$('authSubmit').disabled=true; NI.$('authSubmit').textContent=NI.state.niAuthMode==='signup'?'Creating account…':'Signing in…';
  try{
    if(NI.state.niAuthMode==='signup'){
      if(!name){throw new Error('Please enter your full name.');}
      const {data,error}=await NI.state.niSupabase.auth.signUp({email,password,options:{data:{full_name:name}}});
      if(error)throw error;
      if(data.session){ await NI.niLoadUser(data.user); }
      else NI.niMsg('authMsg','Account created. Check your email if email confirmation is enabled, then sign in.','success');
    }else{
      const {data,error}=await NI.state.niSupabase.auth.signInWithPassword({email,password});
      if(error)throw error; await NI.niLoadUser(data.user);
    }
  }catch(err){ console.error(err);NI.niMsg('authMsg',err.message||'Authentication failed.','error'); }
  finally{ NI.$('authSubmit').disabled=false;NI.$('authSubmit').textContent=NI.state.niAuthMode==='signup'?'Create Account':'Sign In'; }
}

async function niSignOut(){ if(NI.state.niSupabase) await NI.state.niSupabase.auth.signOut(); NI.state.niSession=null;NI.state.niProfile=null;NI.niOpenLanding(); }

Object.assign(NI, {
  niInitSupabase,
  niOpenAuth,
  niOpenLanding,
  niOpenDashboard,
  niEnsureProfile,
  niLoadUser,
  niStart,
  niAuthSubmit,
  niSignOut
});

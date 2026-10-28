import "../runtime.js";

function niInitSupabase(){
  
  if(NI.config.supabaseUrl.startsWith('YOUR_') || NI.config.supabaseAnonKey.startsWith('YOUR_')) return false;
  NI.state.niSupabase = NI.createClient(NI.config.supabaseUrl,NI.config.supabaseAnonKey);
  return true;
}

// ---------- UPDATE EXISTING FUNCTIONS ----------

function niOpenAuth(mode = 'signin') {
  NI.state.niAuthMode = mode;
  NI.niHide('landingScreen');
  NI.niHide('dashboardScreen');
  NI.niHide('resetPasswordScreen');
  NI.niHide('aboutScreen');
  NI.niHide('contactScreen');
  NI.niShow('authScreen');
  document.body.classList.add('ni-auth-mode');


  // Show/hide tabs
  const tabs = NI.$('authTabs');
  if (tabs) tabs.classList.toggle('ni-hidden', mode === 'forgot');

  // Password field
  NI.$('authPasswordField')?.classList.toggle('ni-hidden', mode === 'forgot');

  // Forgot link only on signin
  NI.$('forgotPasswordLinkWrap')?.classList.toggle('ni-hidden', mode !== 'signin');

  document.querySelectorAll('.ni-signup-only').forEach(x =>
    x.classList.toggle('ni-hidden', mode !== 'signup')
  );

  NI.$('tabSignIn').classList.toggle('active', mode === 'signin');
  NI.$('tabSignUp').classList.toggle('active', mode === 'signup');

  if (mode === 'signup') {
    NI.$('authTitle').textContent = 'Create your Nabeng Invoice account';
    NI.$('authSubtitle').textContent = 'Create your account and save your business profile in the cloud.';
    NI.$('authSubmit').textContent = 'Create Account';
  } else if (mode === 'signin') {
    NI.$('authTitle').textContent = 'Welcome back';
    NI.$('authSubtitle').textContent = 'Sign in to access your saved invoice workspace.';
    NI.$('authSubmit').textContent = 'Sign In';
  }

  NI.niClearMsg('authMsg');
}

function niOpenLanding() {
  NI.niHide('authScreen');
  NI.niHide('dashboardScreen');
  NI.niHide('invoiceApp');
  NI.niHide('editorBar');
  NI.niHide('aboutScreen');
  NI.niHide('contactScreen');
  NI.niHide('resetPasswordScreen');
  NI.niHide('subscriptionLockedScreen');
  NI.niShow('landingScreen');
  document.body.classList.remove('ni-auth-mode');
}

function niOpenDashboard(){ NI.niHide('landingScreen');NI.niHide('authScreen');NI.niHide('invoiceApp');NI.niHide('editorBar');NI.niShow('dashboardScreen'); }

async function niEnsureProfile(user) {
  const { data, error } = await NI.state.niSupabase
    .from("invoice_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw error;
  }
  if (data) return data;

  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + 30);

  const fallback = {
    user_id: user.id,
    full_name: user.user_metadata?.full_name || "",
    business_name: "",
    business_email: user.email || "",
    business_phone: "",
    business_address: "",
    logo_url: "",
    signature_url: "",
    trial_ends_at: trialEnds.toISOString(),
    subscription_status: "trial",
  };
  const { data: created, error: createError } = await NI.state.niSupabase
    .from("invoice_profiles")
    .insert(fallback)
    .select()
    .single();
  if (createError) throw createError;
  return created;
}




// ---------- PASSWORD RESET ----------

function niOpenForgotPassword() {
  NI.state.niAuthMode = 'forgot';
  NI.niHide('landingScreen');
  NI.niHide('dashboardScreen');
  NI.niHide('resetPasswordScreen');
  NI.niShow('authScreen');
  document.body.classList.add('ni-auth-mode');

  // Hide tabs and password field
  NI.$('authTabs')?.classList.add('ni-hidden');
  NI.$('authPasswordField')?.classList.add('ni-hidden');
  NI.$('forgotPasswordLinkWrap')?.classList.add('ni-hidden');
  document.querySelectorAll('.ni-signup-only').forEach(x => x.classList.add('ni-hidden'));

  NI.$('authTitle').textContent = 'Reset your password';
  NI.$('authSubtitle').textContent = 'Enter the email linked to your Nabeng Invoice account and we’ll send you a reset link.';
  NI.$('authSubmit').textContent = 'Send Reset Link';
  NI.niClearMsg('authMsg');
}

function niOpenResetPasswordScreen() {
  NI.niHide('landingScreen');
  NI.niHide('authScreen');
  NI.niHide('dashboardScreen');
  NI.niShow('resetPasswordScreen');
  document.body.classList.add('ni-auth-mode');
  NI.niClearMsg('resetPasswordMsg');
}

async function niSendResetLink(e) {
  e.preventDefault();
  NI.niClearMsg('authMsg');

  if (!NI.state.niSupabase) {
    NI.niMsg('authMsg', 'Supabase is not configured.', 'error');
    return;
  }

  const email = NI.$('authEmail').value.trim();
  if (!email) {
    NI.niMsg('authMsg', 'Please enter your email address.', 'error');
    return;
  }

  NI.$('authSubmit').disabled = true;
  NI.$('authSubmit').textContent = 'Sending…';

  try {
    const { error } = await NI.state.niSupabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/',   // important!
    });

    if (error) throw error;

    NI.niMsg(
      'authMsg',
      'Check your email for the password reset link. It may take a minute to arrive.',
      'success'
    );
  } catch (err) {
    console.error(err);
    NI.niMsg('authMsg', err.message || 'Could not send reset email.', 'error');
  } finally {
    NI.$('authSubmit').disabled = false;
    NI.$('authSubmit').textContent = 'Send Reset Link';
  }
}

async function niUpdatePassword(e) {
  e.preventDefault();
  NI.niClearMsg('resetPasswordMsg');

  const password = NI.$('newPassword').value;
  const confirm  = NI.$('confirmPassword').value;

  if (password.length < 8) {
    NI.niMsg('resetPasswordMsg', 'Password must be at least 8 characters.', 'error');
    return;
  }
  if (password !== confirm) {
    NI.niMsg('resetPasswordMsg', 'Passwords do not match.', 'error');
    return;
  }

  NI.$('resetPasswordSubmit').disabled = true;
  NI.$('resetPasswordSubmit').textContent = 'Updating…';

  try {
    const { error } = await NI.state.niSupabase.auth.updateUser({ password });
    if (error) throw error;

    NI.niMsg('resetPasswordMsg', 'Password updated successfully! You can now sign in.', 'success');

    // Optional: auto redirect to sign-in after 2 seconds
    setTimeout(() => {
      NI.niOpenAuth('signin');
    }, 2000);
  } catch (err) {
    console.error(err);
    NI.niMsg('resetPasswordMsg', err.message || 'Could not update password.', 'error');
  } finally {
    NI.$('resetPasswordSubmit').disabled = false;
    NI.$('resetPasswordSubmit').textContent = 'Update Password';
  }
}




async function niLoadUser(user){
  NI.state.niSession=user;
  try{ NI.state.niProfile=await NI.niEnsureProfile(user); }catch(e){ console.error('Profile load failed',e); NI.state.niProfile={user_id:user.id,full_name:user.user_metadata?.full_name||'',business_name:'',business_email:user.email||'',business_phone:'',business_address:'',logo_url:'',signature_url:''}; }
  const displayName=NI.state.niProfile.full_name||user.email||'User';
  NI.$('dashUserName').textContent=displayName;
  const homeName=NI.$('dashUserNameHome'); if(homeName) homeName.textContent=displayName;
  NI.$('dashAvatar').innerHTML='<i class="fas fa-user" aria-hidden="true"></i>';
  const homeAv=NI.$('dashAvatarHome'); if(homeAv) homeAv.innerHTML='<i class="fas fa-user"></i>';
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
  
  // --- subscription gate ---
  const allowed = await NI.niCheckAccessAndRoute();
  if (!allowed) return; // locked screen is already showing

  // original UI population continues…
  NI.$("dashUserName").textContent = NI.state.niProfile.full_name || user.email || "User";
  
  await NI.niLoadCustomers();
  await NI.niLoadInvoiceHistory();
  NI.niOpenDashboard();
}

async function niHandleAuthCallback() {
  const hash = window.location.hash;
  const search = window.location.search;

  const isRecovery =
    (hash && (hash.includes('type=recovery') || hash.includes('type=invite'))) ||
    (search && (search.includes('type=recovery') || search.includes('type=invite')));

  if (!isRecovery) return false;

  try {
    // Wait a short moment for Supabase to process the tokens
    await new Promise(resolve => setTimeout(resolve, 300));

    const { data: { session }, error } = await NI.state.niSupabase.auth.getSession();

    if (error) {
      console.error('Recovery session error:', error);
      return false;
    }

    if (session) {
      NI.niOpenResetPasswordScreen();
      // Clean the URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return true; // important: tell niStart we handled recovery
    }
  } catch (err) {
    console.error('Recovery link error:', err);
  }

  return false;
}

async function niStart() {
  if (!NI.niInitSupabase()) {
    NI.niOpenLanding();
    console.warn('Configure NI.config.supabaseUrl and NI.config.supabaseAnonKey');
    return;
  }

  // Check for recovery link first
  const isRecovery = await NI.niHandleAuthCallback();

  // If this is a password recovery, stop here — don't load the dashboard
  if (isRecovery) return;

  const { data: { session } } = await NI.state.niSupabase.auth.getSession();

  if (session?.user) {
    await NI.niLoadUser(session.user);
  } else {
    NI.niOpenLanding();
  }

  NI.state.niSupabase.auth.onAuthStateChange(async (_event, sessionNow) => {
    if (sessionNow?.user && !NI.state.niSession) {
      // Don't auto-load user if we are on the reset password screen
      if (NI.$('resetPasswordScreen') && !NI.$('resetPasswordScreen').classList.contains('ni-hidden')) {
        return;
      }
      await NI.niLoadUser(sessionNow.user);
    }

    if (!sessionNow?.user) {
      NI.state.niSession = null;
      NI.state.niProfile = null;
      NI.niOpenLanding();
    }
  });
}

async function niAuthSubmit(e) {
  e.preventDefault();
  NI.niClearMsg('authMsg');

  if (!NI.state.niSupabase) {
    NI.niMsg('authMsg', 'Add your Supabase URL and anon key first.', 'error');
    return;
  }

  // Forgot password mode
  if (NI.state.niAuthMode === 'forgot') {
    return NI.niSendResetLink(e);
  }

  const email = NI.$('authEmail').value.trim();
  const password = NI.$('authPassword').value;
  const name = NI.$('authName').value.trim();

  // Manual validation (important)
  if (!email) {
    NI.niMsg('authMsg', 'Please enter your email address.', 'error');
    return;
  }

  if (!password) {
    NI.niMsg('authMsg', 'Please enter your password.', 'error');
    return;
  }

  if (NI.state.niAuthMode === 'signup' && !name) {
    NI.niMsg('authMsg', 'Please enter your full name.', 'error');
    return;
  }

  NI.$('authSubmit').disabled = true;
  NI.$('authSubmit').textContent =
    NI.state.niAuthMode === 'signup' ? 'Creating account…' : 'Signing in…';

  try {
    if (NI.state.niAuthMode === 'signup') {
      const { data, error } = await NI.state.niSupabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) throw error;

      if (data.session) {
        await NI.niLoadUser(data.user);
      } else {
        NI.niMsg(
          'authMsg',
          'Account created. Check your email if confirmation is required, then sign in.',
          'success'
        );
      }
    } else {
      const { data, error } = await NI.state.niSupabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      await NI.niLoadUser(data.user);
    }
  } catch (err) {
    console.error(err);
    NI.niMsg('authMsg', err.message || 'Authentication failed.', 'error');
  } finally {
    NI.$('authSubmit').disabled = false;
    NI.$('authSubmit').textContent =
      NI.state.niAuthMode === 'signup' ? 'Create Account' : 'Sign In';
  }
}

function niOpenAbout() {
  NI.niHide('landingScreen');
  NI.niHide('authScreen');
  NI.niHide('contactScreen');
  NI.niHide('dashboardScreen');
  NI.niShow('aboutScreen');
  document.body.classList.add('ni-auth-mode');
  window.scrollTo(0, 0);
}

function niOpenContact() {
  NI.niHide('landingScreen');
  NI.niHide('authScreen');
  NI.niHide('aboutScreen');
  NI.niHide('dashboardScreen');
  NI.niShow('contactScreen');
  document.body.classList.add('ni-auth-mode');
  window.scrollTo(0, 0);
  NI.niClearMsg('contactMsg');
}

async function niSubmitContactForm(e) {
  e.preventDefault();
  NI.niClearMsg('contactMsg');

  const name = NI.$('contactName').value.trim();
  const email = NI.$('contactEmail').value.trim();
  const subject = NI.$('contactSubject').value.trim();
  const message = NI.$('contactMessage').value.trim();

  if (!name || !email || !subject || !message) {
    NI.niMsg('contactMsg', 'Please fill in all fields.', 'error');
    return;
  }

  // For now we just show success.
  // Later you can connect this to EmailJS, Formspree, or a Supabase table.
  NI.$('contactSubmitBtn').disabled = true;
  NI.$('contactSubmitBtn').textContent = 'Sending…';

  setTimeout(() => {
    NI.niMsg('contactMsg', 'Thank you! Your message has been received. We will get back to you soon.', 'success');
    NI.$('contactForm').reset();
    NI.$('contactSubmitBtn').disabled = false;
    NI.$('contactSubmitBtn').textContent = 'Send Message';
  }, 900);
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
  niSignOut,
  // Password reset functions
  niOpenForgotPassword,
  niOpenResetPasswordScreen,
  niSendResetLink,
  niUpdatePassword,
  niHandleAuthCallback,
  niOpenAbout,
  niOpenContact,
  niSubmitContactForm,
});












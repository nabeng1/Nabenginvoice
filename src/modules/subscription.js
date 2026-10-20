import "../runtime.js";

const MONTHLY_AMOUNT_PESEWAS = 3000;   // GHS 30.00
const YEARLY_AMOUNT_PESEWAS  = 31000;  // GHS 310.00
const PAYSTACK_PUBLIC_KEY    = "pk_live_d840cd5de76b748752770285dbdb00e940554827"; // ← replace with your key

function niGeneratePaymentRef() {
  // NPM-7f3a9491-c141-4425-9126-fb0ad099dab5 style
  const uuid = crypto.randomUUID();
  return `NPM-${uuid}`;
}

function niSubscriptionAllowed(profile) {
  if (!profile) return { allowed: false, status: "locked" };
  const now = new Date();

  if (
    profile.subscription_status === "trial" &&
    profile.trial_ends_at &&
    new Date(profile.trial_ends_at) > now
  ) {
    return { allowed: true, status: "trial", endsAt: profile.trial_ends_at };
  }

  if (
    profile.subscription_status === "active" &&
    profile.subscription_ends_at &&
    new Date(profile.subscription_ends_at) > now
  ) {
    return {
      allowed: true,
      status: "active",
      plan: profile.subscription_plan,
      endsAt: profile.subscription_ends_at,
    };
  }

  // Still waiting for webhook
  if (profile.subscription_status === "pending") {
    return { allowed: false, status: "pending" };
  }

  return { allowed: false, status: "locked" };
}

async function niRefreshSubscription() {
  if (!NI.state.niSupabase || !NI.state.niSession) return null;
  const { data, error } = await NI.state.niSupabase
    .from("invoice_profiles")
    .select("trial_ends_at,subscription_status,subscription_plan,subscription_ends_at,last_payment_ref")
    .eq("user_id", NI.state.niSession.id)
    .maybeSingle();
  if (error) {
    console.error(error);
    return null;
  }
  if (data && NI.state.niProfile) {
    Object.assign(NI.state.niProfile, data);
  }
  return data;
}

function niShowLockedScreen(info) {
  NI.niHide("landingScreen");
  NI.niHide("authScreen");
  NI.niHide("dashboardScreen");
  NI.niHide("invoiceApp");
  NI.niHide("editorBar");
  NI.niShow("subscriptionLockedScreen");
  document.body.classList.remove("ni-auth-mode", "ni-editor-mode");

  const statusEl = NI.$("subLockStatus");
  if (statusEl) {
    if (info?.status === "pending") {
      statusEl.textContent = "Payment submitted — waiting for confirmation…";
    } else {
      statusEl.textContent = "Your free trial has ended. Subscribe to continue.";
    }
  }
}

function niHideLockedScreen() {
  NI.niHide("subscriptionLockedScreen");
}

async function niCheckAccessAndRoute() {
  await NI.niRefreshSubscription();
  const access = NI.niSubscriptionAllowed(NI.state.niProfile);

  if (access.allowed) {
    NI.niHideLockedScreen();
    // continue normal flow – caller will open dashboard
    return true;
  }

  NI.niShowLockedScreen(access);
  return false;
}

function niLoadPaystackScript() {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve();
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Paystack"));
    document.head.appendChild(s);
  });
}

async function niStartPaystackPayment(plan) {
  if (!NI.state.niSession) return;

  const amount = plan === "yearly" ? YEARLY_AMOUNT_PESEWAS : MONTHLY_AMOUNT_PESEWAS;
  const reference = NI.niGeneratePaymentRef();
  const email = NI.state.niSession.email;

  // Mark as pending so the UI can show a waiting state
  await NI.state.niSupabase
    .from("invoice_profiles")
    .update({
      last_payment_ref: reference,
      subscription_plan: plan,
      subscription_status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", NI.state.niSession.id);

  try {
    await NI.niLoadPaystackScript();
  } catch (e) {
    alert(e.message);
    return;
  }

  const handler = window.PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email,
    amount,
    currency: "GHS",
    ref: reference,
    metadata: {
      user_id: NI.state.niSession.id,
      plan,
      product: "nabeng_invoice_subscription",
    },
    callback: function (response) {
      // Paystack succeeded on the client.
      // The real unlock happens in the webhook.
      // We just refresh and show a friendly message.
      NI.niMsg("subLockMsg", "Payment received. Unlocking your account…", "success");
      // Poll a few times while the webhook processes
      let tries = 0;
      const poll = setInterval(async () => {
        tries++;
        const ok = await NI.niCheckAccessAndRoute();
        if (ok) {
          clearInterval(poll);
          await NI.niLoadUser(NI.state.niSession);
        } else if (tries >= 8) {
          clearInterval(poll);
          NI.niMsg(
            "subLockMsg",
            "Payment is being confirmed. Refresh in a minute if the app is still locked.",
            "success"
          );
        }
      }, 2500);
    },
    onClose: function () {
      // User closed the popup – leave status as pending
    },
  });

  handler.openIframe();
}

Object.assign(NI, {
  niGeneratePaymentRef,
  niSubscriptionAllowed,
  niRefreshSubscription,
  niShowLockedScreen,
  niHideLockedScreen,
  niCheckAccessAndRoute,
  niLoadPaystackScript,
  niStartPaystackPayment,
});
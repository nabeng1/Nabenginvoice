import "../runtime.js";

// Prices shown on the form (what the customer sees)
const MONTHLY_DISPLAY_GHS = 30;
const YEARLY_DISPLAY_GHS  = 310;

// Paystack Ghana local fee ~1.95%. We charge a bit more so after the fee
// you still receive about the display price. The extra is NOT shown on the form.
const PAYSTACK_FEE_RATE = 0.0195;

function niAmountWithFeePesewas(displayGhs) {
  // Charge enough so net ≈ displayGhs after 1.95% fee (round up to next pesewa)
  const gross = displayGhs / (1 - PAYSTACK_FEE_RATE);
  return Math.ceil(gross * 100); // pesewas
}

const MONTHLY_AMOUNT_PESEWAS = niAmountWithFeePesewas(MONTHLY_DISPLAY_GHS); // ~GHS 30.60
const YEARLY_AMOUNT_PESEWAS  = niAmountWithFeePesewas(YEARLY_DISPLAY_GHS);  // ~GHS 316.17
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

function niDaysRemaining(endsAt) {
  if (!endsAt) return 0;
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function niUpdateTrialBanner(access) {
  const banner = NI.$("trialBanner");
  const titleEl = NI.$("trialBannerTitle");
  const daysEl = NI.$("trialBannerDays");
  const statusEl = NI.$("profileSubStatus");
  const actionsEl = NI.$("profileSubActions");
  const hintEl = NI.$("profileSubHint");

  if (!access || !access.allowed) {
    if (banner) banner.classList.add("ni-hidden");
    return;
  }

  if (access.status === "trial") {
    const days = NI.niDaysRemaining(access.endsAt);
    if (banner) {
      banner.classList.remove("ni-hidden");
      if (titleEl) titleEl.textContent = "Free trial active";
      if (daysEl) {
        daysEl.textContent =
          days === 1 ? "1 day remaining" : `${days} days remaining`;
      }
    }
    if (statusEl) {
      statusEl.textContent =
        days === 1
          ? "Your free 14-day trial ends tomorrow."
          : `Your free 14-day trial has ${days} days remaining.`;
    }
    if (actionsEl) actionsEl.classList.remove("ni-hidden");
    if (hintEl) {
      hintEl.textContent =
        "You can subscribe at any time during your free trial — no need to wait until it ends.";
    }
  } else if (access.status === "active") {
    if (banner) banner.classList.add("ni-hidden");
    const plan = access.plan === "yearly" ? "Yearly" : "Monthly";
    const ends = access.endsAt
      ? new Date(access.endsAt).toLocaleDateString()
      : "—";
    if (statusEl) {
      statusEl.textContent = `${plan} plan active · renews / ends ${ends}`;
    }
    if (actionsEl) actionsEl.classList.add("ni-hidden");
    if (hintEl) hintEl.textContent = "Thank you for subscribing.";
  } else {
    if (banner) banner.classList.add("ni-hidden");
  }
}

async function niCheckAccessAndRoute() {
  await NI.niRefreshSubscription();
  const access = NI.niSubscriptionAllowed(NI.state.niProfile);

  if (access.allowed) {
    NI.niHideLockedScreen();
    NI.niUpdateTrialBanner(access);
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
  niDaysRemaining,
  niUpdateTrialBanner,
  niCheckAccessAndRoute,
  niLoadPaystackScript,
  niStartPaystackPayment,
});
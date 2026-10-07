import "./style.css";
import "./runtime.js";
import "./modules/utils.js";
import "./modules/auth.js";
import "./modules/profile.js";
import "./modules/invoices.js";
import "./modules/customers.js";
import "./modules/analytics.js";
import "./modules/payments.js";
import "./modules/phase4.js";
import "./modules/editor.js";
import "./modules/wire.js";
import "./components/header.js";

window.addEventListener("DOMContentLoaded", () => {
  NI.niRefreshBrandLogos();
  NI.niWire();
  NI.niStart();
});

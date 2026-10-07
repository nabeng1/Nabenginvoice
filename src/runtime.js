// Nabeng Invoice runtime and shared application state
import { createClient } from "@supabase/supabase-js";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const NI = window.NI = window.NI || {};
NI.config = {
  supabaseUrl: "https://vbtppozknezdierutirp.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZidHBwb3prbmV6ZGllcnV0aXJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MzY3NjQsImV4cCI6MjEwNjMxMjc2NH0.0eCglmdxpPwkok6A52D03TuHBbE4bZD92n9kFZ4o_t8",
  brandLogo: "/assets/nabeng-invoice-logo.png"
};
NI.createClient = createClient;
NI.html2canvas = html2canvas;
NI.jsPDF = jsPDF;
NI.state = NI.state || {
  niSupabase: null, niSession: null, niProfile: null, niAuthMode: "signin",
  niEditingInvoiceId: null, niProfileLogoDataUrl: "", niProfileLogoFile: null,
  niProfileSignatureDataUrl: "", niProfileSignatureFile: null, niRemoveLogo: false,
  niRemoveSignature: false, niCurrentInvoice: null, niCustomers: [],
  niEditingCustomerId: null, niCustomerStats: {},
  items: Array.from({length: 10}, () => ({ qty: "", desc: "", rate: "" }))
};
NI.$ = id => document.getElementById(id);

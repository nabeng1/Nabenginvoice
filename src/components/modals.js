import "../runtime.js";
export function closeModal(id){ NI.$(id)?.classList.add("ni-hidden"); }
export function openModal(id){ NI.$(id)?.classList.remove("ni-hidden"); }

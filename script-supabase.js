// script-supabase.js
// 1) Import Supabase ESM directly (no other <script> tags needed)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// 2) Create client (anon key only)
const SUPABASE_URL = "https://cvrqblizwcxeoftfjxvg.supabase.co";
const SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2cnFibGl6d2N4ZW9mdGZqeHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NjA1MzAsImV4cCI6MjA3ODMzNjUzMH0.7c0SH1fk0qTY-iHhfqBdW5yZZ4g9L3n9cy_EWtW4Bxw"
; // replace with your real anon key
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("KEY parts:", SUPABASE_ANON_KEY?.split(".").length);   // should print 3
try {
  const payload = JSON.parse(atob(SUPABASE_ANON_KEY.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));
  console.log("Key ref:", payload.ref); // must be "cvrqblizwcxeoftfjxvg"
} catch (e) { console.error("Key decode failed", e); }
// 3) Simple state
const state = { ingredientSort: "asc", editingId: null };

// 4) Helpers
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const fmtMoney = (n) => (isNaN(n) ? "$0.00" : `$${Number(n).toFixed(2)}`);

// 5) Section switching (HTML calls onclick="showSection('...')")
window.showSection = function showSection(id) {
  $$(".section").forEach((s) => s.classList.add("hidden"));
  document.getElementById(id)?.classList.remove("hidden");

  $$(".nav-links button").forEach((b) => b.classList.remove("active"));
  $$(".nav-links button")
    .find((b) => (b.getAttribute("onclick") || "").includes(`'${id}'`))
    ?.classList.add("active");

  if (location.hash !== `#${id}`) history.replaceState(null, "", `#${id}`);
};

window.addEventListener("DOMContentLoaded", () => {
  const first = (location.hash || "#ingredients").slice(1);
  window.showSection(first);
  loadIngredients().catch(console.error);
});
window.addEventListener("hashchange", () =>
  window.showSection((location.hash || "#ingredients").slice(1))
);

// 6) Ingredients UI actions referenced by HTML
window.showIngredientForm = function () {
  $("#ingredient-form-card")?.classList.remove("hidden");
  $("#submit-btn").textContent = state.editingId ? "Update Ingredient" : "Add Ingredient";
};

window.cancelIngredientEdit = function () {
  $("#ingredient-form-card")?.classList.add("hidden");
  $("#ingredient-form")?.reset();
  $("#ingredient-id").value = "";
  state.editingId = null;
  $("#submit-btn").textContent = "Add Ingredient";
};

window.toggleIngredientSort = function () {
  state.ingredientSort = $("#ingredient-sort")?.value || "asc";
  loadIngredients();
};

window.saveIngredient = async function (e) {
  e.preventDefault();
  const id = $("#ingredient-id").value || null;
  const name = $("#ingredient-name").value.trim();
  const quantity = parseFloat($("#ingredient-quantity").value);
  const unit = $("#ingredient-unit").value;
  const total_price = parseFloat($("#ingredient-price").value);

  if (!name || !quantity || !unit || isNaN(total_price)) return;

  // derive price_per_unit on client (optional)
  const price_per_unit = total_price / quantity;

  try {
    if (id) {
      const { error } = await supabase
        .from("ingredients")
        .update({ name, quantity, unit, total_price, price_per_unit })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("ingredients")
        .insert([{ name, quantity, unit, total_price, price_per_unit }]);
      if (error) throw error;
    }
    window.cancelIngredientEdit();
    await loadIngredients();
    toast("#ingredient-alert", "Saved successfully");
  } catch (err) {
    toast("#ingredient-alert", `Save failed: ${err.message}`, true);
    console.error(err);
  }
};

// 7) Load + render ingredients table
async function loadIngredients() {
  const ascending = state.ingredientSort !== "desc";
  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .order("name", { ascending });

  if (error) {
    toast("#ingredient-alert", `Error loading data: ${error.message}`, true);
    return;
  }

  const tbody = $("#ingredients-list");
  if (!tbody) return;

  tbody.innerHTML = (data || [])
    .map((row) => {
      const ppu = Number(row.price_per_unit ?? 0);
      const purchaseInfo = `${Number(row.quantity)} ${row.unit}`;
      return `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td>${purchaseInfo} @ ${fmtMoney(Number(row.total_price))}</td>
          <td>${ppu ? fmtMoney(ppu) + " / " + escapeHtml(row.unit) : "-"}</td>
          <td>
            <button class="btn btn-secondary" data-edit="${row.id}">Edit</button>
            <button class="btn btn-danger" data-del="${row.id}">Delete</button>
          </td>
        </tr>`;
    })
    .join("");

  // wire row buttons
  tbody.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => startEdit(btn.getAttribute("data-edit")))
  );
  tbody.querySelectorAll("[data-del]").forEach((btn) =>
    btn.addEventListener("click", () => delIngredient(btn.getAttribute("data-del")))
  );
}

async function startEdit(id) {
  const { data, error } = await supabase.from("ingredients").select("*").eq("id", id).single();
  if (error) {
    toast("#ingredient-alert", `Load failed: ${error.message}`, true);
    return;
  }
  state.editingId = id;
  $("#ingredient-id").value = id;
  $("#ingredient-name").value = data.name || "";
  $("#ingredient-quantity").value = data.quantity ?? "";
  $("#ingredient-unit").value = data.unit || "";
  $("#ingredient-price").value = data.total_price ?? "";
  $("#submit-btn").textContent = "Update Ingredient";
  $("#ingredient-form-card").classList.remove("hidden");
}

async function delIngredient(id) {
  if (!confirm("Delete this ingredient?")) return;
  try {
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    if (error) throw error;
    await loadIngredients();
    toast("#ingredient-alert", "Deleted");
  } catch (err) {
    toast("#ingredient-alert", `Delete failed: ${err.message}`, true);
  }
}

function toast(sel, msg, isErr = false) {
  const el = $(sel);
  if (!el) return;
  el.textContent = msg;
  el.style.padding = "8px 12px";
  el.style.borderRadius = "6px";
  el.style.margin = "8px 0 16px";
  el.style.background = isErr ? "#fee2e2" : "#ecfeff";
  el.style.color = isErr ? "#991b1b" : "#155e75";
}

// 8) Minimal stubs so other HTML handlers don’t crash yet
window.toggleMenuSort = () => {};
window.showMenuForm = () => {};
window.calculateProfit = () => {};

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

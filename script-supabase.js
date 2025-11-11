// script-supabase.js
// 1) Import Supabase ESM directly (no other <script> tags needed)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { unitConverter } from "./unit-converter.js";

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
const toSentenceCase = (str) => {
  if (!str) return '';
  str = str.trim().toLowerCase();
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Semantic ID helpers
function generateDescriptorFromName(name) {
  if (!name) return '';
  // Extract 4 significant characters (consonants + vowels)
  const cleaned = name.toUpperCase().replace(/[^A-Z]/g, '');
  return cleaned.substring(0, 4).padEnd(4, 'X');
}

async function getNextTagNumber(category, subcategory, descriptor, tableName) {
  if (!category || !subcategory || !descriptor) return '001';

  // Find all items with the same category-subcategory-descriptor prefix
  const { data, error } = await supabase
    .from(tableName)
    .select('tag_number')
    .eq('category_code', category)
    .eq('subcategory_code', subcategory)
    .eq('descriptor_code', descriptor)
    .order('tag_number', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return '001';

  const lastTag = parseInt(data[0].tag_number) || 0;
  const nextTag = lastTag + 1;
  return String(nextTag).padStart(3, '0');
}

window.generateIngredientSemanticId = async function() {
  const category = $('#ingredient-category')?.value;
  const subcategory = $('#ingredient-subcategory')?.value;
  const descriptor = $('#ingredient-descriptor')?.value;
  const tag = $('#ingredient-tag')?.value;

  // Auto-generate descriptor if not set
  if (category && subcategory && !descriptor) {
    const name = $('#ingredient-name')?.value;
    if (name) {
      const autoDescriptor = generateDescriptorFromName(name);
      $('#ingredient-descriptor').value = autoDescriptor;
    }
  }

  // Auto-suggest next tag number if not set
  const currentDescriptor = $('#ingredient-descriptor')?.value;
  if (category && subcategory && currentDescriptor && !tag) {
    const nextTag = await getNextTagNumber(category, subcategory, currentDescriptor, 'ingredients');
    $('#ingredient-tag').value = nextTag;
  }

  // Build the semantic ID
  const finalCategory = $('#ingredient-category')?.value;
  const finalSubcategory = $('#ingredient-subcategory')?.value;
  const finalDescriptor = $('#ingredient-descriptor')?.value;
  const finalTag = $('#ingredient-tag')?.value;

  if (finalCategory && finalSubcategory && finalDescriptor && finalTag) {
    const semanticId = `${finalCategory}-${finalSubcategory}-${finalDescriptor}-${finalTag}`;
    $('#ingredient-semantic-id-display').value = semanticId;
  } else {
    $('#ingredient-semantic-id-display').value = '';
  }
};

window.generateMenuSemanticId = async function() {
  const category = $('#menu-category')?.value;
  const subcategory = $('#menu-subcategory')?.value;
  const descriptor = $('#menu-descriptor')?.value;
  const tag = $('#menu-tag')?.value;

  // Auto-generate descriptor if not set
  if (category && subcategory && !descriptor) {
    const name = $('#menu-name')?.value;
    if (name) {
      const autoDescriptor = generateDescriptorFromName(name);
      $('#menu-descriptor').value = autoDescriptor;
    }
  }

  // Auto-suggest next tag number if not set
  const currentDescriptor = $('#menu-descriptor')?.value;
  if (category && subcategory && currentDescriptor && !tag) {
    const nextTag = await getNextTagNumber(category, subcategory, currentDescriptor, 'menu_items');
    $('#menu-tag').value = nextTag;
  }

  // Build the semantic ID
  const finalCategory = $('#menu-category')?.value;
  const finalSubcategory = $('#menu-subcategory')?.value;
  const finalDescriptor = $('#menu-descriptor')?.value;
  const finalTag = $('#menu-tag')?.value;

  if (finalCategory && finalSubcategory && finalDescriptor && finalTag) {
    const semanticId = `${finalCategory}-${finalSubcategory}-${finalDescriptor}-${finalTag}`;
    $('#menu-semantic-id-display').value = semanticId;
  } else {
    $('#menu-semantic-id-display').value = '';
  }
};

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
  // Check for URL query parameter first, then hash
  const urlParams = new URLSearchParams(window.location.search);
  const section = urlParams.get('section') || (location.hash || "#ingredients").slice(1);
  window.showSection(section);
  loadIngredients().catch(console.error);
});
window.addEventListener("hashchange", () =>
  window.showSection((location.hash || "#ingredients").slice(1))
);

// 6) Ingredients UI actions referenced by HTML
window.showIngredientForm = function () {
  $("#ingredient-form-card")?.classList.remove("hidden");
  $("#submit-btn").textContent = state.editingId ? "Update Ingredient" : "Add Ingredient";
  // Scroll to form
  setTimeout(() => {
    $("#ingredient-form-card")?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
};

window.cancelIngredientEdit = function () {
  $("#ingredient-form")?.reset();
  $("#ingredient-id").value = "";
  $("#ingredient-semantic-id-display").value = "";
  state.editingId = null;
  $("#submit-btn").textContent = "Add Ingredient";
  $("#ingredient-form-card")?.classList.add("hidden");
};

window.toggleIngredientSort = function () {
  state.ingredientSort = $("#ingredient-sort")?.value || "asc";
  loadIngredients();
};

window.saveIngredient = async function (e) {
  e.preventDefault();
  console.log("Save ingredient called");

  const id = $("#ingredient-id").value || null;
  const name = toSentenceCase($("#ingredient-name").value.trim());
  const quantity = parseFloat($("#ingredient-quantity").value);
  const unit = $("#ingredient-unit").value;
  const total_price = parseFloat($("#ingredient-price").value);
  const is_informational = $("#ingredient-informational")?.checked || false;
  const is_weekly_order = $("#ingredient-weekly-order")?.checked || false;

  // Semantic ID fields (optional)
  const category_code = $("#ingredient-category")?.value || null;
  const subcategory_code = $("#ingredient-subcategory")?.value || null;
  const descriptor_code = $("#ingredient-descriptor")?.value || null;
  const tag_number = $("#ingredient-tag")?.value || null;
  const semantic_id = $("#ingredient-semantic-id-display")?.value || null;

  console.log("Form values:", { name, quantity, unit, total_price, is_informational, semantic_id });

  if (!name || !quantity || !unit || isNaN(total_price)) {
    showNotification("Please fill in all required fields", "error");
    console.error("Validation failed");
    return;
  }

  // Check for duplicates (only among non-deleted ingredients)
  const { data: existingIngredients, error: checkError } = await supabase
    .from("ingredients")
    .select("id, name")
    .eq("is_deleted", false)
    .ilike("name", name);

  if (checkError) {
    showNotification("Error checking for duplicates: " + checkError.message, "error");
    return;
  }

  const duplicate = existingIngredients?.find(ing => ing.id !== parseInt(id));
  if (duplicate) {
    showNotification(`Ingredient "${name}" already exists!`, "error");
    return;
  }

  // derive price_per_unit on client (optional)
  const price_per_unit = total_price / quantity;

  try {
    console.log("Attempting to save to Supabase...");
    let ingredientId = id;

    const ingredientData = {
      name,
      quantity,
      unit,
      total_price,
      price_per_unit,
      is_informational,
      is_weekly_order,
      semantic_id,
      category_code,
      subcategory_code,
      descriptor_code,
      tag_number
    };

    if (id) {
      const { error } = await supabase
        .from("ingredients")
        .update(ingredientData)
        .eq("id", id);
      if (error) throw error;
      console.log("Update successful");
    } else {
      const { data, error } = await supabase
        .from("ingredients")
        .insert([ingredientData])
        .select();
      if (error) throw error;
      ingredientId = data[0].id;
      console.log("Insert successful");
    }

    // Log to price history
    await supabase
      .from("ingredient_price_history")
      .insert([{
        ingredient_id: ingredientId,
        ingredient_name: name,
        quantity,
        unit,
        total_price,
        price_per_unit,
        is_informational
      }]);

    window.cancelIngredientEdit();
    await loadIngredients();
    showNotification(id ? "Ingredient updated successfully!" : "Ingredient added successfully!", "success");
  } catch (err) {
    showNotification(`Save failed: ${err.message}`, "error");
    console.error("Save error:", err);
  }
};

// 7) Load + render ingredients table
async function loadIngredients() {
  const ascending = state.ingredientSort !== "desc";
  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .eq("is_deleted", false) // Only load non-deleted ingredients
    .order("name", { ascending });

  if (error) {
    showNotification(`Error loading data: ${error.message}`, "error");
    return;
  }

  const tbody = $("#ingredients-list");
  if (!tbody) return;

  tbody.innerHTML = (data || [])
    .map((row) => {
      const ppu = Number(row.price_per_unit ?? 0);
      const purchaseInfo = `${Number(row.quantity)} ${row.unit}`;

      const badges = [];
      if (row.is_informational) {
        badges.push('<span style="background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 6px;">INFO</span>');
      }
      if (row.is_weekly_order) {
        badges.push('<span style="background: #186B28; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 6px;">WEEKLY</span>');
      }

      const semanticIdDisplay = row.semantic_id
        ? `<span style="font-weight: 600; color: #186B28; font-family: monospace;">${escapeHtml(row.semantic_id)}</span>`
        : '<span style="color: #999; font-style: italic;">-</span>';
      return `
        <tr>
          <td>${semanticIdDisplay}</td>
          <td>${escapeHtml(row.name)}${badges.join('')}</td>
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
    showNotification(`Load failed: ${error.message}`, "error");
    return;
  }
  state.editingId = id;
  $("#ingredient-id").value = id;
  $("#ingredient-name").value = data.name || "";
  $("#ingredient-quantity").value = data.quantity ?? "";
  $("#ingredient-unit").value = data.unit || "";
  $("#ingredient-price").value = data.total_price ?? "";
  $("#ingredient-informational").checked = data.is_informational || false;
  $("#ingredient-weekly-order").checked = data.is_weekly_order || false;

  // Populate semantic ID fields
  $("#ingredient-category").value = data.category_code || "";
  $("#ingredient-subcategory").value = data.subcategory_code || "";
  $("#ingredient-descriptor").value = data.descriptor_code || "";
  $("#ingredient-tag").value = data.tag_number || "";
  $("#ingredient-semantic-id-display").value = data.semantic_id || "";

  $("#submit-btn").textContent = "Update Ingredient";
  $("#ingredient-form-card")?.classList.remove("hidden");
  // Scroll to form
  setTimeout(() => {
    $("#ingredient-form-card")?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

async function delIngredient(id) {
  if (!confirm("Delete this ingredient?")) return;
  try {
    // Logical deletion: set is_deleted = true instead of actual deletion
    const { error } = await supabase
      .from("ingredients")
      .update({ is_deleted: true })
      .eq("id", id);

    if (error) throw error;

    // Also mark related menu_item_ingredients as deleted
    await supabase
      .from("menu_item_ingredients")
      .update({ is_deleted: true })
      .eq("ingredient_id", id);

    await loadIngredients();
    showNotification("Ingredient deleted successfully!", "success");
  } catch (err) {
    showNotification(`Delete failed: ${err.message}`, "error");
  }
}

// Better notification system
function showNotification(message, type = "success") {
  // Remove existing notification
  const existing = document.getElementById("notification-popup");
  if (existing) existing.remove();

  // Create notification
  const notification = document.createElement("div");
  notification.id = "notification-popup";
  notification.className = `notification notification-${type}`;

  const icon = type === "success" ? "✓" : "✕";
  const iconColor = type === "success" ? "#186B28" : "#ef4444";

  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon" style="color: ${iconColor};">${icon}</span>
      <span class="notification-message">${message}</span>
    </div>
  `;

  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => notification.classList.add("show"), 10);

  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// 8) Menu Items State
const menuState = {
  editingId: null,
  sortMode: "name",
  ingredients: [],
  subRecipes: []
};

// 9) Menu Items Functions
window.toggleMenuSort = function () {
  menuState.sortMode = $("#menu-sort")?.value || "name";
  loadMenuItems();
};

window.showMenuForm = async function () {
  // Navigate to the add-menu-item page
  window.location.href = 'add-menu-item.html';
};

window.renderMenuForm = async function renderMenuForm(menuItemId = null) {
  const isEdit = !!menuItemId;
  let existingData = null;

  if (isEdit) {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("id", menuItemId)
      .eq("is_deleted", false)
      .single();

    if (error) {
      showNotification(`Load failed: ${error.message}`, "error");
      return;
    }
    existingData = data;

    // Load ingredients (only non-deleted)
    const { data: ingredientsData } = await supabase
      .from("menu_item_ingredients")
      .select("*")
      .eq("menu_item_id", menuItemId)
      .eq("is_deleted", false);

    menuState.ingredients = ingredientsData || [];

    // Load sub-recipes (only non-deleted)
    const { data: subRecipesData } = await supabase
      .from("menu_item_subrecipes")
      .select("*")
      .eq("menu_item_id", menuItemId)
      .eq("is_deleted", false);

    menuState.subRecipes = subRecipesData || [];
  } else {
    menuState.ingredients = [];
    menuState.subRecipes = [];
  }

  // Get all ingredients for dropdown (only non-deleted)
  const { data: allIngredients } = await supabase
    .from("ingredients")
    .select("*")
    .eq("is_deleted", false)
    .order("name");

  // Get all sub-recipes for dropdown (only non-deleted)
  const { data: allSubRecipes } = await supabase
    .from("menu_items")
    .select("*")
    .eq("is_sub_recipe", true)
    .eq("is_deleted", false)
    .order("name");

  // Generate ingredient rows
  let ingredientRows = '';
  if (menuState.ingredients.length > 0) {
    ingredientRows = menuState.ingredients.map(ing => {
      const ingredient = (allIngredients || []).find(i => i.id === ing.ingredient_id);
      const purchaseUnit = ingredient?.unit || ing.unit;

      return `
      <div class="form-row ingredient-row" data-purchase-unit="${purchaseUnit}">
        <div class="form-group">
          <label>Ingredient</label>
          <select class="menu-ingredient-select" required onchange="updateIngredientOptions(this)">
            <option value="">Select Ingredient</option>
            ${(allIngredients || []).map(i => {
              return `<option value="${i.id}" ${i.id === ing.ingredient_id ? 'selected' : ''}>${escapeHtml(i.name)} (${i.unit} @ ${fmtMoney(i.price_per_unit)})</option>`;
            }).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Amount <span class="qty-optional" style="color: #999; display: none;">(optional)</span></label>
          <input type="number" class="menu-ingredient-qty" step="0.01" min="0.01" value="${ing.quantity || ''}" placeholder="Leave blank for info only">
        </div>
        <div class="form-group">
          <label>Unit</label>
          <select class="menu-ingredient-unit">
            ${getUnitOptions(purchaseUnit, ing.unit)}
          </select>
        </div>
        <div class="form-group" style="display: flex; align-items: flex-end; flex-direction: column; gap: 5px;">
          <label style="font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
            <input type="checkbox" class="menu-ingredient-info" ${ing.is_informational ? 'checked' : ''} style="width: auto; margin: 0;" onchange="toggleQuantityRequired(this)">
            <span>Info only</span>
          </label>
          <button type="button" class="btn btn-danger" onclick="removeIngredientRow(this)">Remove</button>
        </div>
      </div>
    `;
    }).join('');
  } else {
    ingredientRows = `
      <div class="form-row ingredient-row">
        <div class="form-group">
          <label>Ingredient</label>
          <select class="menu-ingredient-select" required onchange="updateIngredientOptions(this)">
            <option value="">Select Ingredient</option>
            ${(allIngredients || []).map(i => {
              return `<option value="${i.id}">${escapeHtml(i.name)} (${i.unit} @ ${fmtMoney(i.price_per_unit)})</option>`;
            }).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Amount <span class="qty-optional" style="color: #999; display: none;">(optional)</span></label>
          <input type="number" class="menu-ingredient-qty" step="0.01" min="0.01" placeholder="Leave blank for info only">
        </div>
        <div class="form-group">
          <label>Unit</label>
          <select class="menu-ingredient-unit">
            <option value="">-</option>
          </select>
        </div>
        <div class="form-group" style="display: flex; align-items: flex-end; flex-direction: column; gap: 5px;">
          <label style="font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
            <input type="checkbox" class="menu-ingredient-info" style="width: auto; margin: 0;" onchange="toggleQuantityRequired(this)">
            <span>Info only</span>
          </label>
          <button type="button" class="btn btn-danger" onclick="removeIngredientRow(this)">Remove</button>
        </div>
      </div>
    `;
  }

  function getUnitOptions(purchaseUnit, selectedUnit = null) {
    const category = unitConverter.getCategory(purchaseUnit);
    let options = [`<option value="${purchaseUnit}" ${selectedUnit === purchaseUnit ? 'selected' : ''}>${purchaseUnit}</option>`];

    if (category === 'weight') {
      const units = ['kg', 'g', 'lb', 'oz'];
      options = units.map(u => `<option value="${u}" ${selectedUnit === u ? 'selected' : ''}>${u}</option>`).join('');
    } else if (category === 'volume') {
      const units = ['L', 'ml', 'cup', 'tbsp', 'tsp'];
      options = units.map(u => `<option value="${u}" ${selectedUnit === u ? 'selected' : ''}>${u}</option>`).join('');
    }

    return options;
  }

  // Generate sub-recipe rows
  let subRecipeRows = '';
  if (menuState.subRecipes.length > 0) {
    subRecipeRows = menuState.subRecipes.map(sr => `
      <div class="form-row sub-recipe-row">
        <div class="form-group">
          <label>Sub-Recipe</label>
          <select class="menu-subrecipe-select" required>
            <option value="">Select Sub-Recipe</option>
            ${(allSubRecipes || []).map(item => `<option value="${item.id}" ${item.id === sr.sub_recipe_id ? 'selected' : ''}>${escapeHtml(item.name)} (${fmtMoney(item.total_cost)})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Quantity</label>
          <input type="number" class="menu-subrecipe-qty" step="0.01" required min="0.01" value="${sr.quantity}" placeholder="1">
        </div>
        <div class="form-group" style="display: flex; align-items: flex-end;">
          <button type="button" class="btn btn-danger" onclick="removeSubRecipeRow(this)">Remove</button>
        </div>
      </div>
    `).join('');
  }

  const formHtml = `
    <h2>${isEdit ? "Edit Menu Item" : "Add Menu Item"}</h2>
    <form id="menu-item-form" onsubmit="saveMenuItem(event)">
      <input type="hidden" id="menu-item-id" value="${existingData?.id || ""}">

      <div class="form-row">
        <div class="form-group">
          <label>Dish Name *</label>
          <input type="text" id="menu-item-name" required placeholder="e.g., Caesar Salad" value="${existingData?.name || ""}">
        </div>
        <div class="form-group">
          <label>Sale Price ($)</label>
          <input type="number" id="menu-item-sale-price" step="0.01" min="0" placeholder="Optional" value="${existingData?.sale_price || ""}">
        </div>
      </div>

      <div class="form-group" style="margin: 15px 0;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" id="menu-item-is-sub-recipe" ${existingData?.is_sub_recipe ? "checked" : ""} style="width: auto;">
          <span>Can be used as a component in other dishes (sub-recipe)</span>
        </label>
      </div>

      <h3 style="color: #2d3748; font-size: 16px; margin: 20px 0 10px 0; padding-top: 15px; border-top: 2px solid #e2e8f0;">Semantic ID (Optional)</h3>
      <p style="font-size: 13px; color: #666; margin-bottom: 15px;">Format: CATEGORY-SUBCATEGORY-DESCRIPTOR-TAG (e.g., MAIN-SOUP-LASK-102)</p>

      <div class="form-row">
        <div class="form-group">
          <label>Category</label>
          <select id="menu-category" onchange="generateMenuSemanticId()">
            <option value="">No ID</option>
            <option value="MAIN" ${existingData?.category_code === 'MAIN' ? 'selected' : ''}>MAIN - Main Course</option>
            <option value="APP" ${existingData?.category_code === 'APP' ? 'selected' : ''}>APP - Appetizer</option>
            <option value="SIDE" ${existingData?.category_code === 'SIDE' ? 'selected' : ''}>SIDE - Side Dish</option>
            <option value="DESS" ${existingData?.category_code === 'DESS' ? 'selected' : ''}>DESS - Dessert</option>
            <option value="BVRG" ${existingData?.category_code === 'BVRG' ? 'selected' : ''}>BVRG - Beverage</option>
            <option value="SALAD" ${existingData?.category_code === 'SALAD' ? 'selected' : ''}>SALAD - Salad</option>
            <option value="SOUP" ${existingData?.category_code === 'SOUP' ? 'selected' : ''}>SOUP - Soup</option>
            <option value="SUB" ${existingData?.category_code === 'SUB' ? 'selected' : ''}>SUB - Sub-Recipe/Component</option>
            <option value="OTHER" ${existingData?.category_code === 'OTHER' ? 'selected' : ''}>OTHER - Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>Sub-Category</label>
          <select id="menu-subcategory" onchange="generateMenuSemanticId()">
            <option value="">Select</option>
            <option value="SOUP" ${existingData?.subcategory_code === 'SOUP' ? 'selected' : ''}>SOUP - Soup</option>
            <option value="NOODL" ${existingData?.subcategory_code === 'NOODL' ? 'selected' : ''}>NOODL - Noodles</option>
            <option value="RICE" ${existingData?.subcategory_code === 'RICE' ? 'selected' : ''}>RICE - Rice Dish</option>
            <option value="CURRY" ${existingData?.subcategory_code === 'CURRY' ? 'selected' : ''}>CURRY - Curry</option>
            <option value="GRILL" ${existingData?.subcategory_code === 'GRILL' ? 'selected' : ''}>GRILL - Grilled</option>
            <option value="FRY" ${existingData?.subcategory_code === 'FRY' ? 'selected' : ''}>FRY - Fried</option>
            <option value="STEAM" ${existingData?.subcategory_code === 'STEAM' ? 'selected' : ''}>STEAM - Steamed</option>
            <option value="BAKE" ${existingData?.subcategory_code === 'BAKE' ? 'selected' : ''}>BAKE - Baked</option>
            <option value="RAW" ${existingData?.subcategory_code === 'RAW' ? 'selected' : ''}>RAW - Raw/Fresh</option>
          </select>
        </div>
        <div class="form-group">
          <label>Descriptor (4 chars)</label>
          <input type="text" id="menu-descriptor" maxlength="4" placeholder="LASK" value="${existingData?.descriptor_code || ''}" style="text-transform: uppercase;" oninput="this.value = this.value.toUpperCase(); generateMenuSemanticId()">
        </div>
        <div class="form-group">
          <label>Tag Number (3 digits)</label>
          <input type="text" id="menu-tag" maxlength="3" placeholder="001" value="${existingData?.tag_number || ''}" oninput="generateMenuSemanticId()">
        </div>
      </div>

      <div class="form-group">
        <label>Generated Semantic ID</label>
        <input type="text" id="menu-semantic-id-display" readonly value="${existingData?.semantic_id || ''}" style="background: #f7fafc; font-weight: 600; color: #186B28;">
      </div>

      <h3 style="margin: 15px 0 10px 0; color: #2d3748; font-size: 16px;">Raw Ingredients</h3>
      <div id="menu-ingredients">
        ${ingredientRows}
      </div>
      <button type="button" class="btn btn-success" onclick="addMenuIngredientRow()" style="margin-bottom: 20px;">Add Raw Ingredient</button>

      <h3 style="margin: 15px 0 10px 0; color: #2d3748; font-size: 16px;">Sub-Recipes (Optional)</h3>
      <p style="color: #666; font-size: 13px; margin-bottom: 10px;">Add other menu items marked as sub-recipes</p>
      <div id="menu-subrecipes">
        ${subRecipeRows}
      </div>
      <button type="button" class="btn btn-success" onclick="addMenuSubRecipeRow()">Add Sub-Recipe</button>

      <div class="actions" style="margin-top: 20px;">
        <button type="button" class="btn btn-secondary" onclick="cancelMenuEdit()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? "Update" : "Save"} Menu Item</button>
      </div>
    </form>
  `;

  $("#menu-form-container").innerHTML = formHtml;
}

window.toggleQuantityRequired = function(checkbox) {
  const row = checkbox.closest('.ingredient-row');
  const qtyInput = row.querySelector('.menu-ingredient-qty');
  const qtyOptional = row.querySelector('.qty-optional');
  const unitSelect = row.querySelector('.menu-ingredient-unit');

  if (checkbox.checked) {
    // Info only mode - quantity is optional
    qtyInput.removeAttribute('required');
    qtyInput.placeholder = "Leave blank for info only";
    qtyOptional.style.display = 'inline';
    unitSelect.removeAttribute('required');
  } else {
    // Regular mode - quantity is required
    qtyInput.setAttribute('required', 'required');
    qtyInput.placeholder = "0.00";
    qtyOptional.style.display = 'none';
    unitSelect.setAttribute('required', 'required');
  }
};

window.updateIngredientOptions = function(selectElement) {
  const row = selectElement.closest('.ingredient-row');
  const ingredientId = parseInt(selectElement.value);

  supabase
    .from("ingredients")
    .select("*")
    .eq("id", ingredientId)
    .eq("is_deleted", false)
    .single()
    .then(({ data: ingredient }) => {
      if (ingredient) {
        row.setAttribute('data-purchase-unit', ingredient.unit);
        row.setAttribute('data-purchase-qty', ingredient.quantity);
        row.setAttribute('data-purchase-price', ingredient.total_price);
        row.setAttribute('data-price-per-unit', ingredient.price_per_unit);

        // Update unit dropdown
        const unitSelect = row.querySelector('.menu-ingredient-unit');
        const category = unitConverter.getCategory(ingredient.unit);
        let options = '';

        if (category === 'weight') {
          const units = ['kg', 'g', 'lb', 'oz'];
          options = units.map(u => `<option value="${u}">${u}</option>`).join('');
        } else if (category === 'volume') {
          const units = ['L', 'ml', 'cup', 'tbsp', 'tsp'];
          options = units.map(u => `<option value="${u}">${u}</option>`).join('');
        } else {
          options = `<option value="${ingredient.unit}">${ingredient.unit}</option>`;
        }

        unitSelect.innerHTML = options;
        unitSelect.value = ingredient.unit;

        // Handle informational checkbox
        const infoCheckbox = row.querySelector('.menu-ingredient-info');
        if (ingredient.is_informational) {
          // If ingredient is "always informational", check and disable the box
          infoCheckbox.checked = true;
          infoCheckbox.disabled = true;
          infoCheckbox.parentElement.title = "This ingredient is marked as 'Always informational'";
        } else {
          // Otherwise, enable it for per-usage control
          infoCheckbox.disabled = false;
          infoCheckbox.parentElement.title = "";
        }
      }
    });
};

window.addMenuIngredientRow = async function() {
  const container = $("#menu-ingredients");
  const { data: allIngredients } = await supabase
    .from("ingredients")
    .select("*")
    .order("name");

  const row = document.createElement('div');
  row.className = 'form-row ingredient-row';
  row.innerHTML = `
    <div class="form-group">
      <label>Ingredient</label>
      <select class="menu-ingredient-select" required onchange="updateIngredientOptions(this)">
        <option value="">Select Ingredient</option>
        ${(allIngredients || []).map(i => {
          return `<option value="${i.id}">${escapeHtml(i.name)} (${i.unit} @ ${fmtMoney(i.price_per_unit)})</option>`;
        }).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Amount <span class="qty-optional" style="color: #999; display: none;">(optional)</span></label>
      <input type="number" class="menu-ingredient-qty" step="0.01" min="0.01" placeholder="Leave blank for info only">
    </div>
    <div class="form-group">
      <label>Unit</label>
      <select class="menu-ingredient-unit">
        <option value="">-</option>
      </select>
    </div>
    <div class="form-group" style="display: flex; align-items: flex-end; flex-direction: column; gap: 5px;">
      <label style="font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
        <input type="checkbox" class="menu-ingredient-info" style="width: auto; margin: 0;" onchange="toggleQuantityRequired(this)">
        <span>Info only</span>
      </label>
      <button type="button" class="btn btn-danger" onclick="removeIngredientRow(this)">Remove</button>
    </div>
  `;
  container.appendChild(row);
};

window.removeIngredientRow = function(button) {
  const row = button.closest('.ingredient-row');
  row.remove();
};

window.addMenuSubRecipeRow = async function() {
  const container = $("#menu-subrecipes");
  const { data: allSubRecipes } = await supabase
    .from("menu_items")
    .select("*")
    .eq("is_sub_recipe", true)
    .eq("is_deleted", false)
    .order("name");

  if (!allSubRecipes || allSubRecipes.length === 0) {
    alert('No sub-recipes available. Please mark menu items as sub-recipes first.');
    return;
  }

  const row = document.createElement('div');
  row.className = 'form-row sub-recipe-row';
  row.innerHTML = `
    <div class="form-group">
      <label>Sub-Recipe</label>
      <select class="menu-subrecipe-select" required>
        <option value="">Select Sub-Recipe</option>
        ${allSubRecipes.map(item => `<option value="${item.id}">${escapeHtml(item.name)} (${fmtMoney(item.total_cost)})</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Quantity</label>
      <input type="number" class="menu-subrecipe-qty" step="0.01" required min="0.01" placeholder="1">
    </div>
    <div class="form-group" style="display: flex; align-items: flex-end;">
      <button type="button" class="btn btn-danger" onclick="removeSubRecipeRow(this)">Remove</button>
    </div>
  `;
  container.appendChild(row);
};

window.removeSubRecipeRow = function(button) {
  const row = button.closest('.sub-recipe-row');
  row.remove();
};

window.cancelMenuEdit = function () {
  // Navigate back to the main page menu section
  window.location.href = 'index.html?section=menu';
};

window.saveMenuItem = async function (e) {
  e.preventDefault();
  console.log("Save menu item called");

  const id = $("#menu-item-id")?.value || null;
  const name = toSentenceCase($("#menu-item-name")?.value.trim());
  const isSubRecipe = $("#menu-item-is-sub-recipe")?.checked || false;
  const salePrice = parseFloat($("#menu-item-sale-price")?.value) || null;

  // Semantic ID fields (optional)
  const category_code = $("#menu-category")?.value || null;
  const subcategory_code = $("#menu-subcategory")?.value || null;
  const descriptor_code = $("#menu-descriptor")?.value || null;
  const tag_number = $("#menu-tag")?.value || null;
  const semantic_id = $("#menu-semantic-id-display")?.value || null;

  if (!name) {
    showNotification("Please enter an item name", "error");
    return;
  }

  // Check for duplicates
  const { data: existingItems, error: checkError } = await supabase
    .from("menu_items")
    .select("id, name")
    .ilike("name", name)
    .eq("is_deleted", false);

  if (checkError) {
    showNotification("Error checking for duplicates: " + checkError.message, "error");
    return;
  }

  const duplicate = existingItems?.find(item => item.id !== parseInt(id));
  if (duplicate) {
    showNotification(`Menu item "${name}" already exists!`, "error");
    return;
  }

  // Collect ingredients from rows
  const ingredientRows = document.querySelectorAll('.ingredient-row');
  const ingredients = [];

  for (const row of ingredientRows) {
    const ingredientId = parseInt(row.querySelector('.menu-ingredient-select').value);
    const quantityInput = row.querySelector('.menu-ingredient-qty').value;
    const quantity = quantityInput ? parseFloat(quantityInput) : null;
    const useUnit = row.querySelector('.menu-ingredient-unit')?.value;
    const isInformational = row.querySelector('.menu-ingredient-info')?.checked || false;

    // Skip if no ingredient selected
    if (!ingredientId) continue;

    // For informational-only ingredients, quantity is optional
    if (isInformational && (!quantity || quantity <= 0)) {
      // Add ingredient without quantity (just for tracking)
      const { data: ingredient } = await supabase
        .from("ingredients")
        .select("*")
        .eq("id", ingredientId)
        .eq("is_deleted", false)
        .single();

      if (ingredient) {
        ingredients.push({
          ingredient_id: ingredientId,
          ingredient_name: ingredient.name,
          quantity: null, // No quantity specified
          unit: null, // No unit needed
          price_per_unit: 0,
          cost: 0,
          is_informational: true
        });
      }
      continue;
    }

    // For regular ingredients, quantity is required
    if (!quantity || quantity <= 0 || !useUnit) {
      showNotification("Please enter quantity and unit for all non-informational ingredients", "error");
      return;
    }

    const { data: ingredient } = await supabase
      .from("ingredients")
      .select("*")
      .eq("id", ingredientId)
      .eq("is_deleted", false)
      .single();

    if (ingredient) {
      // If ingredient is marked as "always informational" OR user checked "info only" for this usage
      const isInfoForThisUse = ingredient.is_informational || isInformational;

      // Calculate cost with unit conversion (but not for informational usage)
      const cost = isInfoForThisUse ? 0 : unitConverter.calculateCost(
        ingredient.quantity,
        ingredient.unit,
        ingredient.total_price,
        quantity,
        useUnit
      );

      ingredients.push({
        ingredient_id: ingredientId,
        ingredient_name: ingredient.name,
        quantity: quantity,
        unit: useUnit,
        price_per_unit: cost / quantity,
        cost: cost,
        is_informational: isInfoForThisUse
      });
    }
  }

  // Collect sub-recipes from rows
  const subRecipeRows = document.querySelectorAll('.sub-recipe-row');
  const subRecipes = [];

  for (const row of subRecipeRows) {
    const subRecipeId = parseInt(row.querySelector('.menu-subrecipe-select').value);
    const quantity = parseFloat(row.querySelector('.menu-subrecipe-qty').value);

    if (subRecipeId && quantity > 0) {
      const { data: subRecipe } = await supabase
        .from("menu_items")
        .select("*")
        .eq("id", subRecipeId)
        .eq("is_deleted", false)
        .single();

      if (subRecipe) {
        subRecipes.push({
          sub_recipe_id: subRecipeId,
          sub_recipe_name: subRecipe.name,
          quantity: quantity,
          cost_per_unit: subRecipe.total_cost,
          cost: quantity * subRecipe.total_cost
        });
      }
    }
  }

  // Check if at least one component is added
  if (ingredients.length === 0 && subRecipes.length === 0) {
    showNotification("Please add at least one ingredient or sub-recipe", "error");
    return;
  }

  // Calculate total cost
  const ingredientsCost = ingredients.reduce((sum, ing) => sum + ing.cost, 0);
  const subRecipesCost = subRecipes.reduce((sum, sr) => sum + sr.cost, 0);
  const totalCost = ingredientsCost + subRecipesCost;

  try {
    console.log("Saving menu item...");

    let menuItemId = id;

    const menuItemData = {
      name,
      total_cost: totalCost,
      is_sub_recipe: isSubRecipe,
      sale_price: salePrice,
      semantic_id,
      category_code,
      subcategory_code,
      descriptor_code,
      tag_number
    };

    if (id) {
      // Update existing
      const { error: updateError } = await supabase
        .from("menu_items")
        .update(menuItemData)
        .eq("id", id);

      if (updateError) throw updateError;

      // Mark existing ingredients and sub-recipes as deleted (logical deletion)
      await supabase
        .from("menu_item_ingredients")
        .update({ is_deleted: true })
        .eq("menu_item_id", id);

      await supabase
        .from("menu_item_subrecipes")
        .update({ is_deleted: true })
        .eq("menu_item_id", id);
    } else {
      // Insert new
      const { data: newItem, error: insertError } = await supabase
        .from("menu_items")
        .insert([menuItemData])
        .select();

      if (insertError) throw insertError;
      menuItemId = newItem[0].id;
    }

    // Insert ingredients
    if (ingredients.length > 0) {
      const ingredientsToInsert = ingredients.map(ing => ({
        menu_item_id: menuItemId,
        ingredient_id: ing.ingredient_id,
        ingredient_name: ing.ingredient_name,
        quantity: ing.quantity,
        unit: ing.unit,
        price_per_unit: ing.price_per_unit,
        cost: ing.cost,
        is_informational: ing.is_informational
      }));

      const { error: ingError } = await supabase
        .from("menu_item_ingredients")
        .insert(ingredientsToInsert);

      if (ingError) throw ingError;
    }

    // Insert sub-recipes
    if (subRecipes.length > 0) {
      const subRecipesToInsert = subRecipes.map(sr => ({
        menu_item_id: menuItemId,
        sub_recipe_id: sr.sub_recipe_id,
        sub_recipe_name: sr.sub_recipe_name,
        quantity: sr.quantity,
        cost_per_unit: sr.cost_per_unit,
        cost: sr.cost
      }));

      const { error: srError } = await supabase
        .from("menu_item_subrecipes")
        .insert(subRecipesToInsert);

      if (srError) throw srError;
    }

    console.log("Menu item saved successfully");

    // Log to price history
    const cogsPercent = salePrice ? ((totalCost / salePrice) * 100) : null;
    await supabase
      .from("menu_item_price_history")
      .insert([{
        menu_item_id: menuItemId,
        menu_item_name: name,
        total_cost: totalCost,
        sale_price: salePrice,
        cogs_percent: cogsPercent
      }]);

    window.cancelMenuEdit();
    await loadMenuItems();
    showNotification(id ? "Menu item updated successfully!" : "Menu item added successfully!", "success");
  } catch (err) {
    showNotification(`Save failed: ${err.message}`, "error");
    console.error("Save menu item error:", err);
  }
};

async function loadMenuItems() {
  console.log("Loading menu items...");

  const { data: items, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("is_deleted", false); // Only load non-deleted menu items

  if (error) {
    showNotification(`Error loading menu items: ${error.message}`, "error");
    return;
  }

  // Sort items
  let sortedItems = items || [];
  if (menuState.sortMode === "name") {
    sortedItems.sort((a, b) => a.name.localeCompare(b.name));
  } else if (menuState.sortMode === "cogs-asc") {
    sortedItems.sort((a, b) => {
      const cogsA = a.sale_price ? (a.total_cost / a.sale_price) * 100 : 0;
      const cogsB = b.sale_price ? (b.total_cost / b.sale_price) * 100 : 0;
      return cogsA - cogsB;
    });
  } else if (menuState.sortMode === "cogs-desc") {
    sortedItems.sort((a, b) => {
      const cogsA = a.sale_price ? (a.total_cost / a.sale_price) * 100 : 0;
      const cogsB = b.sale_price ? (b.total_cost / b.sale_price) * 100 : 0;
      return cogsB - cogsA;
    });
  }

  const tbody = $("#menu-items-list");
  if (!tbody) return;

  tbody.innerHTML = sortedItems
    .map((item) => {
      const cogs = item.sale_price ? ((item.total_cost / item.sale_price) * 100).toFixed(1) : "N/A";
      const cogsClass = item.sale_price && (item.total_cost / item.sale_price) > 0.35 ? "high-cogs" : "";

      // Build breakdown HTML
      let breakdownHTML = '';

      // We need to fetch ingredients and sub-recipes for breakdown
      // Since we can't await here, we'll use a data attribute and fetch on expand

      const semanticIdDisplay = item.semantic_id
        ? `<span style="font-weight: 600; color: #186B28; font-family: monospace;">${escapeHtml(item.semantic_id)}</span>`
        : '<span style="color: #999; font-style: italic;">-</span>';

      return `
        <tr class="menu-item-row" data-menu-id="${item.id}">
          <td>
            <button class="btn-icon dropdown-toggle" onclick="toggleBreakdown(${item.id})" title="Show/Hide Breakdown">
              <span class="dropdown-arrow" id="arrow-${item.id}">▶</span>
            </button>
          </td>
          <td>${semanticIdDisplay}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${item.is_sub_recipe ? '<span style="background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">SUB</span>' : ""}
              <strong>${escapeHtml(item.name)}</strong>
            </div>
            <div class="menu-breakdown hidden" id="breakdown-${item.id}" style="margin-top: 8px; font-size: 13px; color: #666;">
              <span class="loading-breakdown">Loading breakdown...</span>
            </div>
          </td>
          <td>${fmtMoney(item.total_cost)}</td>
          <td>${item.sale_price ? fmtMoney(item.sale_price) : "-"}</td>
          <td class="${cogsClass}">${cogs}${typeof cogs === "number" || cogs !== "N/A" ? "%" : ""}</td>
          <td>
            <button class="btn btn-secondary" data-edit-menu="${item.id}">Edit</button>
            <button class="btn btn-danger" data-del-menu="${item.id}">Delete</button>
          </td>
        </tr>
      `;
    })
    .join("");

  // Wire buttons
  tbody.querySelectorAll("[data-edit-menu]").forEach((btn) =>
    btn.addEventListener("click", () => startMenuEdit(btn.getAttribute("data-edit-menu")))
  );
  tbody.querySelectorAll("[data-del-menu]").forEach((btn) =>
    btn.addEventListener("click", () => deleteMenuItem(btn.getAttribute("data-del-menu")))
  );
}

window.toggleBreakdown = async function(menuItemId) {
  const breakdownDiv = $(`#breakdown-${menuItemId}`);
  const arrow = $(`#arrow-${menuItemId}`);

  if (!breakdownDiv) return;

  // Toggle visibility
  const isHidden = breakdownDiv.classList.contains('hidden');

  if (isHidden) {
    // Load breakdown if not already loaded
    if (breakdownDiv.innerHTML.includes('Loading breakdown')) {
      await loadMenuBreakdown(menuItemId);
    }
    breakdownDiv.classList.remove('hidden');
    arrow.classList.add('rotated');
    arrow.textContent = '▼';
  } else {
    breakdownDiv.classList.add('hidden');
    arrow.classList.remove('rotated');
    arrow.textContent = '▶';
  }
};

async function loadMenuBreakdown(menuItemId) {
  const breakdownDiv = $(`#breakdown-${menuItemId}`);
  if (!breakdownDiv) return;

  try {
    // Load ingredients
    const { data: ingredients } = await supabase
      .from("menu_item_ingredients")
      .select("*")
      .eq("menu_item_id", menuItemId)
      .eq("is_deleted", false);

    // Load sub-recipes
    const { data: subRecipes } = await supabase
      .from("menu_item_subrecipes")
      .select("*")
      .eq("menu_item_id", menuItemId)
      .eq("is_deleted", false);

    let breakdownHTML = '';

    if (ingredients && ingredients.length > 0) {
      breakdownHTML += ingredients.map(ing => {
        const costDisplay = ing.is_informational ? 'Info only' : fmtMoney(ing.cost);
        const qtyDisplay = ing.quantity ? `${ing.quantity} ${ing.unit}` : 'contains';
        return `${escapeHtml(ing.ingredient_name)}: ${qtyDisplay} (${costDisplay})`;
      }).join(' • ');
    }

    if (subRecipes && subRecipes.length > 0) {
      if (breakdownHTML) breakdownHTML += ' • ';
      breakdownHTML += subRecipes.map(sr =>
        `${escapeHtml(sr.sub_recipe_name)}: ${sr.quantity}x (${fmtMoney(sr.cost)})`
      ).join(' • ');
    }

    if (!breakdownHTML) {
      breakdownHTML = 'No components';
    }

    breakdownDiv.innerHTML = breakdownHTML;
  } catch (err) {
    breakdownDiv.innerHTML = 'Error loading breakdown';
  }
}

async function startMenuEdit(id) {
  // Navigate to the add-menu-item page with the ID
  window.location.href = `add-menu-item.html?id=${id}`;
}

async function deleteMenuItem(id) {
  if (!confirm("Delete this menu item?")) return;

  try {
    // Logical deletion: set is_deleted = true instead of actual deletion
    const { error } = await supabase
      .from("menu_items")
      .update({ is_deleted: true })
      .eq("id", id);

    if (error) throw error;

    // Cascade: also mark related menu_item_ingredients as deleted
    await supabase
      .from("menu_item_ingredients")
      .update({ is_deleted: true })
      .eq("menu_item_id", id);

    // Cascade: also mark related menu_item_subrecipes as deleted
    await supabase
      .from("menu_item_subrecipes")
      .update({ is_deleted: true })
      .eq("menu_item_id", id);

    // Also mark as deleted where this item is used as a sub-recipe in other dishes
    await supabase
      .from("menu_item_subrecipes")
      .update({ is_deleted: true })
      .eq("sub_recipe_id", id);

    await loadMenuItems();
    showNotification("Menu item deleted successfully!", "success");
  } catch (err) {
    showNotification(`Delete failed: ${err.message}`, "error");
  }
}

// 10) Dashboard Trends Functions
window.loadTrends = async function() {
  const period = $("#trends-period")?.value || "30";
  await loadDashboardSummary(period);
  await loadPriceChanges(period);
  await loadTopChanges(period);
};

async function loadDashboardSummary(period) {
  try {
    // Check if dashboard elements exist (only on main page)
    if (!$("#summary-total-ingredients")) return;

    // Get current ingredients and menu items (only non-deleted)
    const { data: ingredients } = await supabase
      .from("ingredients")
      .select("*")
      .eq("is_deleted", false);

    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("*")
      .eq("is_deleted", false);

    // Calculate averages
    const avgIngredientCost = ingredients?.length > 0
      ? ingredients.reduce((sum, ing) => sum + (ing.total_price || 0), 0) / ingredients.length
      : 0;

    const avgMenuCost = menuItems?.length > 0
      ? menuItems.reduce((sum, item) => sum + (item.total_cost || 0), 0) / menuItems.length
      : 0;

    const menuItemsWithSales = menuItems?.filter(item => item.sale_price > 0) || [];
    const avgCOGS = menuItemsWithSales.length > 0
      ? menuItemsWithSales.reduce((sum, item) => sum + ((item.total_cost / item.sale_price) * 100), 0) / menuItemsWithSales.length
      : 0;

    // Update summary cards
    $("#summary-total-ingredients").textContent = ingredients?.length || 0;
    $("#summary-avg-ingredient-cost").textContent = fmtMoney(avgIngredientCost);
    $("#summary-total-menu-items").textContent = menuItems?.length || 0;
    $("#summary-avg-menu-cost").textContent = fmtMoney(avgMenuCost);
    $("#summary-avg-cogs").textContent = avgCOGS.toFixed(1) + '%';
  } catch (err) {
    console.error('Dashboard summary error:', err);
  }
}

async function loadPriceChanges(period) {
  try {
    // Check if element exists
    if (!$("#price-changes-list")) return;

    const cutoffDate = getCutoffDate(period);

    // Get ingredient price changes
    let ingredientQuery = supabase
      .from("ingredient_price_history")
      .select("*")
      .order("recorded_at", { ascending: true });

    if (cutoffDate) {
      ingredientQuery = ingredientQuery.gte("recorded_at", cutoffDate.toISOString());
    }

    const { data: ingredientHistory } = await ingredientQuery;

    // Group by ingredient
    const ingredientChanges = {};
    (ingredientHistory || []).forEach(record => {
      if (!ingredientChanges[record.ingredient_id]) {
        ingredientChanges[record.ingredient_id] = {
          name: record.ingredient_name,
          type: 'Ingredient',
          records: []
        };
      }
      ingredientChanges[record.ingredient_id].records.push(record);
    });

    // Get menu item price changes
    let menuQuery = supabase
      .from("menu_item_price_history")
      .select("*")
      .order("recorded_at", { ascending: true });

    if (cutoffDate) {
      menuQuery = menuQuery.gte("recorded_at", cutoffDate.toISOString());
    }

    const { data: menuHistory } = await menuQuery;

    // Group by menu item
    const menuChanges = {};
    (menuHistory || []).forEach(record => {
      if (!menuChanges[record.menu_item_id]) {
        menuChanges[record.menu_item_id] = {
          name: record.menu_item_name,
          type: 'Menu Item',
          records: []
        };
      }
      menuChanges[record.menu_item_id].records.push(record);
    });

    // Combine and format
    const allChanges = [
      ...Object.values(ingredientChanges),
      ...Object.values(menuChanges)
    ].filter(item => item.records.length > 0);

    const tbody = $("#price-changes-list");
    if (!tbody) return;

    if (allChanges.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">No price changes in this period. Add or update items to track trends.</td></tr>';
      return;
    }

    tbody.innerHTML = allChanges.map(item => {
      const firstRecord = item.records[0];
      const lastRecord = item.records[item.records.length - 1];

      const startPrice = item.type === 'Ingredient' ? firstRecord.total_price : firstRecord.total_cost;
      const currentPrice = item.type === 'Ingredient' ? lastRecord.total_price : lastRecord.total_cost;
      const change = currentPrice - startPrice;
      const changePercent = startPrice > 0 ? ((change / startPrice) * 100).toFixed(1) : 0;

      const changeClass = change > 0 ? 'price-increase' : change < 0 ? 'price-decrease' : 'price-stable';
      const changeSymbol = change > 0 ? '↑' : change < 0 ? '↓' : '→';

      return `
        <tr>
          <td><strong>${escapeHtml(item.name)}</strong></td>
          <td>${item.type}</td>
          <td>${item.records.length}</td>
          <td>${fmtMoney(startPrice)}</td>
          <td>${fmtMoney(currentPrice)}</td>
          <td class="${changeClass}">${changeSymbol} ${fmtMoney(Math.abs(change))} (${changePercent}%)</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showNotification(`Failed to load price changes: ${err.message}`, 'error');
  }
}

async function loadTopChanges(period) {
  try {
    // Check if element exists
    if (!$("#top-changes-list")) return;

    const cutoffDate = getCutoffDate(period);

    // Get all price changes (same logic as above but just top 10)
    let ingredientQuery = supabase
      .from("ingredient_price_history")
      .select("*")
      .order("recorded_at", { ascending: true });

    if (cutoffDate) {
      ingredientQuery = ingredientQuery.gte("recorded_at", cutoffDate.toISOString());
    }

    const { data: ingredientHistory } = await ingredientQuery;
    const ingredientChanges = {};
    (ingredientHistory || []).forEach(record => {
      if (!ingredientChanges[record.ingredient_id]) {
        ingredientChanges[record.ingredient_id] = {
          name: record.ingredient_name,
          type: 'Ingredient',
          records: []
        };
      }
      ingredientChanges[record.ingredient_id].records.push(record);
    });

    let menuQuery = supabase
      .from("menu_item_price_history")
      .select("*")
      .order("recorded_at", { ascending: true });

    if (cutoffDate) {
      menuQuery = menuQuery.gte("recorded_at", cutoffDate.toISOString());
    }

    const { data: menuHistory } = await menuQuery;
    const menuChanges = {};
    (menuHistory || []).forEach(record => {
      if (!menuChanges[record.menu_item_id]) {
        menuChanges[record.menu_item_id] = {
          name: record.menu_item_name,
          type: 'Menu Item',
          records: []
        };
      }
      menuChanges[record.menu_item_id].records.push(record);
    });

    // Calculate changes and sort by absolute change amount
    const allChanges = [
      ...Object.values(ingredientChanges),
      ...Object.values(menuChanges)
    ].filter(item => item.records.length > 1)
     .map(item => {
       const firstRecord = item.records[0];
       const lastRecord = item.records[item.records.length - 1];
       const startPrice = item.type === 'Ingredient' ? firstRecord.total_price : firstRecord.total_cost;
       const currentPrice = item.type === 'Ingredient' ? lastRecord.total_price : lastRecord.total_cost;
       const change = currentPrice - startPrice;
       const changePercent = startPrice > 0 ? ((change / startPrice) * 100) : 0;

       return {
         ...item,
         startPrice,
         currentPrice,
         change,
         changePercent,
         absChange: Math.abs(change)
       };
     })
     .sort((a, b) => b.absChange - a.absChange)
     .slice(0, 10); // Top 10

    const tbody = $("#top-changes-list");
    if (!tbody) return;

    if (allChanges.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">Not enough data to show changes. Update items multiple times to track trends.</td></tr>';
      return;
    }

    tbody.innerHTML = allChanges.map(item => {
      const changeClass = item.change > 0 ? 'price-increase' : item.change < 0 ? 'price-decrease' : 'price-stable';
      const changeSymbol = item.change > 0 ? '↑' : item.change < 0 ? '↓' : '→';

      return `
        <tr>
          <td><strong>${escapeHtml(item.name)}</strong></td>
          <td>${item.type}</td>
          <td class="${changeClass}">${changeSymbol} ${fmtMoney(item.absChange)}</td>
          <td class="${changeClass}">${changeSymbol} ${item.changePercent.toFixed(1)}%</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showNotification(`Failed to load top changes: ${err.message}`, 'error');
  }
}

function getCutoffDate(period) {
  if (period === "all") return null;

  const daysAgo = parseInt(period);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
  return cutoffDate;
}

// Load menu items on page load (only on main page)
window.addEventListener("DOMContentLoaded", async () => {
  // Only load if we're on the main page with menu items list
  if ($("#menu-items-list")) {
    await loadMenuItems();
  }
  // Only load dashboard if dashboard exists
  if ($("#summary-total-ingredients")) {
    await loadTrends();
  }
});

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

// CSV Export Functions
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape double quotes and wrap in quotes if contains comma, newline, or quote
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCSV(filename, rows) {
  const csv = rows.map(row => row.map(escapeCSV).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

window.exportIngredientsCSV = async function() {
  try {
    const { data: ingredients, error } = await supabase
      .from("ingredients")
      .select("*")
      .eq("is_deleted", false)
      .order("name");

    if (error) throw error;

    const rows = [
      ['Ingredient Name', 'Quantity', 'Unit', 'Total Price', 'Price Per Unit'],
      ...(ingredients || []).map(ing => [
        ing.name,
        ing.quantity,
        ing.unit,
        ing.total_price,
        ing.price_per_unit
      ])
    ];

    downloadCSV('ingredients.csv', rows);
    showNotification('Ingredients exported successfully!', 'success');
  } catch (err) {
    showNotification(`Export failed: ${err.message}`, 'error');
  }
};

window.exportMenuItemsCSV = async function() {
  try {
    const { data: menuItems, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("is_deleted", false)
      .order("name");

    if (error) throw error;

    // For each menu item, get the breakdown
    const rows = [
      ['Menu Item', 'Is Sub-Recipe', 'Total Cost', 'Sale Price', 'COGS%', 'Ingredients Breakdown']
    ];

    for (const item of menuItems || []) {
      // Load ingredients
      const { data: ingredients } = await supabase
        .from("menu_item_ingredients")
        .select("*")
        .eq("menu_item_id", item.id)
        .eq("is_deleted", false);

      // Load sub-recipes
      const { data: subRecipes } = await supabase
        .from("menu_item_subrecipes")
        .select("*")
        .eq("menu_item_id", item.id)
        .eq("is_deleted", false);

      let breakdown = '';
      if (ingredients && ingredients.length > 0) {
        breakdown += ingredients.map(ing =>
          `${ing.ingredient_name}: ${ing.quantity} ${ing.unit} ($${ing.cost.toFixed(2)})`
        ).join('; ');
      }

      if (subRecipes && subRecipes.length > 0) {
        if (breakdown) breakdown += '; ';
        breakdown += subRecipes.map(sr =>
          `${sr.sub_recipe_name}: ${sr.quantity}x ($${sr.cost.toFixed(2)})`
        ).join('; ');
      }

      const cogs = item.sale_price ? ((item.total_cost / item.sale_price) * 100).toFixed(1) : 'N/A';

      rows.push([
        item.name,
        item.is_sub_recipe ? 'Yes' : 'No',
        item.total_cost.toFixed(2),
        item.sale_price ? item.sale_price.toFixed(2) : '',
        cogs !== 'N/A' ? cogs + '%' : 'N/A',
        breakdown
      ]);
    }

    downloadCSV('menu-items.csv', rows);
    showNotification('Menu items exported successfully!', 'success');
  } catch (err) {
    showNotification(`Export failed: ${err.message}`, 'error');
  }
};

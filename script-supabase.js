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
  console.log("Save ingredient called");

  const id = $("#ingredient-id").value || null;
  const name = toSentenceCase($("#ingredient-name").value.trim());
  const quantity = parseFloat($("#ingredient-quantity").value);
  const unit = $("#ingredient-unit").value;
  const total_price = parseFloat($("#ingredient-price").value);

  console.log("Form values:", { name, quantity, unit, total_price });

  if (!name || !quantity || !unit || isNaN(total_price)) {
    showNotification("Please fill in all required fields", "error");
    console.error("Validation failed");
    return;
  }

  // Check for duplicates
  const { data: existingIngredients, error: checkError } = await supabase
    .from("ingredients")
    .select("id, name")
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
    if (id) {
      const { error } = await supabase
        .from("ingredients")
        .update({ name, quantity, unit, total_price, price_per_unit })
        .eq("id", id);
      if (error) throw error;
      console.log("Update successful");
    } else {
      const { error } = await supabase
        .from("ingredients")
        .insert([{ name, quantity, unit, total_price, price_per_unit }]);
      if (error) throw error;
      console.log("Insert successful");
    }
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
    showNotification(`Load failed: ${error.message}`, "error");
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
  console.log("Show menu form called");
  menuState.editingId = null;
  menuState.ingredients = [];
  menuState.subRecipes = [];

  await renderMenuForm();
  $("#menu-form-card")?.classList.remove("hidden");
};

async function renderMenuForm(menuItemId = null) {
  const isEdit = !!menuItemId;
  let existingData = null;

  if (isEdit) {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("id", menuItemId)
      .single();

    if (error) {
      showNotification(`Load failed: ${error.message}`, "error");
      return;
    }
    existingData = data;

    // Load ingredients
    const { data: ingredientsData } = await supabase
      .from("menu_item_ingredients")
      .select("*")
      .eq("menu_item_id", menuItemId);

    menuState.ingredients = ingredientsData || [];

    // Load sub-recipes
    const { data: subRecipesData } = await supabase
      .from("menu_item_subrecipes")
      .select("*")
      .eq("menu_item_id", menuItemId);

    menuState.subRecipes = subRecipesData || [];
  } else {
    menuState.ingredients = [];
    menuState.subRecipes = [];
  }

  // Get all ingredients for dropdown
  const { data: allIngredients } = await supabase
    .from("ingredients")
    .select("*")
    .order("name");

  // Get all sub-recipes for dropdown
  const { data: allSubRecipes } = await supabase
    .from("menu_items")
    .select("*")
    .eq("is_sub_recipe", true)
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
            ${(allIngredients || []).map(i => `<option value="${i.id}" ${i.id === ing.ingredient_id ? 'selected' : ''}>${escapeHtml(i.name)} (${i.unit} @ ${fmtMoney(i.price_per_unit)})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Amount</label>
          <input type="number" class="menu-ingredient-qty" step="0.01" required min="0.01" value="${ing.quantity}" placeholder="0.00">
        </div>
        <div class="form-group">
          <label>Unit</label>
          <select class="menu-ingredient-unit" required>
            ${getUnitOptions(purchaseUnit, ing.unit)}
          </select>
        </div>
        <div class="form-group" style="display: flex; align-items: flex-end;">
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
            ${(allIngredients || []).map(i => `<option value="${i.id}">${escapeHtml(i.name)} (${i.unit} @ ${fmtMoney(i.price_per_unit)})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Amount</label>
          <input type="number" class="menu-ingredient-qty" step="0.01" required min="0.01" placeholder="0.00">
        </div>
        <div class="form-group">
          <label>Unit</label>
          <select class="menu-ingredient-unit" required>
            <option value="">-</option>
          </select>
        </div>
        <div class="form-group" style="display: flex; align-items: flex-end;">
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

window.updateIngredientOptions = function(selectElement) {
  const row = selectElement.closest('.ingredient-row');
  const ingredientId = parseInt(selectElement.value);

  supabase
    .from("ingredients")
    .select("*")
    .eq("id", ingredientId)
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
        ${(allIngredients || []).map(i => `<option value="${i.id}">${escapeHtml(i.name)} (${i.unit} @ ${fmtMoney(i.price_per_unit)})</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Amount</label>
      <input type="number" class="menu-ingredient-qty" step="0.01" required min="0.01" placeholder="0.00">
    </div>
    <div class="form-group">
      <label>Unit</label>
      <select class="menu-ingredient-unit" required>
        <option value="">-</option>
      </select>
    </div>
    <div class="form-group" style="display: flex; align-items: flex-end;">
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
  $("#menu-form-card")?.classList.add("hidden");
  menuState.editingId = null;
  menuState.ingredients = [];
  menuState.subRecipes = [];
};

window.saveMenuItem = async function (e) {
  e.preventDefault();
  console.log("Save menu item called");

  const id = $("#menu-item-id")?.value || null;
  const name = toSentenceCase($("#menu-item-name")?.value.trim());
  const isSubRecipe = $("#menu-item-is-sub-recipe")?.checked || false;
  const salePrice = parseFloat($("#menu-item-sale-price")?.value) || null;

  if (!name) {
    showNotification("Please enter an item name", "error");
    return;
  }

  // Check for duplicates
  const { data: existingItems, error: checkError } = await supabase
    .from("menu_items")
    .select("id, name")
    .ilike("name", name);

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
    const quantity = parseFloat(row.querySelector('.menu-ingredient-qty').value);
    const useUnit = row.querySelector('.menu-ingredient-unit')?.value;

    if (ingredientId && quantity > 0 && useUnit) {
      const { data: ingredient } = await supabase
        .from("ingredients")
        .select("*")
        .eq("id", ingredientId)
        .single();

      if (ingredient) {
        // Calculate cost with unit conversion
        const cost = unitConverter.calculateCost(
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
          cost: cost
        });
      }
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

    if (id) {
      // Update existing
      const { error: updateError } = await supabase
        .from("menu_items")
        .update({
          name,
          total_cost: totalCost,
          is_sub_recipe: isSubRecipe,
          sale_price: salePrice
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Delete existing ingredients and sub-recipes
      await supabase.from("menu_item_ingredients").delete().eq("menu_item_id", id);
      await supabase.from("menu_item_subrecipes").delete().eq("menu_item_id", id);
    } else {
      // Insert new
      const { data: newItem, error: insertError } = await supabase
        .from("menu_items")
        .insert([{
          name,
          total_cost: totalCost,
          is_sub_recipe: isSubRecipe,
          sale_price: salePrice
        }])
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
        cost: ing.cost
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
    window.cancelMenuEdit();
    await loadMenuItems();
    await loadProfitCalculatorItems();
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
    .select("*");

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

      return `
        <tr class="menu-item-row" data-menu-id="${item.id}">
          <td>
            <button class="btn-icon dropdown-toggle" onclick="toggleBreakdown(${item.id})" title="Show/Hide Breakdown">
              <span class="dropdown-arrow" id="arrow-${item.id}">▶</span>
            </button>
          </td>
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
      .eq("menu_item_id", menuItemId);

    // Load sub-recipes
    const { data: subRecipes } = await supabase
      .from("menu_item_subrecipes")
      .select("*")
      .eq("menu_item_id", menuItemId);

    let breakdownHTML = '';

    if (ingredients && ingredients.length > 0) {
      breakdownHTML += ingredients.map(ing =>
        `${escapeHtml(ing.ingredient_name)}: ${ing.quantity} ${ing.unit} (${fmtMoney(ing.cost)})`
      ).join(' • ');
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
  menuState.editingId = id;
  await renderMenuForm(id);
  $("#menu-form-card")?.classList.remove("hidden");

  // Scroll to form
  setTimeout(() => {
    $("#menu-form-card")?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

async function deleteMenuItem(id) {
  if (!confirm("Delete this menu item?")) return;

  try {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) throw error;
    await loadMenuItems();
    await loadProfitCalculatorItems();
    showNotification("Menu item deleted successfully!", "success");
  } catch (err) {
    showNotification(`Delete failed: ${err.message}`, "error");
  }
}

// 10) Profit Calculator
window.calculateProfit = function () {
  const menuItemId = $("#profit-menu-select")?.value;
  const sellingPrice = parseFloat($("#profit-selling-price")?.value);

  if (!menuItemId || !sellingPrice) {
    $("#profit-results").style.display = "none";
    return;
  }

  supabase
    .from("menu_items")
    .select("*")
    .eq("id", menuItemId)
    .single()
    .then(async ({ data: menuItem, error }) => {
      if (error) {
        console.error("Error loading menu item:", error);
        return;
      }

      // Load ingredients breakdown
      const { data: ingredients } = await supabase
        .from("menu_item_ingredients")
        .select("*")
        .eq("menu_item_id", menuItemId);

      const { data: subRecipes } = await supabase
        .from("menu_item_subrecipes")
        .select("*")
        .eq("menu_item_id", menuItemId);

      let breakdownHtml = "<h4>Cost Breakdown:</h4><ul>";

      (ingredients || []).forEach(ing => {
        breakdownHtml += `<li>${escapeHtml(ing.ingredient_name)}: ${ing.quantity} ${ing.unit} × ${fmtMoney(ing.price_per_unit)} = ${fmtMoney(ing.cost)}</li>`;
      });

      (subRecipes || []).forEach(sr => {
        breakdownHtml += `<li>${escapeHtml(sr.sub_recipe_name)}: ${sr.quantity} × ${fmtMoney(sr.cost_per_unit)} = ${fmtMoney(sr.cost)}</li>`;
      });

      breakdownHtml += "</ul>";

      $("#profit-ingredients-breakdown").innerHTML = breakdownHtml;

      const totalCost = menuItem.total_cost;
      const profit = sellingPrice - totalCost;
      const profitMargin = ((profit / sellingPrice) * 100).toFixed(1);
      const foodCostPercent = ((totalCost / sellingPrice) * 100).toFixed(1);

      $("#profit-total-cost").textContent = fmtMoney(totalCost);
      $("#profit-selling").textContent = fmtMoney(sellingPrice);
      $("#profit-amount").textContent = fmtMoney(profit);
      $("#profit-margin").textContent = profitMargin + "%";
      $("#food-cost-percent").textContent = foodCostPercent + "%";

      $("#profit-results").style.display = "block";
    });
};

async function loadProfitCalculatorItems() {
  const { data: items } = await supabase
    .from("menu_items")
    .select("*")
    .order("name");

  const select = $("#profit-menu-select");
  if (!select) return;

  select.innerHTML = '<option value="">Choose a menu item</option>' +
    (items || []).map(item =>
      `<option value="${item.id}">${escapeHtml(item.name)} (Cost: ${fmtMoney(item.total_cost)})</option>`
    ).join("");
}

// Load menu items on page load
window.addEventListener("DOMContentLoaded", async () => {
  await loadMenuItems();
  await loadProfitCalculatorItems();
});

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

import { supabase } from './supabaseClient.js'; // adjust path as needed
// ===== DATA STORAGE =====
let data = {
    ingredients: [],
    menuItems: []
};

let editingIngredientId = null;
let editingMenuId = null;

// Sorting state
let ingredientSortOrder = 'asc'; // 'asc' or 'desc'
let menuSortBy = 'name'; // 'name', 'cogs-asc', 'cogs-desc'

// ===== UTILITY FUNCTIONS =====
function capitalizeFirstLetter(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ===== SUPABASE DATA FUNCTIONS =====
async function loadData() {
    try {
        // Load ingredients
        const { data: ingredientsData, error: ingredientsError } = await supabase
            .from('ingredients')
            .select('*')
            .order('id', { ascending: true });

        if (ingredientsError) throw ingredientsError;

        // Transform to match our data structure
        data.ingredients = ingredientsData.map(ing => ({
            id: ing.id,
            name: ing.name,
            quantity: parseFloat(ing.quantity),
            unit: ing.unit,
            totalPrice: parseFloat(ing.total_price),
            pricePerUnit: parseFloat(ing.price_per_unit)
        }));

        // Load menu items
        const { data: menuItemsData, error: menuItemsError } = await supabase
            .from('menu_items')
            .select(`
                *,
                menu_item_ingredients (*),
                menu_item_subrecipes (*)
            `)
            .order('id', { ascending: true });

        if (menuItemsError) throw menuItemsError;

        // Transform menu items
        data.menuItems = menuItemsData.map(item => ({
            id: item.id,
            name: item.name,
            totalCost: parseFloat(item.total_cost),
            isSubRecipe: item.is_sub_recipe,
            salePrice: item.sale_price ? parseFloat(item.sale_price) : null,
            ingredients: item.menu_item_ingredients.map(ing => ({
                ingredientId: ing.ingredient_id,
                ingredientName: ing.ingredient_name,
                quantity: parseFloat(ing.quantity),
                unit: ing.unit,
                pricePerUnit: parseFloat(ing.price_per_unit),
                cost: parseFloat(ing.cost)
            })),
            subRecipes: item.menu_item_subrecipes.map(sr => ({
                subRecipeId: sr.sub_recipe_id,
                subRecipeName: sr.sub_recipe_name,
                quantity: parseFloat(sr.quantity),
                costPerUnit: parseFloat(sr.cost_per_unit),
                cost: parseFloat(sr.cost)
            }))
        }));

        updateAllLists();
        console.log('Data loaded from Supabase successfully');
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading data from database: ' + error.message);
    }
}

async function saveIngredientToSupabase(ingredient) {
    try {
        const dbIngredient = {
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            total_price: ingredient.totalPrice,
            price_per_unit: ingredient.pricePerUnit
        };

        if (ingredient.id && ingredient.id > 100000) {
            // New item (temporary ID), insert
            const { data, error } = await supabase
                .from('ingredients')
                .insert([dbIngredient])
                .select()
                .single();

            if (error) throw error;
            return data.id;
        } else {
            // Update existing
            const { error } = await supabase
                .from('ingredients')
                .update(dbIngredient)
                .eq('id', ingredient.id);

            if (error) throw error;
            return ingredient.id;
        }
    } catch (error) {
        console.error('Error saving ingredient:', error);
        throw error;
    }
}

async function deleteIngredientFromSupabase(id) {
    try {
        const { error } = await supabase
            .from('ingredients')
            .delete()
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting ingredient:', error);
        throw error;
    }
}

async function saveMenuItemToSupabase(menuItem) {
    try {
        const dbMenuItem = {
            name: menuItem.name,
            total_cost: menuItem.totalCost,
            is_sub_recipe: menuItem.isSubRecipe,
            sale_price: menuItem.salePrice
        };

        let menuItemId;

        if (menuItem.id && menuItem.id > 100000) {
            // New item, insert
            const { data, error } = await supabase
                .from('menu_items')
                .insert([dbMenuItem])
                .select()
                .single();

            if (error) throw error;
            menuItemId = data.id;
        } else {
            // Update existing
            menuItemId = menuItem.id;

            // Delete old ingredients and subrecipes
            await supabase.from('menu_item_ingredients').delete().eq('menu_item_id', menuItemId);
            await supabase.from('menu_item_subrecipes').delete().eq('menu_item_id', menuItemId);

            const { error } = await supabase
                .from('menu_items')
                .update(dbMenuItem)
                .eq('id', menuItemId);

            if (error) throw error;
        }

        // Insert ingredients
        if (menuItem.ingredients && menuItem.ingredients.length > 0) {
            const dbIngredients = menuItem.ingredients.map(ing => ({
                menu_item_id: menuItemId,
                ingredient_id: ing.ingredientId,
                ingredient_name: ing.ingredientName,
                quantity: ing.quantity,
                unit: ing.unit,
                price_per_unit: ing.pricePerUnit,
                cost: ing.cost
            }));

            const { error } = await supabase
                .from('menu_item_ingredients')
                .insert(dbIngredients);

            if (error) throw error;
        }

        // Insert subrecipes
        if (menuItem.subRecipes && menuItem.subRecipes.length > 0) {
            const dbSubRecipes = menuItem.subRecipes.map(sr => ({
                menu_item_id: menuItemId,
                sub_recipe_id: sr.subRecipeId,
                sub_recipe_name: sr.subRecipeName,
                quantity: sr.quantity,
                cost_per_unit: sr.costPerUnit,
                cost: sr.cost
            }));

            const { error } = await supabase
                .from('menu_item_subrecipes')
                .insert(dbSubRecipes);

            if (error) throw error;
        }

        return menuItemId;
    } catch (error) {
        console.error('Error saving menu item:', error);
        throw error;
    }
}

async function deleteMenuItemFromSupabase(id) {
    try {
        // Foreign keys with CASCADE will auto-delete related records
        const { error } = await supabase
            .from('menu_items')
            .delete()
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting menu item:', error);
        throw error;
    }
}

// ===== UI FUNCTIONS =====
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');

    document.querySelectorAll('.nav-links button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    if (sectionId === 'profit') {
        updateProfitMenuDropdown();
    }
    if (sectionId === 'menu') {
        // Always hide the form when navigating to menu section
        // User can click "Add New Item" to show it
        hideMenuForm();
    }
}

function showAlert(elementId, message, type = 'success') {
    const alertDiv = document.getElementById(elementId);
    alertDiv.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        alertDiv.innerHTML = '';
    }, 3000);
}

// ===== INGREDIENTS CRUD =====

function showIngredientForm() {
    const formCard = document.getElementById('ingredient-form-card');
    formCard.classList.remove('hidden');
    document.getElementById('ingredient-form').scrollIntoView({ behavior: 'smooth' });
}

function hideIngredientForm() {
    document.getElementById('ingredient-form-card').classList.add('hidden');
}

function cancelIngredientEdit() {
    editingIngredientId = null;
    document.getElementById('ingredient-form').reset();
    document.getElementById('ingredient-id').value = '';
    document.getElementById('submit-btn').textContent = 'Add Ingredient';
    hideIngredientForm();
}

// Create or Update
async function saveIngredient(event) {
    event.preventDefault();

    const quantity = parseFloat(document.getElementById('ingredient-quantity').value);
    const totalPrice = parseFloat(document.getElementById('ingredient-price').value);
    const pricePerUnit = totalPrice / quantity;

    const ingredient = {
        id: editingIngredientId || Date.now(),
        name: capitalizeFirstLetter(document.getElementById('ingredient-name').value),
        quantity: quantity,
        unit: document.getElementById('ingredient-unit').value,
        totalPrice: totalPrice,
        pricePerUnit: pricePerUnit
    };

    try {
        // Save to Supabase
        const savedId = await saveIngredientToSupabase(ingredient);
        ingredient.id = savedId;

        if (editingIngredientId) {
            // Update existing
            const index = data.ingredients.findIndex(i => i.id === editingIngredientId);
            data.ingredients[index] = ingredient;
            showAlert('ingredient-alert', 'Ingredient updated successfully!');
            editingIngredientId = null;
        } else {
            // Create new
            data.ingredients.push(ingredient);
            showAlert('ingredient-alert', 'Ingredient added successfully!');
        }

        document.getElementById('ingredient-form').reset();
        document.getElementById('ingredient-id').value = '';
        document.getElementById('submit-btn').textContent = 'Add Ingredient';
        hideIngredientForm();

        renderIngredients();
        updateMenuIngredientDropdowns();
    } catch (error) {
        showAlert('ingredient-alert', 'Error saving ingredient: ' + error.message, 'error');
    }
}

// Read (Render)
function renderIngredients() {
    const list = document.getElementById('ingredients-list');

    if (data.ingredients.length === 0) {
        list.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999; padding: 40px;">No ingredients yet. Add your first ingredient above!</td></tr>';
        return;
    }

    // Sort ingredients alphabetically
    const sortedIngredients = [...data.ingredients].sort((a, b) => {
        if (ingredientSortOrder === 'asc') {
            return a.name.localeCompare(b.name);
        } else {
            return b.name.localeCompare(a.name);
        }
    });

    list.innerHTML = sortedIngredients.map(ing => {
        // Handle old data format (without quantity/totalPrice) and new format
        let pricePerUnit = ing.pricePerUnit || ing.price || 0;
        let quantity = ing.quantity || 1;
        let totalPrice = ing.totalPrice || (pricePerUnit * quantity);

        return `
            <tr>
                <td><strong>${ing.name}</strong></td>
                <td>${quantity} ${ing.unit} @ $${totalPrice.toFixed(2)}</td>
                <td style="color: #186B28; font-weight: bold;">$${pricePerUnit.toFixed(4)} per ${ing.unit}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editIngredient(${ing.id})" style="margin-right: 5px;">Edit</button>
                    <button class="btn btn-danger" onclick="deleteIngredient(${ing.id})">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Edit
function editIngredient(id) {
    const ingredient = data.ingredients.find(i => i.id === id);
    if (!ingredient) return;

    // Handle old data format
    let quantity = ingredient.quantity || 1;
    let totalPrice = ingredient.totalPrice || ingredient.price || 0;

    editingIngredientId = id;
    document.getElementById('ingredient-id').value = id;
    document.getElementById('ingredient-name').value = ingredient.name;
    document.getElementById('ingredient-quantity').value = quantity;
    document.getElementById('ingredient-unit').value = ingredient.unit;
    document.getElementById('ingredient-price').value = totalPrice;

    document.getElementById('submit-btn').textContent = 'Update Ingredient';

    // Show the form
    showIngredientForm();
}

// Keep old cancelEdit for compatibility if HTML still uses it
function cancelEdit() {
    cancelIngredientEdit();
}

// Delete
async function deleteIngredient(id) {
    if (!confirm('Are you sure you want to delete this ingredient?')) return;

    try {
        await deleteIngredientFromSupabase(id);
        data.ingredients = data.ingredients.filter(i => i.id !== id);
        renderIngredients();
        updateMenuIngredientDropdowns();
        showAlert('ingredient-alert', 'Ingredient deleted successfully!');
    } catch (error) {
        showAlert('ingredient-alert', 'Error deleting ingredient: ' + error.message, 'error');
    }
}

// Toggle ingredient sort
function toggleIngredientSort() {
    ingredientSortOrder = document.getElementById('ingredient-sort').value;
    renderIngredients();
}

// ===== MENU ITEMS CRUD =====

function showMenuForm(menuId = null) {
    const container = document.getElementById('menu-form-container');
    const formCard = document.getElementById('menu-form-card');

    // Show the form card
    formCard.classList.remove('hidden');

    // Check if there are ingredients available
    if (data.ingredients.length === 0) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; background: #fed7d7; border-radius: 6px; color: #742a2a;">
                <h3 style="margin-bottom: 10px;">No Ingredients Available</h3>
                <p>Please add ingredients first before creating menu items.</p>
            </div>
        `;
        return;
    }

    let formTitle = 'Create Menu Item';
    let submitButtonText = 'Save Menu Item';
    let menuName = '';
    let ingredients = [];
    let subRecipes = [];
    let isSubRecipe = false;
    let salePrice = '';

    if (menuId) {
        const menuItem = data.menuItems.find(m => m.id === menuId);
        if (menuItem) {
            formTitle = 'Edit Menu Item';
            submitButtonText = 'Update Menu Item';
            menuName = menuItem.name;
            ingredients = menuItem.ingredients || [];
            subRecipes = menuItem.subRecipes || [];
            isSubRecipe = menuItem.isSubRecipe || false;
            salePrice = menuItem.salePrice || '';
            editingMenuId = menuId;
        }
    } else {
        editingMenuId = null;
    }

    // Generate ingredient rows
    let ingredientRows = '';
    if (ingredients.length > 0) {
        ingredientRows = ingredients.map(ing => `
            <div class="form-row ingredient-row">
                <div class="form-group">
                    <label>Ingredient</label>
                    <select class="menu-ingredient-select" required>
                        <option value="">Select Ingredient</option>
                        ${data.ingredients.map(i => {
                            const pricePerUnit = i.pricePerUnit || i.price || 0;
                            return `<option value="${i.id}" ${i.id === ing.ingredientId ? 'selected' : ''}>${i.name} (${i.unit} @ $${pricePerUnit.toFixed(4)})</option>`;
                        }).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Amount (${ing.unit || 'units'})</label>
                    <input type="number" class="menu-ingredient-qty" step="0.01" required min="0.01" value="${ing.quantity}" placeholder="0.00">
                </div>
                <div class="form-group" style="display: flex; align-items: flex-end;">
                    <button type="button" class="btn btn-danger" onclick="removeIngredientRow(this)">Remove</button>
                </div>
            </div>
        `).join('');
    } else {
        ingredientRows = `
            <div class="form-row ingredient-row">
                <div class="form-group">
                    <label>Ingredient</label>
                    <select class="menu-ingredient-select" required onchange="updateIngredientUnit(this)">
                        <option value="">Select Ingredient</option>
                        ${data.ingredients.map(i => {
                            const pricePerUnit = i.pricePerUnit || i.price || 0;
                            return `<option value="${i.id}">${i.name} (${i.unit} @ $${pricePerUnit.toFixed(4)})</option>`;
                        }).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Amount</label>
                    <input type="number" class="menu-ingredient-qty" step="0.01" required min="0.01" placeholder="0.00">
                </div>
                <div class="form-group" style="display: flex; align-items: flex-end;">
                    <button type="button" class="btn btn-danger" onclick="removeIngredientRow(this)">Remove</button>
                </div>
            </div>
        `;
    }

    // Generate sub-recipe rows
    let subRecipeRows = '';
    const availableSubRecipes = data.menuItems.filter(m => m.isSubRecipe && m.id !== menuId);

    if (subRecipes.length > 0) {
        subRecipeRows = subRecipes.map(sr => `
            <div class="form-row sub-recipe-row">
                <div class="form-group">
                    <label>Sub-Recipe</label>
                    <select class="menu-subrecipe-select" required>
                        <option value="">Select Sub-Recipe</option>
                        ${availableSubRecipes.map(item =>
                            `<option value="${item.id}" ${item.id === sr.subRecipeId ? 'selected' : ''}>${item.name} ($${item.totalCost.toFixed(2)})</option>`
                        ).join('')}
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

    container.innerHTML = `
        <h2>${formTitle}</h2>
        <form id="menu-form" onsubmit="saveMenuItem(event)">
            <input type="hidden" id="menu-id" value="${menuId || ''}">
            <div class="form-row">
                <div class="form-group">
                    <label>Dish Name *</label>
                    <input type="text" id="menu-name" required placeholder="e.g., Caesar Salad, Grilled Chicken" value="${menuName}">
                </div>
                <div class="form-group">
                    <label>Sale Price ($)</label>
                    <input type="number" id="menu-sale-price" step="0.01" min="0" placeholder="Optional" value="${salePrice}">
                </div>
            </div>

            <div class="form-group" style="margin: 15px 0;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="menu-is-subrecipe" ${isSubRecipe ? 'checked' : ''} style="width: auto;">
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
                <button type="button" class="btn btn-secondary" onclick="hideMenuForm()">Cancel</button>
                <button type="submit" class="btn btn-primary" id="menu-submit-btn">${submitButtonText}</button>
            </div>
        </form>
    `;

    document.getElementById('menu-form-container').scrollIntoView({ behavior: 'smooth' });
}

function hideMenuForm() {
    document.getElementById('menu-form-container').innerHTML = '';
    document.getElementById('menu-form-card').classList.add('hidden');
    editingMenuId = null;
}

function updateIngredientUnit(selectElement) {
    const row = selectElement.closest('.ingredient-row');
    const ingredientId = parseInt(selectElement.value);
    const ingredient = data.ingredients.find(i => i.id === ingredientId);

    if (ingredient) {
        const label = row.querySelector('.form-group:nth-child(2) label');
        label.textContent = `Amount (${ingredient.unit})`;
    }
}

function addMenuIngredientRow() {
    const container = document.getElementById('menu-ingredients');
    const row = document.createElement('div');
    row.className = 'form-row ingredient-row';
    row.innerHTML = `
        <div class="form-group">
            <label>Ingredient</label>
            <select class="menu-ingredient-select" required onchange="updateIngredientUnit(this)">
                <option value="">Select Ingredient</option>
                ${data.ingredients.map(i => {
                    const pricePerUnit = i.pricePerUnit || i.price || 0;
                    return `<option value="${i.id}">${i.name} (${i.unit} @ $${pricePerUnit.toFixed(4)})</option>`;
                }).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Amount</label>
            <input type="number" class="menu-ingredient-qty" step="0.01" required min="0.01" placeholder="0.00">
        </div>
        <div class="form-group" style="display: flex; align-items: flex-end;">
            <button type="button" class="btn btn-danger" onclick="removeIngredientRow(this)">Remove</button>
        </div>
    `;
    container.appendChild(row);
}

function removeIngredientRow(button) {
    const row = button.closest('.ingredient-row');
    row.remove();
}

function addMenuSubRecipeRow() {
    const container = document.getElementById('menu-subrecipes');
    const availableSubRecipes = data.menuItems.filter(m => m.isSubRecipe);

    if (availableSubRecipes.length === 0) {
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
                ${availableSubRecipes.map(item =>
                    `<option value="${item.id}">${item.name} ($${item.totalCost.toFixed(2)})</option>`
                ).join('')}
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
}

function removeSubRecipeRow(button) {
    const row = button.closest('.sub-recipe-row');
    row.remove();
}

function updateMenuIngredientDropdowns() {
    document.querySelectorAll('.menu-ingredient-select').forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Select Ingredient</option>' +
            data.ingredients.map(ing => {
                const pricePerUnit = ing.pricePerUnit || ing.price || 0;
                return `<option value="${ing.id}">${ing.name} (${ing.unit} @ $${pricePerUnit.toFixed(4)})</option>`;
            }).join('');
        if (currentValue) {
            select.value = currentValue;
        }
    });
}

// Create or Update
async function saveMenuItem(event) {
    event.preventDefault();

    // Collect ingredients
    const ingredientRows = document.querySelectorAll('.ingredient-row');
    const ingredients = [];

    ingredientRows.forEach(row => {
        const ingredientId = parseInt(row.querySelector('.menu-ingredient-select').value);
        const quantity = parseFloat(row.querySelector('.menu-ingredient-qty').value);

        if (ingredientId && quantity > 0) {
            const ingredient = data.ingredients.find(i => i.id === ingredientId);
            if (ingredient) {
                const pricePerUnit = ingredient.pricePerUnit || ingredient.price || 0;
                ingredients.push({
                    ingredientId: ingredientId,
                    ingredientName: ingredient.name,
                    quantity: quantity,
                    unit: ingredient.unit,
                    pricePerUnit: pricePerUnit,
                    cost: pricePerUnit * quantity
                });
            }
        }
    });

    // Collect sub-recipes
    const subRecipeRows = document.querySelectorAll('.sub-recipe-row');
    const subRecipes = [];

    subRecipeRows.forEach(row => {
        const subRecipeId = parseInt(row.querySelector('.menu-subrecipe-select').value);
        const quantity = parseFloat(row.querySelector('.menu-subrecipe-qty').value);

        if (subRecipeId && quantity > 0) {
            const subRecipe = data.menuItems.find(m => m.id === subRecipeId);
            if (subRecipe) {
                subRecipes.push({
                    subRecipeId: subRecipeId,
                    subRecipeName: subRecipe.name,
                    quantity: quantity,
                    costPerUnit: subRecipe.totalCost,
                    cost: subRecipe.totalCost * quantity
                });
            }
        }
    });

    // Check if at least one component is added
    if (ingredients.length === 0 && subRecipes.length === 0) {
        alert('Please add at least one ingredient or sub-recipe!');
        return;
    }

    // Calculate total cost
    const ingredientCost = ingredients.reduce((sum, ing) => sum + ing.cost, 0);
    const subRecipeCost = subRecipes.reduce((sum, sr) => sum + sr.cost, 0);
    const totalCost = ingredientCost + subRecipeCost;

    const isSubRecipe = document.getElementById('menu-is-subrecipe').checked;
    const salePriceInput = document.getElementById('menu-sale-price').value;
    const salePrice = salePriceInput ? parseFloat(salePriceInput) : null;

    const menuItem = {
        id: editingMenuId || Date.now(),
        name: capitalizeFirstLetter(document.getElementById('menu-name').value),
        ingredients: ingredients,
        subRecipes: subRecipes,
        totalCost: totalCost,
        isSubRecipe: isSubRecipe,
        salePrice: salePrice
    };

    try {
        // Save to Supabase
        const savedId = await saveMenuItemToSupabase(menuItem);
        menuItem.id = savedId;

        if (editingMenuId) {
            // Update existing
            const index = data.menuItems.findIndex(m => m.id === editingMenuId);
            data.menuItems[index] = menuItem;
            showAlert('menu-alert', 'Menu item updated successfully!');
            editingMenuId = null;
        } else {
            // Create new
            data.menuItems.push(menuItem);
            showAlert('menu-alert', 'Menu item added successfully!');
        }

        hideMenuForm();
        renderMenuItems();
    } catch (error) {
        showAlert('menu-alert', 'Error saving menu item: ' + error.message, 'error');
    }
}

// Read (Render)
function renderMenuItems() {
    const tbody = document.getElementById('menu-items-list');

    if (data.menuItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999; padding: 40px;">No menu items yet. Click "Add New Item" to create one!</td></tr>';
        return;
    }

    // Sort menu items
    const sortedItems = [...data.menuItems].sort((a, b) => {
        if (menuSortBy === 'name') {
            return a.name.localeCompare(b.name);
        } else if (menuSortBy === 'cogs-asc' || menuSortBy === 'cogs-desc') {
            const cogsA = a.salePrice ? (a.totalCost / a.salePrice * 100) : 999;
            const cogsB = b.salePrice ? (b.totalCost / b.salePrice * 100) : 999;
            return menuSortBy === 'cogs-asc' ? cogsA - cogsB : cogsB - cogsA;
        }
        return 0;
    });

    tbody.innerHTML = sortedItems.map(item => {
        const ingredients = item.ingredients || [];
        const subRecipes = item.subRecipes || [];
        const isSubRecipe = item.isSubRecipe || false;
        const salePrice = item.salePrice;

        // Calculate COGS%
        let cogsPercent = '';
        let cogsColor = '#666';
        if (salePrice && salePrice > 0) {
            const cogs = (item.totalCost / salePrice * 100);
            cogsPercent = cogs.toFixed(1) + '%';

            // Color code: Green if low COGS, Red if high COGS
            if (cogs <= 30) {
                cogsColor = '#186B28'; // Good - low COGS
            } else if (cogs <= 40) {
                cogsColor = '#0284c7'; // OK
            } else {
                cogsColor = '#ef4444'; // High COGS - warning
            }
        } else {
            cogsPercent = '-';
        }

        return `
        <tr class="menu-row" id="menu-row-${item.id}">
            <td>
                <span class="dropdown-arrow" onclick="toggleMenuDetails(${item.id})">▶</span>
            </td>
            <td onclick="toggleMenuDetails(${item.id})">
                <strong>${item.name}</strong>
                ${isSubRecipe ? '<span style="margin-left: 8px; padding: 2px 6px; background: #e8f5e9; color: #186B28; border-radius: 3px; font-size: 11px;">SUB-RECIPE</span>' : ''}
            </td>
            <td onclick="toggleMenuDetails(${item.id})" style="color: #186B28; font-weight: bold;">$${item.totalCost.toFixed(2)}</td>
            <td onclick="toggleMenuDetails(${item.id})" style="font-weight: bold;">${salePrice ? '$' + salePrice.toFixed(2) : '-'}</td>
            <td onclick="toggleMenuDetails(${item.id})" style="color: ${cogsColor}; font-weight: bold;">${cogsPercent}</td>
            <td>
                <button class="btn btn-secondary" onclick="showMenuForm(${item.id})" style="margin-right: 5px;">Edit</button>
                <button class="btn btn-danger" onclick="deleteMenuItem(${item.id})">Delete</button>
            </td>
        </tr>
        <tr class="menu-row-details" id="menu-details-${item.id}">
            <td colspan="6">
                <div class="breakdown-container">
                    <h4 style="margin-bottom: 10px; color: #2d3748; font-size: 15px;">Cost Breakdown:</h4>

                    ${ingredients.length > 0 ? `
                        <div style="margin-bottom: 15px;">
                            <h5 style="color: #4a5568; font-size: 13px; margin-bottom: 8px;">Raw Ingredients:</h5>
                            ${ingredients.map(ing => `
                                <div class="breakdown-item">
                                    <span>${ing.ingredientName} (${ing.quantity} ${ing.unit} × $${ing.pricePerUnit.toFixed(4)})</span>
                                    <span style="font-weight: bold;">$${ing.cost.toFixed(2)}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${subRecipes.length > 0 ? `
                        <div style="margin-bottom: 15px;">
                            <h5 style="color: #4a5568; font-size: 13px; margin-bottom: 8px;">Sub-Recipes:</h5>
                            ${subRecipes.map(sr => `
                                <div class="breakdown-item">
                                    <span>${sr.subRecipeName} (${sr.quantity} × $${sr.costPerUnit.toFixed(2)})</span>
                                    <span style="font-weight: bold;">$${sr.cost.toFixed(2)}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    <div class="breakdown-total">
                        <span>Total Cost:</span>
                        <span style="color: #186B28;">$${item.totalCost.toFixed(2)}</span>
                    </div>
                </div>
            </td>
        </tr>
    `}).join('');
}

function toggleMenuDetails(id) {
    const row = document.getElementById(`menu-row-${id}`);
    const details = document.getElementById(`menu-details-${id}`);
    const arrow = row.querySelector('.dropdown-arrow');

    if (details.classList.contains('show')) {
        details.classList.remove('show');
        row.classList.remove('expanded');
        arrow.classList.remove('rotated');
    } else {
        // Close all other open details
        document.querySelectorAll('.menu-row-details.show').forEach(d => {
            d.classList.remove('show');
        });
        document.querySelectorAll('.menu-row.expanded').forEach(r => {
            r.classList.remove('expanded');
        });
        document.querySelectorAll('.dropdown-arrow.rotated').forEach(a => {
            a.classList.remove('rotated');
        });

        // Open this one
        details.classList.add('show');
        row.classList.add('expanded');
        arrow.classList.add('rotated');
    }
}

// Delete
async function deleteMenuItem(id) {
    if (!confirm('Are you sure you want to delete this menu item?')) return;

    try {
        await deleteMenuItemFromSupabase(id);
        data.menuItems = data.menuItems.filter(m => m.id !== id);
        renderMenuItems();
        showAlert('menu-alert', 'Menu item deleted successfully!');
    } catch (error) {
        showAlert('menu-alert', 'Error deleting menu item: ' + error.message, 'error');
    }
}

// Toggle menu sort
function toggleMenuSort() {
    menuSortBy = document.getElementById('menu-sort').value;
    renderMenuItems();
}

// ===== PROFIT CALCULATOR =====

function updateProfitMenuDropdown() {
    const select = document.getElementById('profit-menu-select');
    select.innerHTML = '<option value="">Choose a menu item</option>' +
        data.menuItems.map(item =>
            `<option value="${item.id}">${item.name} (Cost: $${item.totalCost.toFixed(2)})</option>`
        ).join('');
}

function calculateProfit() {
    const menuId = parseInt(document.getElementById('profit-menu-select').value);
    const sellingPrice = parseFloat(document.getElementById('profit-selling-price').value) || 0;

    if (!menuId || sellingPrice <= 0) {
        document.getElementById('profit-results').style.display = 'none';
        return;
    }

    const menuItem = data.menuItems.find(m => m.id === menuId);
    if (!menuItem) return;

    const totalCost = menuItem.totalCost;
    const profit = sellingPrice - totalCost;
    const profitMargin = sellingPrice > 0 ? (profit / sellingPrice * 100) : 0;
    const foodCostPercent = sellingPrice > 0 ? (totalCost / sellingPrice * 100) : 0;

    // Show breakdown
    const breakdownDiv = document.getElementById('profit-ingredients-breakdown');
    const ingredients = menuItem.ingredients || [];
    const subRecipes = menuItem.subRecipes || [];

    let breakdownHTML = '<h4 style="margin-bottom: 10px; color: #186B28; font-size: 15px;">Cost Breakdown:</h4>';

    if (ingredients.length > 0) {
        breakdownHTML += '<h5 style="color: #2d3748; font-size: 13px; margin-top: 10px; margin-bottom: 5px;">Raw Ingredients:</h5>';
        breakdownHTML += ingredients.map(ing => `
            <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid rgba(0, 0, 0, 0.1); font-size: 14px;">
                <span>${ing.ingredientName} (${ing.quantity} ${ing.unit})</span>
                <span>$${ing.cost.toFixed(2)}</span>
            </div>
        `).join('');
    }

    if (subRecipes.length > 0) {
        breakdownHTML += '<h5 style="color: #2d3748; font-size: 13px; margin-top: 10px; margin-bottom: 5px;">Sub-Recipes:</h5>';
        breakdownHTML += subRecipes.map(sr => `
            <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid rgba(0, 0, 0, 0.1); font-size: 14px;">
                <span>${sr.subRecipeName} (${sr.quantity}×)</span>
                <span>$${sr.cost.toFixed(2)}</span>
            </div>
        `).join('');
    }

    breakdownDiv.innerHTML = breakdownHTML;

    // Update totals
    document.getElementById('profit-total-cost').textContent = `$${totalCost.toFixed(2)}`;
    document.getElementById('profit-selling').textContent = `$${sellingPrice.toFixed(2)}`;
    document.getElementById('profit-amount').textContent = `$${profit.toFixed(2)}`;
    document.getElementById('profit-margin').textContent = `${profitMargin.toFixed(1)}%`;
    document.getElementById('food-cost-percent').textContent = `${foodCostPercent.toFixed(1)}%`;

    // Color code profit
    const profitElement = document.getElementById('profit-amount');
    const marginElement = document.getElementById('profit-margin');

    if (profit >= 0) {
        profitElement.style.color = '#186B28';
    } else {
        profitElement.style.color = '#ef4444';
    }

    if (profitMargin > 60) {
        marginElement.style.color = '#186B28'; // Great
    } else if (profitMargin > 30) {
        marginElement.style.color = '#0284c7'; // Good
    } else {
        marginElement.style.color = '#ef4444'; // Low
    }

    document.getElementById('profit-results').style.display = 'block';
}

// ===== UPDATE ALL =====
function updateAllLists() {
    renderIngredients();
    renderMenuItems();
    updateMenuIngredientDropdowns();
}

// ===== INITIALIZE =====
window.onload = function() {
    loadData();
};

import { supabase } from './supabase-config.js'; // adjust path as needed
// // ===== DATA STORAGE =====
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

// ... [CONTINUED IN NEXT MESSAGE - file too long]

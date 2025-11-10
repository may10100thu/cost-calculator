-- Create ingredients table
CREATE TABLE ingredients (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  price_per_unit DECIMAL(10,4) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create menu_items table
CREATE TABLE menu_items (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  is_sub_recipe BOOLEAN DEFAULT FALSE,
  sale_price DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create menu_item_ingredients table (for raw ingredients in menu items)
CREATE TABLE menu_item_ingredients (
  id BIGSERIAL PRIMARY KEY,
  menu_item_id BIGINT REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id BIGINT REFERENCES ingredients(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL,
  price_per_unit DECIMAL(10,4) NOT NULL,
  cost DECIMAL(10,2) NOT NULL
);

-- Create menu_item_subrecipes table (for sub-recipes in menu items)
CREATE TABLE menu_item_subrecipes (
  id BIGSERIAL PRIMARY KEY,
  menu_item_id BIGINT REFERENCES menu_items(id) ON DELETE CASCADE,
  sub_recipe_id BIGINT REFERENCES menu_items(id) ON DELETE CASCADE,
  sub_recipe_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  cost_per_unit DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_subrecipes ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public access (you can add auth later)
CREATE POLICY "Allow public read access on ingredients" ON ingredients FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on ingredients" ON ingredients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on ingredients" ON ingredients FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on ingredients" ON ingredients FOR DELETE USING (true);

CREATE POLICY "Allow public read access on menu_items" ON menu_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on menu_items" ON menu_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on menu_items" ON menu_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on menu_items" ON menu_items FOR DELETE USING (true);

CREATE POLICY "Allow public read access on menu_item_ingredients" ON menu_item_ingredients FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on menu_item_ingredients" ON menu_item_ingredients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on menu_item_ingredients" ON menu_item_ingredients FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on menu_item_ingredients" ON menu_item_ingredients FOR DELETE USING (true);

CREATE POLICY "Allow public read access on menu_item_subrecipes" ON menu_item_subrecipes FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on menu_item_subrecipes" ON menu_item_subrecipes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on menu_item_subrecipes" ON menu_item_subrecipes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on menu_item_subrecipes" ON menu_item_subrecipes FOR DELETE USING (true);

-- Create indexes for better performance
CREATE INDEX idx_menu_item_ingredients_menu_item ON menu_item_ingredients(menu_item_id);
CREATE INDEX idx_menu_item_subrecipes_menu_item ON menu_item_subrecipes(menu_item_id);
CREATE INDEX idx_menu_items_sub_recipe ON menu_items(is_sub_recipe);

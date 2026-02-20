-- Verify RLS permissions for a specific operator (you need to replace 'OPERATOR_USER_ID' with a real ID)

-- 1. Check if the user is an operator
select * from operators where profile_id = auth.uid();

-- 2. Check visible warehouses
select * from warehouses;

-- 3. Check visible warehouse items
select * from warehouse_items;

-- 4. Check visible company materials
select * from company_materials;

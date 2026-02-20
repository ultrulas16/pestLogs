-- Fix linking between paid_material_sale_items and company_materials
-- This ensures the Annual Report can fetch material names

DO $$
BEGIN
    -- Only run if the table exists (it should, based on app usage)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'paid_material_sale_items') THEN
        
        -- 1. Drop potential old/broken constraints on product_id
        ALTER TABLE paid_material_sale_items 
        DROP CONSTRAINT IF EXISTS paid_material_sale_items_product_id_fkey;

        ALTER TABLE paid_material_sale_items 
        DROP CONSTRAINT IF EXISTS paid_material_sale_items_paid_products_id_fkey;

        -- 2. Add correct Foreign Key pointing to company_materials
        ALTER TABLE paid_material_sale_items
        ADD CONSTRAINT paid_material_sale_items_product_id_fkey
        FOREIGN KEY (product_id) REFERENCES company_materials(id)
        ON DELETE CASCADE; -- Optional: cascade delete if material is deleted

    END IF;
END $$;

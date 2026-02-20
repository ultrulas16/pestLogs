/*
  # Fix Company Definitions Foreign Keys

  1. Problem
    - All company definition tables have company_id referencing profiles(id)
    - This is incorrect - they should reference companies(id)
    - Existing data has profile IDs stored in company_id column
    - Causes foreign key constraint violations when inserting data

  2. Solution
    - First, drop existing foreign key constraints to allow data updates
    - Update existing data to use actual company IDs from companies table
    - Map profile IDs to company IDs using profiles.company_id
    - Delete orphaned records that can't be mapped
    - Add new foreign key constraints pointing to companies(id)

  3. Affected Tables
    - company_materials
    - company_biocidal_products
    - company_equipment
    - company_visit_types (if exists)
    - company_target_pests (if exists)
*/

-- Fix company_materials
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'company_materials' AND schemaname = 'public') THEN
    -- Drop old constraint first
    ALTER TABLE company_materials DROP CONSTRAINT IF EXISTS company_materials_company_id_fkey;
    
    -- Update existing records to use company_id from profiles table
    UPDATE company_materials cm
    SET company_id = p.company_id
    FROM profiles p
    WHERE cm.company_id = p.id
    AND p.company_id IS NOT NULL;
    
    -- Delete orphaned records that can't be mapped
    DELETE FROM company_materials
    WHERE company_id NOT IN (SELECT id FROM companies);
    
    -- Add new constraint
    ALTER TABLE company_materials 
      ADD CONSTRAINT company_materials_company_id_fkey 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Fix company_biocidal_products
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'company_biocidal_products' AND schemaname = 'public') THEN
    ALTER TABLE company_biocidal_products DROP CONSTRAINT IF EXISTS company_biocidal_products_company_id_fkey;
    
    UPDATE company_biocidal_products cbp
    SET company_id = p.company_id
    FROM profiles p
    WHERE cbp.company_id = p.id
    AND p.company_id IS NOT NULL;
    
    DELETE FROM company_biocidal_products
    WHERE company_id NOT IN (SELECT id FROM companies);
    
    ALTER TABLE company_biocidal_products 
      ADD CONSTRAINT company_biocidal_products_company_id_fkey 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Fix company_equipment
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'company_equipment' AND schemaname = 'public') THEN
    ALTER TABLE company_equipment DROP CONSTRAINT IF EXISTS company_equipment_company_id_fkey;
    
    UPDATE company_equipment ce
    SET company_id = p.company_id
    FROM profiles p
    WHERE ce.company_id = p.id
    AND p.company_id IS NOT NULL;
    
    DELETE FROM company_equipment
    WHERE company_id NOT IN (SELECT id FROM companies);
    
    ALTER TABLE company_equipment 
      ADD CONSTRAINT company_equipment_company_id_fkey 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Fix company_visit_types
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'company_visit_types' AND schemaname = 'public') THEN
    ALTER TABLE company_visit_types DROP CONSTRAINT IF EXISTS company_visit_types_company_id_fkey;
    
    UPDATE company_visit_types cvt
    SET company_id = p.company_id
    FROM profiles p
    WHERE cvt.company_id = p.id
    AND p.company_id IS NOT NULL;
    
    DELETE FROM company_visit_types
    WHERE company_id NOT IN (SELECT id FROM companies);
    
    ALTER TABLE company_visit_types 
      ADD CONSTRAINT company_visit_types_company_id_fkey 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Fix company_target_pests
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'company_target_pests' AND schemaname = 'public') THEN
    ALTER TABLE company_target_pests DROP CONSTRAINT IF EXISTS company_target_pests_company_id_fkey;
    
    UPDATE company_target_pests ctp
    SET company_id = p.company_id
    FROM profiles p
    WHERE ctp.company_id = p.id
    AND p.company_id IS NOT NULL;
    
    DELETE FROM company_target_pests
    WHERE company_id NOT IN (SELECT id FROM companies);
    
    ALTER TABLE company_target_pests 
      ADD CONSTRAINT company_target_pests_company_id_fkey 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;


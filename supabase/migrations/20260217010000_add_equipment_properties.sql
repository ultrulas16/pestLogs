/*
  # Add Equipment Properties Column

  1. Changes
    - Add properties JSONB column to company_equipment table
    - This allows each equipment to have custom properties/fields
    - Properties will store dynamic checklist items for equipment controls
    
  2. Example Structure
    {
      "fly_count": { "type": "number", "label": "Karasinek Sayısı" },
      "consumption": { "type": "boolean", "label": "Tüketim Var mı?" },
      "activity": { "type": "boolean", "label": "Aktivite Var mı?" }
    }
*/

-- Add properties column to company_equipment
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'company_equipment' AND schemaname = 'public') THEN
    -- Add properties column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'company_equipment' 
      AND column_name = 'properties'
    ) THEN
      ALTER TABLE company_equipment ADD COLUMN properties JSONB DEFAULT '{}'::jsonb;
    END IF;
  END IF;
END $$;

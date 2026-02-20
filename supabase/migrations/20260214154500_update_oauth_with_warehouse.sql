-- Update OAuth trigger to also create main warehouse
-- This ensures every new company gets a main warehouse automatically

DROP TRIGGER IF EXISTS on_auth_user_created_oauth ON auth.users;
DROP FUNCTION IF EXISTS handle_oauth_user() CASCADE;

CREATE OR REPLACE FUNCTION handle_oauth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id uuid;
  v_full_name text;
  v_company_name text;
  v_profile_exists boolean;
BEGIN
  RAISE LOG 'OAuth trigger fired for user: %, provider: %', NEW.id, NEW.raw_app_meta_data->>'provider';

  -- Only handle OAuth users (not email/password users)
  IF NEW.raw_app_meta_data ? 'provider' AND NEW.raw_app_meta_data->>'provider' != 'email' THEN

    -- Check if profile already exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = NEW.id) INTO v_profile_exists;

    IF NOT v_profile_exists THEN

      RAISE LOG 'Creating profile for OAuth user: %', NEW.id;

      -- Extract full name from OAuth metadata
      v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1),
        'User'
      );

      v_company_name := v_full_name || ' Pest Control';

      -- Create company first
      BEGIN
        INSERT INTO public.companies (
          name,
          owner_id,
          email,
          phone,
          address,
          currency
        ) VALUES (
          v_company_name,
          NEW.id,
          NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'phone', ''),
          '',
          'TRY'
        ) RETURNING id INTO v_company_id;

        RAISE LOG 'Company created with id: % for user: %', v_company_id, NEW.id;

        -- Create main warehouse for the company
        BEGIN
          INSERT INTO public.warehouses (
            name,
            warehouse_type,
            company_id,
            location
          ) VALUES (
            'Ana Depo',
            'company_main',
            v_company_id,
            'Merkez'
          );
          RAISE LOG 'Main warehouse created for company: %', v_company_id;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Error creating main warehouse for company %: %', v_company_id, SQLERRM;
        END;

      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error creating company for OAuth user %: %', NEW.id, SQLERRM;
        v_company_id := NULL;
      END;

      -- Create profile
      BEGIN
        INSERT INTO public.profiles (
          id,
          email,
          full_name,
          phone,
          role,
          company_id,
          company_name,
          accepted_privacy_policy,
          accepted_terms_of_service,
          privacy_policy_accepted_at,
          terms_of_service_accepted_at
        ) VALUES (
          NEW.id,
          NEW.email,
          v_full_name,
          COALESCE(NEW.raw_user_meta_data->>'phone', ''),
          'company',
          v_company_id,
          v_company_name,
          true,
          true,
          now(),
          now()
        );

        RAISE LOG 'Profile created successfully for OAuth user: %', NEW.id;

      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error creating profile for OAuth user %: %', NEW.id, SQLERRM;
        RAISE;
      END;

    ELSE
      RAISE LOG 'Profile already exists for OAuth user: %', NEW.id;
    END IF;

  ELSE
    RAISE LOG 'Not an OAuth user (provider: %), skipping trigger', NEW.raw_app_meta_data->>'provider';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER on_auth_user_created_oauth
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_oauth_user();

-- Log success
DO $$
BEGIN
  RAISE LOG 'OAuth trigger with warehouse creation recreated successfully';
END $$;

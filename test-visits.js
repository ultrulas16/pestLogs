const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const envs = {};
envFile.split('\n').filter(Boolean).forEach(line => {
    const [key, ...val] = line.split('=');
    if (key) envs[key.trim()] = val.join('=').trim().replace(/[\'\"]/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envs.EXPO_PUBLIC_SUPABASE_URL, envs.EXPO_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
    const { data: profile } = await supabase.from('profiles').select('*').limit(1).single();
    console.log('Profile:', profile.email, profile.role, profile.id, profile.company_id);

    const companyId = profile.role === 'company' ? profile.id : profile.company_id;
    const { data: companyData } = await supabase.from('companies').select('id').eq('owner_id', companyId).maybeSingle();
    const actualCompanyId = companyData?.id || companyId;
    console.log('Actual Company ID:', actualCompanyId);

    const { data: visits, error } = await supabase.from('visits').select('id, visit_date').eq('company_id', actualCompanyId);
    console.log('Total visits found for company:', visits ? visits.length : 0);
    if (visits && visits.length > 0) {
        console.log('First visit date:', visits[0].visit_date);
    }
    if (error) console.log('Error:', error);
}
test();

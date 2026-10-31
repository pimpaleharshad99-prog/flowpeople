import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yzcrifmqwgfkfikkimeu.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_bEuL6GdEhvU5XlukkZpwng_LUNq3Nrp';

export const supabase = createClient(supabaseUrl, supabaseKey);
export default supabase;


import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.0';
import {adminCreateUserHandler} from './handler.js';
const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth:{persistSession:false, autoRefreshToken:false}});
Deno.serve(adminCreateUserHandler(client));

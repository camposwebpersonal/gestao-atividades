// Cliente PÚBLICO do Supabase (chave anônima, a mesma do site) para páginas abertas sem login:
// conferir.html (link de conferência) e mulher.html (ficha somente leitura pelo QR).
// A chave anônima não dá acesso a tabela nenhuma (RLS); só às funções pms_share_* / pms_mulher_publica.
export const SUPABASE_URL = 'https://xwlmpxypjheuhbxyfplo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3bG1weHlwamhldWhieHlmcGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjQ1OTEsImV4cCI6MjA5OTU0MDU5MX0.ugbn_guMLqk_I9I9OElI_VKAA8pDpW3trVWr1lT9oQU';
let client = null;
// a biblioteca só é baixada quando precisa (a página abre rápido e os testes rodam sem internet)
export async function publicDb() {
  if (!client) { const {createClient} = await import('https://esm.sh/@supabase/supabase-js@2.49.0?bundle'); client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {auth: {persistSession: false, autoRefreshToken: false}}); }
  return client;
}
// Testes injetam window.__PUBLIC_RPC (função async (nome, args) => data) para rodar sem internet.
export async function rpc(name, args) {
  if (typeof window !== 'undefined' && window.__PUBLIC_RPC) return window.__PUBLIC_RPC(name, args);
  const {data, error} = await (await publicDb()).rpc(name, args);
  if (error) throw new Error(error.message || 'Falha de comunicação');
  return data;
}

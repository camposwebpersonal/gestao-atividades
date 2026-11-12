-- Função de gatilho não precisa ser chamável pela API.
revoke execute on function public.pms_whatsapp_enqueue() from public, anon, authenticated;

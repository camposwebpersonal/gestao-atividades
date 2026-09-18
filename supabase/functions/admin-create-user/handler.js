export function adminCreateUserHandler(client) {
  const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
  const reply = (status, body) => new Response(JSON.stringify(body), {status, headers});
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers});
    if (request.method !== 'POST') return reply(405, {message:'Método não permitido.'});
    try {
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      if (!token) return reply(401, {message:'Entre novamente para cadastrar usuários.'});
      const {data:identity, error:identityError} = await client.auth.getUser(token);
      if (identityError || !identity.user) return reply(401, {message:'Entre novamente para cadastrar usuários.'});
      const {data:profile, error:profileError} = await client.from('users').select('role,is_admin').eq('id', identity.user.id).maybeSingle();
      if (profileError || !profile || !(profile.role === 'admin' || profile.is_admin === true)) return reply(403, {message:'Apenas administradores podem cadastrar usuários.'});
      const body = await request.json();
      const username = String(body.username || '').trim().toLowerCase();
      const name = String(body.name || '').trim();
      if (!/^[a-z0-9]{2,}$/.test(username) || !name || typeof body.password !== 'string' || body.password.length < 6) return reply(400, {message:'Preencha nome, usuário e senha com pelo menos 6 caracteres.'});
      const {data, error} = await client.auth.admin.createUser({email:username+'@pms.sertania.pe.gov.br',password:body.password,email_confirm:true,user_metadata:{display_name:name}});
      if (error) return reply(error.status || 400, {message:error.code === 'email_exists' ? 'Este nome de usuário já existe. Escolha outro.' : 'Não foi possível criar o usuário. Verifique os dados e a configuração administrativa.'});
      return reply(201, {id:data.user.id});
    } catch {
      return reply(500, {message:'Não foi possível concluir o cadastro.'});
    }
  };
}

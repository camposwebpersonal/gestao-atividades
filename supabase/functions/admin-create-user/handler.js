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
      const {data:profile, error:profileError} = await client.from('users').select('*').eq('id', identity.user.id).maybeSingle();
      if (profileError) return reply(500, {message:'Não foi possível consultar o perfil administrativo. Verifique os logs da função.'});
      if (!profile) return reply(403, {message:'Seu login não possui perfil na tabela users. Cadastre o perfil administrativo com o mesmo ID do login.'});
      let extra = profile.extra_fields || {};
      if (typeof extra === 'string') {
        try { extra = JSON.parse(extra); } catch { extra = {}; }
      }
      const role = profile.role ?? extra.role;
      const isAdmin = profile.is_admin ?? extra.is_admin ?? extra.isAdmin;
      if (!(role === 'admin' || isAdmin === true)) return reply(403, {message:'Seu perfil na tabela users não tem permissão administrativa.'});
      const body = await request.json();
      if (body.action === 'update' || body.action === 'password') {
        if (!body.id || typeof body.id !== 'string') return reply(400, {message:'Selecione o usuário a editar.'});
        const {data:target,error:targetError} = await client.from('users').select('*').eq('id',body.id).maybeSingle();
        if (targetError || !target) return reply(404, {message:'Este perfil não possui login vinculado. Regularize o cadastro antes de editar o acesso.'});
        if (body.action === 'password') {
          if (typeof body.password !== 'string' || body.password.length < 6) return reply(400,{message:'A senha deve ter pelo menos 6 caracteres.'});
          const {error} = await client.auth.admin.updateUserById(body.id,{password:body.password});
          if (error) return reply(400,{message:'Não foi possível alterar a senha deste login.'});
          if ('updated_by' in target) {
            const {error:auditError}=await client.from('users').update({updated_by:identity.user.id,updated_by_name:profile.display_name||identity.user.email?.split('@')[0],updated_at:new Date().toISOString()}).eq('id',body.id);
            if (auditError) return reply(500,{message:'A senha foi alterada, mas não foi possível registrar a autoria. Confira os logs da função.'});
          }
          return reply(200,{updated:true});
        }
        const username = String(body.username || '').trim().toLowerCase();
        if (!/^[a-z0-9]{2,}$/.test(username) || !String(body.name||'').trim()) return reply(400,{message:'Informe nome e usuário com pelo menos 2 letras/números.'});
        const newEmail=username+'@pms.sertania.pe.gov.br';
        const {data:account,error:accountError}=await client.auth.admin.getUserById(body.id);
        if (accountError || !account.user) return reply(404,{message:'Este perfil não possui uma conta de autenticação.'});
        const originalEmail=account.user.email;
        const {error:loginError}=await client.auth.admin.updateUserById(body.id,{email:newEmail,email_confirm:true,user_metadata:{...account.user.user_metadata,display_name:String(body.name).trim()}});
        if (loginError) return reply(400,{message:'Não foi possível alterar o login. Confira se o novo usuário já existe.'});
        const requested=body.profile||{};
        let oldExtra=target.extra_fields||{};if(typeof oldExtra==='string'){try{oldExtra=JSON.parse(oldExtra);}catch{oldExtra={};}}
        const payload={email:newEmail,display_name:String(body.name).trim(),role:['admin','gestor','usuario'].includes(requested.role)?requested.role:target.role,is_admin:requested.role?requested.role==='admin':target.is_admin,email_contato:String(requested.email_contato??target.email_contato??'').trim().toLowerCase(),setor_id:requested.setor_id||null,responsavel_id:requested.responsavel_id||null,extra_fields:{...oldExtra,permissoes:requested.permissoes??oldExtra.permissoes??{modulos:{}}},updated_at:new Date().toISOString()};
        if ('updated_by' in target) Object.assign(payload,{updated_by:identity.user.id,updated_by_name:profile.display_name||identity.user.email?.split('@')[0]});
        const {error:saveError}=await client.from('users').update(payload).eq('id',body.id);
        if (saveError) {
          const {error:restoreError}=await client.auth.admin.updateUserById(body.id,{email:originalEmail,email_confirm:true,user_metadata:account.user.user_metadata});
          return reply(500,{message:restoreError?'Falha ao salvar perfil e restaurar login. Confira o usuário em Authentication.':'Não foi possível salvar o perfil. O login anterior foi restaurado.'});
        }
        return reply(200,{updated:true,id:body.id,email:newEmail});
      }
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

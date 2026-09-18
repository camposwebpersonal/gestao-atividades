// Identificador interno de autenticação; o e-mail de contato é opcional.
const LOGIN_DOMAIN = '@pms.sertania.pe.gov.br';
const LEGACY_DOMAIN = '@pms.sertania';

export function normalizeUsername(value) {
  return (value || '').trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}
export function usernameFromEmail(email) {
  if ((email || '').toLowerCase() === 'camposweb.personal@gmail.com') return 'rcampos';
  return (email || '').replace(/@pms\.sertania(?:\.pe\.gov\.br)?$/i, '');
}
export function userEmail(username) {
  return normalizeUsername(username) + LOGIN_DOMAIN;
}
export function loginEmails(username) {
  const user = normalizeUsername(username);
  if (user === 'rcampos') return ['camposweb.personal@gmail.com'];
  return [user + LOGIN_DOMAIN, user + LEGACY_DOMAIN];
}
export async function signInUsername(auth, username, password) {
  const emails = loginEmails(username);
  let result;
  for (const email of emails) {
    result = await auth.signInWithPassword({ email, password });
    if (!result.error || !['invalid_credentials', 'Invalid login credentials'].includes(result.error.code || result.error.message)) break;
  }
  return result;
}

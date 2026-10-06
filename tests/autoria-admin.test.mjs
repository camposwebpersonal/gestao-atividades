import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {adminAuditFields,auditInputValue,auditUserId,readAdminAudit} from '../js/autoria.js';

const users=[
  {id:'u1',displayName:'Carlos Ednailton',email:'carlos@pms.sertania'},
  {id:'u2',display_name:'Ricardo Campos',email:'ricardo@pms.sertania'}
];
const record={created_by:'u1',created_by_name:'Carlos Ednailton',created_at:'2026-10-06T12:11:00Z',updated_by_name:'Ricardo Campos',updated_at:'2026-10-06T12:14:00Z'};

function root(values){return {getElementById:id=>({value:values[id]??''})};}

test('formulário administrativo oferece somente usuários cadastrados e encontra legado pelo nome',()=>{
  assert.equal(auditUserId(record,'created',users),'u1');
  assert.equal(auditUserId(record,'updated',users),'u2');
  const html=adminAuditFields(record,users,'hist');
  assert.match(html,/Criado por/);assert.match(html,/Última edição por/);
  assert.match(html,/Carlos Ednailton/);assert.match(html,/Ricardo Campos/);
  assert.ok(!html.includes('Fulano inexistente'));
});

test('campos administrativos intactos não sobrescrevem a edição automática',()=>{
  const values={
    'hist-created-user':'u1','hist-updated-user':'u2',
    'hist-created-at':auditInputValue(record.created_at),'hist-updated-at':auditInputValue(record.updated_at)
  };
  assert.equal(readAdminAudit('hist',record,users,root(values)),null);
});

test('alterações de autor e data enviam apenas correções explícitas',()=>{
  const values={
    'hist-created-user':'u2','hist-updated-user':'u2',
    'hist-created-at':auditInputValue(record.created_at),'hist-updated-at':'2026-10-06T10:30'
  };
  const changes=readAdminAudit('hist',record,users,root(values));
  assert.equal(changes.created_user_id,'u2');
  assert.equal(changes.updated_user_id,null);
  assert.equal(changes.created_at_value,null);
  assert.equal(changes.updated_at_value,new Date('2026-10-06T10:30').toISOString());
});

test('RPC de autoria exige administrador, limita tabelas e revoga acesso público',()=>{
  const sql=fs.readFileSync(new URL('../supabase/migrations/20261006142625_admin_edit_record_audit.sql',import.meta.url),'utf8');
  assert.match(sql,/SECURITY DEFINER/);assert.match(sql,/actor\.role='admin'/);assert.match(sql,/record_table NOT IN \('atividades','items','subitems'\)/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.admin_update_record_audit[\s\S]*FROM PUBLIC/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.admin_update_record_audit[\s\S]*FROM anon/);
  assert.match(sql,/GRANT EXECUTE[\s\S]*TO authenticated/);
  const dates=fs.readFileSync(new URL('../supabase/migrations/20261006142902_preserve_admin_audit_dates.sql',import.meta.url),'utf8');
  assert.match(dates,/pms\.audit_override/);
  const hardening=fs.readFileSync(new URL('../supabase/migrations/20261006143037_harden_audit_functions.sql',import.meta.url),'utf8');
  assert.match(hardening,/admin_update_record_audit[\s\S]*SECURITY INVOKER/);
  assert.match(hardening,/pms_record_author\(\)[\s\S]*FROM authenticated/);
  const protection=fs.readFileSync(new URL('../supabase/migrations/20261006143308_protect_record_creation_dates.sql',import.meta.url),'utf8');
  assert.match(protection,/NEW\.created_at=OLD\.created_at/);
  assert.match(protection,/NEW\.updated_at<NEW\.created_at/);
  assert.match(protection,/\['atividades','items','subitems'\]/);
  const roles=fs.readFileSync(new URL('../supabase/migrations/20261006143720_modernize_audit_role_check.sql',import.meta.url),'utf8');
  assert.ok(!roles.includes('auth.role()'));
  assert.match(roles,/auth\.jwt\(\)->>'role'/);
});

test('login não revela nome de usuário administrativo',()=>{
  const login=fs.readFileSync(new URL('../login.html',import.meta.url),'utf8');
  assert.ok(!/placeholder=["'][^"']*RCAMPOS/i.test(login));
});

test('campos de autoria ficam condicionados ao administrador nos dois editores',()=>{
  const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(page,/id&&S\.isAdmin\?adminAuditFields\(s,S\.users,'s-audit'\)/);
  assert.match(page,/id&&S\.isAdmin\?adminAuditFields\(it,S\.users,'it-audit'\)/);
  assert.match(page,/updateRecordAuditAdmin\(\{record_table:'atividades'/);
  assert.match(page,/updateRecordAuditAdmin\(\{record_table:colName/);
});

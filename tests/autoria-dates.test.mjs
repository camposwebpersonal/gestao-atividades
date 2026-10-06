import test from 'node:test';
import assert from 'node:assert/strict';
import {auditLabel} from '../js/autoria.js';

test('autoria mostra data de lançamento e da última edição',()=>{
  const html=auditLabel({created_by_name:'Carlos',created_at:'2026-10-06T12:30:00Z',updated_by_name:'Ricardo',updated_at:'2026-10-06T14:00:00Z'});
  assert.match(html,/Criado por <strong>Carlos<\/strong>.*em 06\/10\/2026/s);
  assert.match(html,/Última edição por <strong>Ricardo<\/strong>.*em 06\/10\/2026/s);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('./sql/',import.meta.url));
for(const file of ['phase6_rls_isolation_rollback.sql','phase6_vehicle_collision_rollback.sql']){
  test(file+' is explicitly staging-scoped and always ends with rollback',()=>{
    const sql=readFileSync(dir+file,'utf8');
    assert.match(sql,/^-- PHASE 6: RUN ONLY AGAINST APPROVED Andertrack Staging /);
    assert.match(sql,/\bBEGIN;/);
    assert.match(sql,/ROLLBACK;\s*$/);
    assert.doesNotMatch(sql,/\bCOMMIT\s*;/i);
    assert.doesNotMatch(sql,/\bINSERT\s+INTO\s+(?:public\.)?auth\.users\b/i);
    assert.doesNotMatch(sql,/\bINSERT\s+INTO\s+public\.at_dispatch_requests\b/i);
    assert.match(sql,/RAISE EXCEPTION/);
    assert.match(sql,/PHASE6-/);
  });
}

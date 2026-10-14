// Frozen default-mode compatibility vectors; they do not certify budget-aware tails.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {EncounterManager} from './dist/core/encounter-manager.mjs';
import {fixture} from './core-fixture.mjs';

export function executeVector(vector){
 const m=new EncounterManager({config:vector.config,runtime:vector.runtime});
 let serial=0,ready=true;
 const adapter={assetsReady:()=>ready,canEnter:()=>true,commitSpawn:p=>({success:true,actorIds:p.members.map(()=>`unit-${++serial}`)})};
 m.updatePortals([{id:'front',tags:['forward'],eligible:true}]);
 const commits=[];
 for(const action of vector.actions){
  if(action.type==='budget')m.applyOnce(action.id,action.operations);
  if(action.type==='release')m.transfer(action.amount,action.source??null,'vector');
  if(action.type==='request')m.requestSpawn();
  if(action.type==='portals')m.updatePortals(action.portals);
  if(action.type==='assets')ready=action.ready;
  if(action.type==='tick')m.tick(action.dt,adapter);
  for(const event of m.drainEvents())if(event.type==='spawn-committed')commits.push({time:event.time,cost:event.group.cost,portal:event.entrance,members:event.group.members.map(e=>e.id)});
 }
 const s=m.snapshot();return {potential:s.potential,available:s.available,spent:s.spent,nextCost:s.next?.cost??null,waitReason:s.waitReason,commits};
}
const filename='director-conformance-vectors.json';
if(process.argv.includes('--generate')){
 const budget=(add,transfer=0)=>({type:'budget',id:'budget',operations:{add,transfer}}),tick=dt=>({type:'tick',dt});
 const cases=[
  ['immediate-funded-arrival',[budget(8,8),tick(0)]],
  ['passive-forecast-to-funding',[budget(8,6),tick(.01),tick(.99)]],
  ['bonus-funding-during-forecast',[budget(8,6),tick(.2),{type:'release',amount:2},{type:'request'},tick(0)]],
  ['technical-recovery-after-trigger',[budget(20,20),tick(0),{type:'request'},tick(.5),tick(.5)]],
  ['blocked-portal-then-immediate-arrival',[budget(8,8),{type:'portals',portals:[]},tick(1),{type:'portals',portals:[{id:'front',tags:['forward'],eligible:true}]},tick(0)]],
  ['asset-readiness-without-fresh-warning',[budget(8,8),{type:'assets',ready:false},tick(1),{type:'assets',ready:true},tick(0)]],
 ];
 const vectors=cases.map(([name,actions])=>{const v={name,config:fixture,runtime:{engineRecoverySeconds:1,warningLeadSeconds:1},actions};return {...v,expected:executeVector(v)};});
 fs.writeFileSync(filename,JSON.stringify(vectors,null,2));console.log('Generated '+vectors.length+' portable JSON vectors');
}else{
 const vectors=JSON.parse(fs.readFileSync(filename,'utf8'));for(const v of vectors){assert.deepEqual(executeVector(v),v.expected,v.name);console.log('PASS '+v.name);}console.log(vectors.length+' director conformance vectors passed');
}

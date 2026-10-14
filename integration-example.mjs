import {EncounterManager} from './dist/core/encounter-manager.mjs';
import {fixture} from './core-fixture.mjs';
const manager=new EncounterManager({config:{...fixture,portalPreferences:['behind','forward']}});
let serial=0;const active=new Set();
const adapter={assetsReady:()=>true,canEnter:()=>true,commitSpawn:group=>({success:true,actorIds:group.members.map(()=>++serial)})};
manager.updatePortals([{id:'front',tags:['forward'],eligible:true},{id:'rear',tags:['behind'],eligible:true}]);
manager.applyOnce('zone-activation',{add:100});
manager.applyOnce('first-entry',{transfer:25,trigger:true});
for(let i=0;i<120;i++){
 manager.tick(.1,adapter);
 for(const event of manager.drainEvents())if(event.type==='spawn-committed')event.actorIds.forEach(id=>active.add(id));
 // Placeholder combat belongs to the host, never the encounter core.
 if(i%10===0)for(const id of active){manager.notifyDefeat(id);active.delete(id);}
 if(i===70)manager.beginFinalSpend('No more route allocations');
}
console.log(manager.snapshot());manager.verify();

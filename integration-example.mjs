import {EncounterManager} from './dist/core/encounter-manager.mjs';
import {fixture} from './core-fixture.mjs';
// Enable the current composition contract explicitly; core default preserves legacy callers.
const manager=new EncounterManager({config:{...fixture,portalPreferences:['behind','forward']},runtime:{budgetAwareComposition:true,warningLeadSeconds:6}});
let serial=0;const active=new Set();
const adapter={assetsReady:()=>true,canEnter:()=>true,commitSpawn:group=>({success:true,actorIds:group.members.map(()=>++serial)})};
manager.updatePortals([{id:'front',tags:['forward'],eligible:true},{id:'rear',tags:['behind'],eligible:true}]);
manager.applyOnce('zone-activation',{add:100});
manager.applyOnce('first-entry',{transfer:25,trigger:true});
for(let i=0;i<1000&&(!manager.budgetComplete||active.size);i++){
 manager.tick(.1,adapter);
 for(const event of manager.drainEvents())if(event.type==='spawn-committed')event.actorIds.forEach(id=>active.add(id));
 // Placeholder combat belongs to the host, never the encounter core.
 if(i%10===0)for(const id of active){manager.notifyDefeat(id);active.delete(id);}
}
if(!manager.budgetComplete||active.size)throw new Error('Example did not consume its fundable groups and clear opposition');
console.log(manager.snapshot());manager.verify();

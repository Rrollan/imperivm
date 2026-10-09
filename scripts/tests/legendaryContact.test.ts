import assert from 'node:assert/strict';
import {legendaryContact,LEGENDARY_CONTACT_MS} from '../../components/presentation/legendaryContact';
import {fighterRow} from '../../components/presentation/battleLayout';

for(const compact of [false,true])for(const count of [1,5,7,9]){
 const row=fighterRow(count,0,false,compact),bounds={width:row.width/50,height:row.height/50,spacing:row.spacing/50};
 let peak=0;
 for(let age=0;age<=LEGENDARY_CONTACT_MS+100;age+=10){
  const contact=legendaryContact(age,bounds);peak=Math.max(peak,contact.opacity);
  assert(Number.isFinite(contact.x)&&Number.isFinite(contact.y)&&Number.isFinite(contact.opacity));
  assert(Math.abs(contact.x)<=.055&&Math.abs(contact.y)<=.036,'Camera impulse is bounded below three table pixels');
  assert(contact.width/2<bounds.spacing,'A scar cannot reach a neighbouring fighter centre');
  assert(contact.opacity>=0&&contact.opacity<=.78);
  if(age>=320)assert(contact.x===0&&contact.y===0,'Shake ends quickly with no remaining offset');
  if(age>=LEGENDARY_CONTACT_MS)assert.equal(contact.opacity,0,'Marble returns to its original state');
 }
 assert(peak>.7,'The temporary cracks become visible');
 const reduced=legendaryContact(100,bounds,true);assert.equal(reduced.opacity,0);assert.equal(reduced.x,0);assert.equal(reduced.y,0);
}
console.log('LEGENDARY CONTACT OK: finite damping, zero residual camera offset, temporary bounded scars, crowded/mobile spacing and reduced motion.');

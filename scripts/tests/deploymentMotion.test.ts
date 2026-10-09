import assert from 'node:assert/strict';
import {deploymentDrop,deploymentContact,isArrivalClip} from '../../components/presentation/deploymentMotion';
for(const heavy of [false,true]){
 const start=deploymentDrop(0,heavy),end=deploymentDrop(1,heavy);
 assert.equal(start.travel,0);assert.equal(start.lift,0);
 assert.equal(end.travel,1);assert.equal(end.lift,0);assert.equal(end.scale,1);assert.equal(end.tiltX,0);
 let before=0;
 for(let i=0;i<=100;i++){const p=deploymentDrop(i/100,heavy);assert(Object.values(p).every(Number.isFinite));assert(p.travel>=before);before=p.travel;assert(p.lift>=0);assert(p.scale>=1&&p.scale<=1.1,'The depth cue preserves a modest, uniform footprint');}
 assert.equal(deploymentDrop(.9,heavy).travel,1,'XY socket alignment completes before surface contact');
 assert(deploymentDrop(.96,heavy).lift<deploymentDrop(.9,heavy).lift,'The final phase falls down instead of spawning upward');
 for(const time of [0,16,50,100,250,1000]){const p=deploymentContact(time,heavy);assert(p.lift>=0);assert(Object.values(p).every(Number.isFinite));}
 assert(deploymentContact(1000,heavy).lift<.0001,'The physical piece settles at its authoritative position');
}
assert(deploymentDrop(.5,true).lift>deploymentDrop(.5,false).lift);
for(const id of ['10-deploy-legionary','23-zeus-apparition','26-firmware-landing','35-dionysus-apparition'])assert(isArrivalClip(id));
for(const id of ['06-victory','18-olympian-lightning','19-diamond-phalanx','22-titan-cleave','37-oracle-impact'])assert(!isArrivalClip(id),'Attack, ability and result effects remain available');
console.log('NATIVE DROP OK: exact endpoints, aligned sockets, downward contact, rigid settling, heavy weight and preserved combat clips.');

import assert from 'node:assert/strict';
import {aimPath} from '../../components/presentation/aimPath';
import {targetingInsets,targetingEdge} from '../../components/presentation/targetingGeometry';
for(const [dx,dy] of [[10,0],[-10,0],[0,10],[0,-10],[8,6],[-8,-6],[.8,.7]]){
 const distance=Math.hypot(dx,dy)*50,edge=targetingEdge(dx,dy,30,30),insets=targetingInsets(distance,edge,edge),path=aimPath({x:0,y:0,z:0},{x:dx,y:dy,z:0},insets.sourceInset,insets.targetInset,insets.headLength);
 assert.ok(path);for(const p of [path.a,path.b,path.control])assert.ok(Object.values(p).every(Number.isFinite));
 assert.ok(path.control.z<path.a.z,'Depth lift points toward our negative-Z camera');
 assert.ok(Math.abs(Math.hypot(path.a.x,path.a.y)*50-insets.sourceInset)<.0001);
 assert.ok(Math.abs(Math.hypot(path.b.x-dx,path.b.y-dy)*50-insets.targetInset)<.0001);
 assert.ok(path.head<=Math.max(.08,insets.headLength/50));
}
assert.equal(aimPath({x:0,y:0,z:0},{x:0,y:0,z:0},30,30,20),null);
assert.equal(aimPath({x:0,y:0,z:0},{x:1,y:0,z:0},30,30,20),null,'Overlapping faces must not draw a backwards arrow');
assert.equal(aimPath({x:0,y:0,z:0},{x:NaN,y:0,z:0},0,0,20),null);
console.log('AIM GEOMETRY OK: all directions, short/overlapping lanes, aperture insets and negative-Z lift.');

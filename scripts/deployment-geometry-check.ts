import assert from 'node:assert/strict';
import {fighterRow} from '../components/presentation/battleLayout';
import {landingDiameter,spritePlacement} from '../components/presentation/deploymentGeometry';

let layouts=0;
for(const portrait of [false,true])for(const owner of [0,1])for(const count of [1,3,5,7,9]){
  const row=fighterRow(count,owner,portrait);
  const bounds={width:row.width/50,height:row.height/50,spacing:row.spacing/50};
  for(const id of ['23-zeus-apparition','24-athena-apparition','25-hades-apparition']){
    const placement=spritePlacement(id,5.8,bounds);
    const visibleWidth={'23-zeus-apparition':.64,'24-athena-apparition':.72,'25-hades-apparition':.68}[id]!;
    const footY={'23-zeus-apparition':.94,'24-athena-apparition':.97,'25-hades-apparition':.94}[id]!;
    assert.ok(placement.width*visibleWidth<=bounds.spacing*1.1+1e-8,'A full apparition, including its shield, fits its row slot');
    assert.ok(Math.abs(placement.offsetY+placement.height*(.5-footY))<1e-8,'Authored feet remain on the played card centre');
    assert.ok(Math.abs(placement.width/placement.height-16/9)<1e-8,'The figure cannot be stretched to fit');
  }
  for(const heavy of [false,true])assert.ok(landingDiameter(bounds,heavy)/2<bounds.spacing,'A landing shock cannot reach a neighbouring card centre');
  const ordinary=spritePlacement('15-deploy-engineer',4,bounds);
  assert.equal(ordinary.offsetY,0,'Ordinary contact stays at the card centre');
  assert.ok(ordinary.depth>-.15&&ordinary.depth<1.7,'Surface contact is behind the card and in front of the table');
  layouts++;
}
const impact=spritePlacement('18-olympian-lightning',4);
assert.equal(impact.width,4,'An attack with no fighter bounds retains its authored target size');
console.log(`DEPLOYMENT GEOMETRY OK: ${layouts} layouts, both players, desktop and crowded mobile rows, anchored feet, preserved proportions and readable surface contacts.`);

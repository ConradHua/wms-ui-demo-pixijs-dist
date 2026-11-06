/* Current rack only; the warehouse owns the Application, camera and gesture listeners. */
(function (root) {
'use strict';
root.WarehouseRackView = {create({parent, detail, theme, project, textStyle, onLocator, canSelect}) {
 const P=root.PIXI, container=new P.Container(), cells=new Map(), cellLabels=[];
 parent.addChild(container);
 let selectedLocatorId='';
 const color=key=>Number.parseInt(theme.tokens[key].slice(1),16);
 const rack=detail.rack, frame=new P.Graphics(), overlay=new P.Graphics();
 const ink=color('text'), steel=color('scene-steel'), beam=color('scene-rack');
 function polygon(g,points,fill,alpha=1,edge=steel,width=.5){g.poly(points.flatMap(p=>[p.x,p.y])).fill({color:fill,alpha}).stroke({color:edge,width});}
 function line(a,b,c=steel,width=.8){frame.moveTo(a.x,a.y).lineTo(b.x,b.y).stroke({color:c,width});}
 function label(value,point,size=4,fill=ink){
  const t=new P.Text({text:value,resolution:2,style:textStyle({fontFamily:'Segoe UI,Arial,sans-serif',fontSize:size,fill,fontWeight:'600'})});
  t.anchor.set(.5);t.position.set(point.x,point.y);t.eventMode='none';container.addChild(t);return t;
 }
 const top=Math.max(...rack.levels.map(l=>l.baseZ+l.height))+4;
 // Rear uprights remain behind the independently selectable front faces.
 for(const x of [0,rack.width])line(project(x,0,0),project(x,0,top));
 for(const level of rack.levels){
  const z=level.baseZ;
  const floor=new P.Graphics();
  polygon(floor,[project(0,0,z),project(rack.width,0,z),project(rack.width,rack.depth,z),project(0,rack.depth,z)],color('scene-floor'),.8);
  container.addChild(floor);
  for(const slot of level.slots){
   const mapping=detail.mappings.find(m=>m.levelIndex===level.levelIndex&&m.slotIndex===slot.slotIndex);
   const locator=detail.locators.find(l=>l.locatorId===mapping?.locatorId);
   const state=detail.states.find(s=>s.locatorId===locator?.locatorId);
   const status=!locator?'Unconfigured':state?.availability==='blocked'?'Disabled':state?.availability==='unknown'||state?.occupancy==='unknown'?'Unknown':state?.occupancy==='occupied'?'Occupied':'Empty';
   const token={Unconfigured:'neutral',Disabled:'error',Unknown:'warning',Occupied:'info',Empty:'success'}[status];
   const points=[project(slot.x+1,rack.depth,z+2),project(slot.x+slot.width-1,rack.depth,z+2),project(slot.x+slot.width-1,rack.depth,z+level.height-1),project(slot.x+1,rack.depth,z+level.height-1)];
   const face=new P.Graphics();polygon(face,points,color(token+'-soft'),.94,color(token),.45);container.addChild(face);
   const center=project(slot.x+slot.width/2,rack.depth,z+level.height/2);
   const title=locator?locator.segments.row+' / '+locator.segments.bin:'—';
   const titleLabel=label(title,{x:center.x,y:center.y-3},Math.min(6.2,slot.width*.25),color(token));
   const statusLabel=label(status,{x:center.x,y:center.y+5},Math.min(4.6,slot.width*.17),color(token));
   cellLabels.push({titleLabel,statusLabel,width:slot.width*.8-4,height:level.height*.88});
   if(locator){
    face.eventMode='static';face.cursor='pointer';face.hitArea=new P.Polygon(points.flatMap(p=>[p.x,p.y]));
    face.on('pointertap',()=>{if(canSelect())onLocator(locator.locatorId);});
    cells.set(locator.locatorId,{points,center,face,titleLabel,statusLabel});
   } else face.eventMode='none';
  }
  line(project(0,rack.depth,z),project(rack.width,rack.depth,z),beam,1.4);
  line(project(rack.width,0,z),project(rack.width,rack.depth,z),beam,.9);
  label('L'+(level.levelIndex+1),project(-10,rack.depth,z+level.height/2),4,color('text-muted'));
 }
 for(const x of [0,rack.width]){
  line(project(x,rack.depth,0),project(x,rack.depth,top),steel,1.6);
  line(project(x,0,top),project(x,rack.depth,top));
 }
 line(project(0,rack.depth,top),project(rack.width,rack.depth,top),beam,1.4);
 frame.eventMode='none';overlay.eventMode='none';container.addChild(frame,overlay);
 const bounds=container.getLocalBounds();
 return {
  container,bounds,
  updateLabels(scale){
   for(const cell of cellLabels){
    for(const [text,size] of [[cell.titleLabel,11],[cell.statusLabel,10]]){
     text.scale.set(Math.max(1,size/(text.style.fontSize*scale)));
     text.visible=text.width*scale<cell.width*scale && cell.height*scale>(text===cell.titleLabel?24:44);
    }
   }
  },
  filter(ids){const matched=new Set(ids);for(const [id,cell] of cells){for(const object of [cell.face,cell.titleLabel,cell.statusLabel])object.alpha=matched.has(id)?1:.25;}},
  select(id){selectedLocatorId=cells.has(id)?id:'';overlay.clear();const cell=cells.get(selectedLocatorId);if(cell)overlay.poly(cell.points.flatMap(p=>[p.x,p.y])).stroke({color:color('primary'),width:1.8});},
  point(id){const cell=cells.get(id);return cell?container.toGlobal(cell.center):null;},
  snapshot(){return {selectedLocatorId,mappedCells:cells.size,displayObjects:container.children.length,visibleCellLabels:cellLabels.reduce((n,c)=>n+Number(c.titleLabel.visible)+Number(c.statusLabel.visible),0)};},
  destroy(){cells.clear();container.destroy({children:true});}
 };
}};
})(window);

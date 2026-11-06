/* The original 05 cutaway, adapted into one reusable scene with business objects. */
(function(root){
'use strict';
root.WarehouseScene = {async mount(host, callbacks={}) {
const P=root.PIXI;
if(!P)throw new Error('The local scene library could not be loaded.');
let palette=root.WarehouseTheme.current;
const C={};
function readPalette(theme){
 palette=theme;
 const aliases={ink:'scene-ink',edge:'scene-edge',paper:'scene-paper',concrete:'scene-floor-side',concreteTop:'scene-floor',wall:'scene-wall',wallLight:'scene-wall-light',rust:'scene-rack',rustLight:'scene-rack-light',steel:'scene-steel',steelLight:'scene-steel-light',orange:'scene-equipment',yellow:'scene-safety',crate:'scene-crate',crateLight:'scene-crate-top',crateDark:'scene-crate-side',glass:'scene-glass',bg:'scene-bg',grid:'scene-grid',surface:'surface',labelInk:'text',border:'border',primary:'primary',onPrimary:'on-primary',success:'success',error:'error'};
 for(const [key,token] of Object.entries(aliases))C[key]=Number.parseInt(theme.tokens[token].slice(1),16);
 // Physical materials keep their recognizable purpose in all themes.
 Object.assign(C,{tire:0x263442,skin:0xd0ae87,shadow:0x000000});
}
readPalette(palette);
const app=new P.Application();
try{await app.init({resizeTo:host,backgroundAlpha:0,antialias:true,autoDensity:true,resolution:Math.min(devicePixelRatio||1,2),preference:'webgl',preserveDrawingBuffer:true});}
catch(error){if(app.renderer)app.destroy(true,{children:true});throw error;}
const displayResolution=Math.min(devicePixelRatio||1,2),gl=app.renderer.gl;
const debug=gl?.getExtension('WEBGL_debug_renderer_info');
const softwareRenderer=debug&&/SwiftShader|llvmpipe|software/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL));
const overviewResolution=softwareRenderer?.5:displayResolution;
function setResolution(value){if(app.renderer.resolution!==value){app.renderer.resolution=value;app.resize();}}
setResolution(overviewResolution);
// Pixi 8 keys managed text by TextStyle identity, even after releasing its texture.
// Reuse the finite styles so entering racks and changing themes cannot accumulate dead keys.
const textStyles=new Map();
function textStyle(options){const key=JSON.stringify(options);if(!textStyles.has(key))textStyles.set(key,new P.TextStyle(options));return textStyles.get(key);}
host.prepend(app.canvas);app.canvas.setAttribute('role','img');app.canvas.setAttribute('aria-label','Interactive warehouse. Use zone tabs or the destination input for keyboard access.');
const scene=new P.Container(),ground=new P.Container(),objects=new P.Container(),roof=new P.Container(),labels=new P.Container();
app.stage.addChild(scene);scene.addChild(ground,objects,roof,labels);objects.sortableChildren=true;
const overviewCamera={zoom:1,panX:0,panY:0,scale:1},rackCamera={zoom:1,panX:0,panY:0,scale:1};
let camera=overviewCamera,sceneType='overview',rackView=null,rackDetail=null,selectedLocatorId='',rackFilterIds=null;
const rackRoot=new P.Container();rackRoot.visible=false;app.stage.addChild(rackRoot);
const rackHighlights=[],artCache=new Map(),actors=[],textures=new Set();
function textureFor(target){const texture=app.renderer.generateTexture({target,resolution:2});textures.add(texture);return texture;}
let selectedZone='receiving',view='home',gesture=null,elapsed=0,active=true,disposed=false;
let paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
let business=null,currentJob=null,currentId='',target='B-03-02';
function p(x,y,z=0){return{x:(x-y)*.8,y:(x+y)*.4-z*.88};}
function flat(points){return points.flatMap(q=>[q.x,q.y]);}
function poly(g,points,color,alpha=1,width=.8,edge=C.edge){g.poly(flat(points));if(color!==null)g.fill({color,alpha});if(width)g.stroke({color:edge,width,alpha:Math.min(1,alpha+.2)});}
function line(g,a,b,color=C.edge,width=.8,alpha=1){g.moveTo(a.x,a.y).lineTo(b.x,b.y).stroke({color,width,alpha});}
function box(g,x,y,z,w,d,h,top=C.crateLight,side=C.crate,right=C.crateDark,pr=p){
poly(g,[pr(x+w,y,z),pr(x+w,y+d,z),pr(x+w,y+d,z+h),pr(x+w,y,z+h)],right);
poly(g,[pr(x,y+d,z),pr(x+w,y+d,z),pr(x+w,y+d,z+h),pr(x,y+d,z+h)],side);
poly(g,[pr(x,y,z+h),pr(x+w,y,z+h),pr(x+w,y+d,z+h),pr(x,y+d,z+h)],top);}
function text(label,x,y,size=16,fill=C.ink,weight='400',parent=ground){const t=new P.Text({text:label,style:textStyle({fontFamily:'Segoe UI,Arial,sans-serif',fontSize:size,fill,fontWeight:weight})});t.position.set(x,y);parent.addChild(t);return t;}
function worldText(label,x,y,z,angle,size=17,fill=C.ink,parent=ground){const a=p(x,y,z),t=text(label,a.x,a.y,size,fill,'600',parent);t.rotation=angle;return t;}
function fixed(g,depth){const c=new P.Container();c.zIndex=depth;c.addChild(g);objects.addChild(c);return c;}
function groundRect(g,x,y,w,d,fill,alpha=1,stroke=0){poly(g,[p(x,y),p(x+w,y),p(x+w,y+d),p(x,y+d)],fill,alpha,stroke);}
function selectZone(zone){selectedZone=zone;artwork.paintZone();callbacks.onZone?.(zone);}
function fit(){
if(disposed || !host.clientWidth || !host.clientHeight)return;
const w=host.clientWidth,h=host.clientHeight;
if(sceneType==='rack'){
 if(rackView){const b=rackView.bounds;camera.scale=Math.min((w-70)/b.width,(h-100)/b.height)*.9;
 rackRoot.scale.set(camera.scale*camera.zoom);rackRoot.position.set(w/2-(b.x+b.width/2)*rackRoot.scale.x+camera.panX,h/2-(b.y+b.height/2)*rackRoot.scale.y+camera.panY);rackView.updateLabels(rackRoot.scale.x);}
 host.querySelector('[data-zoom-value]').textContent=Math.round(camera.zoom*100)+'%';return;
}
const presets={home:{x:90,y:330,w:1700,h:1000},search:{x:-245,y:370,w:480,h:380},unload:{x:-260,y:380,w:800,h:460},putaway:{x:45,y:340,w:1240,h:650}};
const f=presets[view]||presets.home;camera.scale=Math.min(w/f.w,h/f.h)*.94;
scene.scale.set(camera.scale*camera.zoom);scene.position.set(w/2-f.x*scene.scale.x+camera.panX,h/2-f.y*scene.scale.y+camera.panY);
host.querySelector('[data-zoom-value]').textContent=Math.round(camera.zoom*100)+'%';
}
function setZoom(value){camera.zoom=Math.max(.65,Math.min(2.4,value));fit();}
const observer=new ResizeObserver(()=>{if(!disposed){app.resize();fit();}});observer.observe(host);
function buildArtwork(){
/* Site, construction grid and the cutaway slab. */
const site=new P.Graphics();
groundRect(site,-100,-100,1390,1080,C.bg,1,.8);
for(let x=-200;x<=1400;x+=50)line(site,p(x,-150),p(x,1050),C.grid,.7,palette.scheme==='dark'?.16:.28);
for(let y=-150;y<=1050;y+=50)line(site,p(-200,y),p(1400,y),C.grid,.7,palette.scheme==='dark'?.16:.28);
for(let x=-200;x<=1400;x+=250)line(site,p(x,-160),p(x,1060),C.grid,.7,palette.scheme==='dark'?.2:.32);
for(let y=-150;y<=1050;y+=250)line(site,p(-210,y),p(1410,y),C.grid,.7,palette.scheme==='dark'?.2:.32);
groundRect(site,-25,-25,1100,690,C.concrete,.3);
box(site,0,0,-8,1050,640,8,C.concreteTop,C.concrete,C.concrete);
for(let x=0;x<=1050;x+=70)line(site,p(x,0,.2),p(x,640,.2),C.grid,.7,.55);
for(let y=0;y<=640;y+=70)line(site,p(0,y,.2),p(1050,y,.2),C.grid,.7,.55);
groundRect(site,175,65,770,455,C.concreteTop,.2);
for(let i=0;i<6;i++){
  const x=60+i*156;groundRect(site,x,660,102,190,null,1,1.5);
  line(site,p(x,845),p(x+102,845),C.yellow,2);
  for(let j=0;j<3;j++)line(site,p(x+8,674+j*7),p(x+92,674+j*7),C.yellow,1.4,.8);
  worldText(String(i+1).padStart(2,'0'),x+40,856,0,Math.atan(.5),17,C.ink);
}
for(let i=0;i<3;i++){
  const y=80+i*165;groundRect(site,1060,y,180,110,null,1,1.5);
  line(site,p(1240,y),p(1240,y+110),C.yellow,2);
}
for(let x=40;x<1020;x+=100)line(site,p(x,918),p(x+48,918),C.yellow,3,.8);
for(let y=20;y<620;y+=90)line(site,p(1260,y),p(1260,y+45),C.yellow,3,.8);
for(const y of [82,242,553]){
  line(site,p(180,y,1),p(935,y,1),C.yellow,2,.7);
  for(let x=290;x<900;x+=200){poly(site,[p(x,y-5,1),p(x+18,y,1),p(x,y+5,1)],C.yellow,.85,0);}
}
for(const x of [190,960])line(site,p(x,55,1),p(x,580,1),C.yellow,1.5,.6);
ground.addChild(site);
const zoneFloor=new P.Graphics();ground.addChild(zoneFloor);
function paintZone(){
  zoneFloor.clear();
  if(selectedZone==='receiving'){if(view==='home')groundRect(zoneFloor,5,520,1040,118,C.rust,.07,1.5);else groundRect(zoneFloor,210,520,245,100,C.rust,.08,2);}
  if(selectedZone==='storage')groundRect(zoneFloor,210,110,720,400,C.rust,.1,1.5);
  if(selectedZone==='dispatch')groundRect(zoneFloor,965,55,85,540,C.rust,.15,1.5);
  ground.updateCacheTexture();
}
const groundHotspots=[
['receiving',[[0,500],[1050,500],[1050,640],[0,640]]],
['storage',[[180,60],[960,60],[960,510],[180,510]]],
['dispatch',[[960,40],[1050,40],[1050,600],[960,600]]]
];
for(const [zone,pts] of groundHotspots){
  const hit=new P.Graphics().poly(flat(pts.map(q=>p(...q)))).fill({color:C.rust,alpha:.001});
  hit.eventMode='static';hit.cursor='pointer';hit.on('pointertap',()=>{if(!gesture?.moved)selectZone(zone);});ground.addChild(hit);
}
/* Far masonry, service windows and steel frames. */
const back=new P.Graphics();
poly(back,[p(0,0),p(1050,0),p(1050,0,188),p(0,0,188)],C.wall);
poly(back,[p(0,0),p(0,640),p(0,640,188),p(0,0,188)],C.wallLight);
for(let x=0;x<=1050;x+=175){
  line(back,p(x,0),p(x,0,194),C.steel,5);
  line(back,p(x+5,0),p(x+5,0,194),C.steelLight,1.3);
}
for(let y=0;y<=640;y+=128)line(back,p(0,y),p(0,y,194),C.steel,5);
for(let z=30;z<185;z+=25){line(back,p(0,0,z),p(1050,0,z),C.edge,.7,.6);line(back,p(0,0,z),p(0,640,z),C.edge,.7,.6);}
for(let x=35;x<1040;x+=175){
  poly(back,[p(x,0,90),p(x+110,0,90),p(x+110,0,137),p(x,0,137)],C.glass);
  for(let k=0;k<=4;k++)line(back,p(x+k*27.5,0,90),p(x+k*27.5,0,137),C.steel,1.2);
  line(back,p(x,0,114),p(x+110,0,114),C.steel,1);
}
for(let y=70;y<600;y+=150){
  poly(back,[p(0,y,75),p(0,y+85,75),p(0,y+85,130),p(0,y,130)],C.glass);
  for(let k=1;k<4;k++)line(back,p(0,y+k*21,75),p(0,y+k*21,130),C.steel,1);
}
fixed(back,-1000);
const floorSigns=new P.Graphics();
for(let i=0;i<6;i++){groundRect(floorSigns,61+i*156,605,100,27,C.concrete,.5);line(floorSigns,p(61+i*156,602),p(161+i*156,602),C.yellow,3);}
ground.addChild(floorSigns);
worldText('RECEIVING  /  01',275,592,1,Math.atan(.5),18,C.ink);
worldText('STORAGE',460,72,1,Math.atan(.5),16,C.ink);
worldText('PICK & DISPATCH',1000,535,1,-Math.atan(.5),15,C.ink);

/* Individual rack bays sort with moving actors rather than being one flat picture. */
for(let row=0;row<3;row++)for(let bay=0;bay<7;bay++){
  const x=225+bay*100,y=125+row*160,w=90,d=52,h=158,g=new P.Graphics();
  groundRect(g,x-2,y-2,w+9,d+14,C.shadow,palette.scheme==='dark'?.09:.16);
  for(let level=0;level<4;level++){
    const z=9+level*38;
    box(g,x,y,z,w,d,3,C.steelLight,C.steel,C.edge);
    for(let slot=0;slot<3;slot++){
      if(slot===2 || (row*11+bay*3+level+slot)%17===0)continue;
      const xx=x+4+slot*28,yy=y+4,zz=z+4,hh=22+(bay+slot)%3*3;
      const shade=(bay+row+level+slot)%3;
      box(g,xx,yy,zz,24,43,hh,[C.crateLight,C.crateLight,C.crate][shade],C.crate,C.crateDark);
      line(g,p(xx+12,yy,zz+hh),p(xx+12,yy+43,zz+hh),C.crateDark,1);
      line(g,p(xx+12,yy+43,zz),p(xx+12,yy+43,zz+hh),C.crateDark,1);
      const a=p(xx+4,yy+43.3,zz+7);g.rect(a.x,a.y,8,3).fill(C.crateLight);
    }
  }
  for(const xx of [x,x+w])for(const yy of [y,y+d]){
    line(g,p(xx,yy,0),p(xx,yy,h),C.steel,3.8);
    line(g,p(xx+1,yy,0),p(xx+1,yy,h),C.steelLight,1);
  }
  for(let level=0;level<=4;level++){
    const z=7+level*38;line(g,p(x,y+d,z),p(x+w,y+d,z),C.rust,3.5);
    line(g,p(x+w,y,z),p(x+w,y+d,z),C.rustLight,2.7);
  }
  line(g,p(x+w,y,5),p(x+w,y+d,h-4),C.steel,1);
  line(g,p(x+w,y+d,5),p(x+w,y,h-4),C.steel,1);
  const rackBounds=g.getLocalBounds();
  const rackSprite=new P.Sprite(textureFor(g));
  rackSprite.position.set(rackBounds.x,rackBounds.y);g.destroy();
  const group=fixed(rackSprite,x+y+w+d);
  const hi=new P.Graphics();poly(hi,[p(x,y,h+1),p(x+w,y,h+1),p(x+w,y+d,h+1),p(x,y+d,h+1)],C.rust,.16,3,C.rust);hi.visible=false;group.addChild(hi);
  rackHighlights.push(hi);
  group.eventMode='static';group.cursor='pointer';
  const rackId=String.fromCharCode(65+row)+'-'+String(bay+1).padStart(2,'0');
  group.on('pointertap',()=>{if(gesture?.moved)return;if(view==='putaway'||view==='home')callbacks.onRack?.({physicalRackId:root.WarehouseRackData.overviewRackMap[rackId],sceneId:'scene-demo'});else callbacks.onZone?.('storage');});
  if(bay===0){const a=p(x-1,y+d,105);const t=text(String.fromCharCode(65+row),a.x-6,a.y,16,C.paper,'700',group);t.rotation=Math.atan(.5);}
}

/* Small packing benches and loading dock machinery. */
for(let i=0;i<4;i++){
  const g=new P.Graphics(),x=977,y=88+i*113;
  for(const a of [[0,0],[42,0],[0,62],[42,62]])box(g,x+a[0],y+a[1],0,3,3,30,C.steelLight,C.steel,C.steel);
  box(g,x-3,y-3,30,51,71,3,C.paper,C.steelLight,C.steel);
  box(g,x+7,y+10,33,26,27,19);
  box(g,x+5,y+43,33,16,13,12,C.crateLight,C.crate,C.crateDark);
  fixed(g,x+y+120);
}
for(let i=0;i<6;i++){
  const x=62+i*156,g=new P.Graphics();
  for(const xx of [x-5,x+102])box(g,xx,634,0,6,12,70,C.steelLight,C.steelLight,C.steel);
  poly(g,[p(x,639,45),p(x+100,639,45),p(x+100,639,70),p(x,639,70)],C.paper);
  line(g,p(x,639,45),p(x+100,639,45),C.steel,2);
  const a=p(x+41,640,66),t=text('0'+(i+1),a.x,a.y,12,C.ink,'600');t.rotation=Math.atan(.5);ground.removeChild(t);g.addChild(t);
  for(const xx of [x-7,x+105]){box(g,xx,651,0,4,4,22,C.yellow,C.yellow,C.ink);line(g,p(xx,653,7),p(xx,653,12),C.ink,3);}
  fixed(g,x+640+110);
}
for(let i=0;i<4;i++){
  const g=new P.Graphics(),y=45+i*174;
  box(g,1045,y,0,9,16,97,C.steelLight,C.concrete,C.steel);
  fixed(g,1045+y+20);
}
const office=new P.Graphics();
box(office,6,28,0,116,70,70,C.wall,C.wallLight,C.concrete);
for(let i=0;i<4;i++)poly(office,[p(25+i*21,99,32),p(41+i*21,99,32),p(41+i*21,99,58),p(25+i*21,99,58)],C.glass);
box(office,11,35,70,33,24,13,C.steelLight,C.steel,C.steel);
fixed(office,190);

/* Open roof trusses, deliberately separate and switchable. */
const roofG=new P.Graphics();
for(const x of [0,350,700,1050]){
  const a=p(x,0,193),b=p(x,320,248),c=p(x,640,193);
  line(roofG,a,b,C.steel,3,.8);line(roofG,b,c,C.steel,3,.8);line(roofG,a,c,C.steel,2,.6);
  for(let y=0;y<640;y+=80){const zz=193+(1-Math.abs(y+40-320)/320)*55;line(roofG,p(x,y,193),p(x,y+40,zz),C.steel,1,.65);line(roofG,p(x,y+40,zz),p(x,y+80,193),C.steel,1,.65);}
}
for(const y of [0,160,320,480,640]){
  const z=193+(1-Math.abs(y-320)/320)*55;line(roofG,p(0,y,z),p(1050,y,z),C.steel,1.5,.6);
}
roof.addChild(roofG);roof.alpha=.72;

/* Independent animated actors. */

function cachedArt(key,draw){
  if(!artCache.has(key)){const target=draw(),bounds=target.getLocalBounds();const texture=textureFor(target);artCache.set(key,{texture,x:bounds.x,y:bounds.y});target.destroy({children:true});}
  const asset=artCache.get(key),sprite=new P.Sprite(asset.texture);sprite.position.set(asset.x,asset.y);return sprite;
}
function groundShadow(g,pr=p,w=26,d=70){poly(g,[pr(-w-5,-d-3),pr(w+13,-d+7),pr(w+14,36),pr(-w-7,25)],C.shadow,palette.scheme==='dark'?.08:.13,0);}
function truckArt(axis='y'){
  const c=new P.Container(),g=new P.Graphics(),pr=(x,y,z=0)=>axis==='x'?p(y,x,z):p(x,y,z);
  groundShadow(g,pr,26,123);
  box(g,-24,-119,8,48,136,6,C.steel,C.ink,C.ink,pr);
  box(g,-25,-120,17,50,96,43,C.paper,C.wallLight,C.wall,pr);
  for(let y=-116;y<-26;y+=9){line(g,pr(25,y,21),pr(25,y,57),C.edge,.65,.65);line(g,pr(-22,y,60),pr(22,y,60),C.steelLight,.65,.7);}
  box(g,-25,-16,13,50,38,33,C.paper,C.wallLight,C.wall,pr);
  poly(g,[pr(-19,23,29),pr(19,23,29),pr(19,23,40),pr(-19,23,40)],C.glass,1,1);
  poly(g,[pr(25,-11,29),pr(25,16,29),pr(25,16,41),pr(25,-11,41)],C.glass);
  line(g,pr(-24,25,16),pr(24,25,16),C.ink,2);
  for(const x of [-22,18]){const a=pr(x,24,22);g.circle(a.x,a.y,2).fill(C.yellow);}
  for(const xx of [-27,27])for(const y of [-105,-86,9]){
    const a=pr(xx,y,8);g.ellipse(a.x,a.y,5,8).fill(C.tire).stroke({color:C.steel,width:.8});g.ellipse(a.x,a.y,2.4,4).fill(C.steelLight);
  }
  c.addChild(g);
  const q=pr(26,-101,44),t=text('MACNICA',q.x,q.y,10,C.ink,'600',c);t.rotation=axis==='y'?-Math.atan(.5):Math.atan(.5);
  return c;
}
function forkliftArt(direction=0){
  const c=new P.Container(),g=new P.Graphics();
  const pr=(u,v,z=0)=>{if(direction===0)return p(u,v,z);if(direction===1)return p(v,u,z);if(direction===2)return p(-u,-v,z);return p(-v,-u,z);};
  groundShadow(g,pr,18,48);
  for(const x of [-18,18])for(const y of [-12,18]){const a=pr(x,y,7);g.ellipse(a.x,a.y,4.8,7).fill(C.tire);}
  box(g,-17,-15,7,34,39,12,C.rustLight,C.rust,C.rust,pr);
  box(g,-15,8,19,30,14,13,C.orange,C.orange,C.rust,pr);
  for(const x of [-14,14]){line(g,pr(x,-14,16),pr(x,-14,54),C.ink,3);line(g,pr(x,13,29),pr(x,13,54),C.ink,2);}
  box(g,-18,-17,54,36,33,3,C.steelLight,C.steel,C.ink,pr);
  for(const x of [-13,13]){line(g,pr(x,-21,5),pr(x,-21,65),C.steel,3);line(g,pr(x,-21,7),pr(x,-58,7),C.steel,2.8);}
  box(g,-16,-58,8,32,30,22,C.crateLight,C.crate,C.crateDark,pr);
  const a=pr(0,1,39);g.circle(a.x,a.y,4).fill(C.skin);line(g,pr(0,3,21),pr(0,3,35),C.rust,7);
  c.addChild(g);return c;
}
function workerArt(){
  const c=new P.Container(),g=new P.Graphics(),legs=new P.Container();
  g.ellipse(2,1,7,2.8).fill({color:C.shadow,alpha:palette.scheme==='dark'?.1:.18});
  for(const x of [-2,2]){const leg=new P.Graphics().moveTo(0,0).lineTo(0,9).stroke({color:C.ink,width:2.1});leg.position.set(x,-9);legs.addChild(leg);}
  c.addChild(g,legs);
  const body=new P.Graphics();
  body.poly([-5,-20,4,-20,6,-9,-5,-9]).fill(C.rust).stroke({color:C.ink,width:.7});
  body.moveTo(-3,-19).lineTo(-2,-10).moveTo(2,-19).lineTo(3,-10).stroke({color:C.yellow,width:1.3});
  body.moveTo(-5,-18).lineTo(-8,-9).moveTo(5,-18).lineTo(8,-10).stroke({color:C.ink,width:2});
  body.circle(0,-25,4).fill(C.skin).stroke({color:C.ink,width:.6});
  body.ellipse(0,-28,4.7,2.2).fill(C.yellow).stroke({color:C.ink,width:.6});
  c.addChild(cachedArt('worker-body',()=>body));c.legs=legs;return c;
}
function palletArt(){
  const c=new P.Container(),g=new P.Graphics();
  box(g,0,0,0,30,27,4,C.crate,C.crateDark,C.crateDark);
  for(let i=0;i<2;i++)box(g,2+i*13,2,4,12,23,17+(i%2)*6);
  line(g,p(16,2,27),p(16,25,27),C.ink,.9);
  c.addChild(g);return c;
}
function route(points){
  let length=0;const segments=[];
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);segments.push({a,b,len,start:length});length+=len;}
  return {segments,length};
}
const workerRoutes=[
route([[190,580],[930,580],[930,535],[190,535]]),
route([[190,75],[950,75],[950,240],[190,240]]),
route([[980,70],[980,560],[1110,560],[1110,70]]),
route([[190,405],[950,405],[950,235],[190,235]])
];
const forkRoutes=[route([[170,550],[945,550],[945,235],[170,235]]),route([[968,72],[968,540],[1100,540],[1100,72]])];
function onRoute(r,distance){let d=((distance%r.length)+r.length)%r.length;const s=r.segments.find(s=>d<s.start+s.len)||r.segments[r.segments.length-1];const t=(d-s.start)/s.len;return {x:s.a[0]+(s.b[0]-s.a[0])*t,y:s.a[1]+(s.b[1]-s.a[1])*t,dx:s.b[0]-s.a[0],dy:s.b[1]-s.a[1]};}

/* Background activity is illustrative; operational pallets below have actual IDs and locations. */
function addActor(kind,index,x,y){
 const c=new P.Container();let art;
 if(kind==='truck')art=cachedArt('truck',()=>truckArt());
 else if(kind==='forklift')art=cachedArt('forklift',()=>forkliftArt(1));
 else art=workerArt();
 c.addChild(art);objects.addChild(c);actors.push({kind,index,c,art,x,y});
}
for(let i=0;i<3;i++)addActor('truck',i,110+i*156,800);
for(let i=0;i<3;i++)addActor('forklift',i,200+i*300,550);
for(let i=0;i<9;i++)addActor('worker',i,180+i*80,570);
roof.visible=false;
const operational=new P.Container();operational.sortableChildren=true;objects.addChild(operational);operational.zIndex=4000;
const routes=new P.Graphics();ground.addChild(routes);
function locationPoint(id){return root.WarehouseModel.locationPoint(id);}
function callout(parent,label,x,y,z=0,accent=false){
 const color=accent===true?C.primary:accent;
 const q=p(x,y,z),c=new P.Container(),t=new P.Text({text:label,style:textStyle({fontFamily:'Segoe UI,Arial,sans-serif',fontSize:20,fontWeight:'600',fill:accent?C.onPrimary:C.labelInk})});
 const g=new P.Graphics().roundRect(-12,-9,t.width+24,t.height+18,4).fill(accent?color:C.surface).stroke({color:accent?color:C.border,width:1.2});
 c.position.set(q.x,q.y);c.addChild(g,t);parent.addChild(c);return c;
}
const zoneLabels=new P.Container();labels.addChild(zoneLabels);
function renderBusiness(){
 operational.removeChildren().forEach(c=>c.destroy({children:true}));routes.clear();
 zoneLabels.removeChildren().forEach(c=>c.destroy({children:true}));
 if(view==='home'){
 for(const [id,label,x,y,z] of [['receiving','Inbound · '+(business?12:12)+' waiting',210,620,145],['storage','Storage · 84% occupied',600,290,250],['dispatch','Outbound · 8 scheduled',1045,390,150]]){
 const c=callout(zoneLabels,label,x,y,z,selectedZone===id);c.eventMode='static';c.cursor='pointer';c.on('pointertap',()=>{if(!gesture?.moved)selectZone(id);});
 }
 }
 if(!currentJob)return;
 currentJob.pallets.forEach((item,i)=>{
 let pos=root.WarehouseModel.isPutaway(item)?locationPoint(item.destinationLocatorId):{x:220+i*57,y:item.unloaded?557:655,z:0};
 if(!pos)return; // Unresolved placement stays in records, without invented coordinates.
 const c=new P.Container(),g=new P.Graphics(),q=p(pos.x,pos.y,pos.z);
 c.position.set(q.x,q.y);c.zIndex=pos.x+pos.y;c.addChild(g);box(g,0,0,0,38,31,5,C.crate,C.crateDark,C.crateDark);
 for(let n=0;n<4;n++)box(g,2+n%2*17,2+Math.floor(n/2)*14,5,16,13,22+(n%2)*5);
 if(root.WarehouseModel.isPutaway(item)){poly(g,[p(-4,-4),p(44,-4),p(44,37),p(-4,37)],C.success,.12,2,C.success);if(view==='putaway'){const label=callout(c,'✓ '+item.id,2,0,65,C.success);label.scale.set(.65);}}
 if(item.id===currentId){poly(g,[p(-4,-4),p(44,-4),p(44,37),p(-4,37)],C.rust,.14,2.5,C.rust);const label=callout(c,item.id,2,0,65,true);label.scale.set(.72);}
 c.eventMode='static';c.cursor='pointer';c.on('pointertap',()=>{if(!gesture?.moved)callbacks.onPallet?.(item.id);});operational.addChild(c);
 });
 if(view==='search'||view==='unload')callout(zoneLabels,'Dock '+currentJob.dock,180+(Number(currentJob.dock)-1)*156,650,110,true);
 if(view==='unload')callout(zoneLabels,'Receiving staging · RCV-02',530,530,110);
 if(view==='putaway'){
 const pos=locationPoint(target);
 if(pos && currentId){
 const valid=!business||root.WarehouseModel.validateLocation(business,target,currentId).valid,color=valid?C.primary:C.error;
 const g=new P.Graphics();
 poly(g,[p(pos.x-5,pos.y-4,pos.z),p(pos.x+40,pos.y-4,pos.z),p(pos.x+40,pos.y+33,pos.z),p(pos.x-5,pos.y+33,pos.z)],color,.13,2.8,color);
 const a=p(pos.x,pos.y,pos.z),b=p(pos.x,pos.y,pos.z+32);line(g,a,b,color,2.5);
 operational.addChild(g);callout(zoneLabels,(valid?'Target · ':'⚠ Unavailable · ')+target,pos.x,pos.y,pos.z+105,color);
 const pallet=currentJob.pallets.find(o=>o.id===currentId);
 const index=currentJob.pallets.indexOf(pallet),path=[[220+index*57,557],[220+index*57,525],[pos.x+50,525],[pos.x+50,pos.y],[pos.x,pos.y]];
 for(let i=0;i<path.length-1;i++){
 const a=p(...path[i]),b=p(...path[i+1]),length=Math.hypot(b.x-a.x,b.y-a.y);
 for(let d=0;d<length;d+=18){const end=Math.min(d+10,length);line(routes,{x:a.x+(b.x-a.x)*d/length,y:a.y+(b.y-a.y)*d/length},{x:a.x+(b.x-a.x)*end/length,y:a.y+(b.y-a.y)*end/length},C.primary,3);}
 }
 callout(zoneLabels,'Planned putaway',420,530,0);
 }
 }
 paintZone();fit();
}
function animateActors(){
 for(const a of actors){
 let x=a.x,y=a.y;
 if(a.kind==='worker'){const r=workerRoutes[a.index%workerRoutes.length],q=onRoute(r,elapsed*20+a.index*137);x=q.x;y=q.y;const gait=Math.sin(elapsed*6+a.index)*.3;a.art.legs.children[0].rotation=gait;a.art.legs.children[1].rotation=-gait;}
 if(a.kind==='forklift'){const q=onRoute(forkRoutes[a.index%2],elapsed*26+a.index*233);x=q.x;y=q.y;}
 const q=p(x,y);a.c.position.set(q.x,q.y);a.c.zIndex=x+y+20;
 }
}
return {paintZone,renderBusiness,animateActors,zoneFloor};
}
let artwork=buildArtwork();
// The static floor/grid was the measured overview bottleneck on software WebGL.
ground.cacheAsTexture({resolution:1});
function clearArtwork(){
 for(const layer of [ground,objects,roof,labels])layer.removeChildren().forEach(c=>c.destroy({children:true}));
 for(const texture of textures)texture.destroy(true);
 textures.clear();artCache.clear();rackHighlights.length=0;actors.length=0;
}
function setTheme(theme){
 if(disposed||palette.id===theme.id)return;
 clearArtwork();readPalette(theme);artwork=buildArtwork();artwork.renderBusiness();artwork.animateActors();
 if(rackDetail)buildRack();
 app.renderer.render({container:app.stage});
}
function buildRack(){
 rackView?.destroy();rackView=null;
 if(rackDetail?.rack.layoutStatus==='configured'&&!rackDetail.errors.length){
  rackView=root.WarehouseRackView.create({parent:rackRoot,detail:rackDetail,theme:palette,project:p,textStyle,
   canSelect:()=>!gesture?.moved,onLocator:id=>callbacks.onLocator?.({locatorId:id})});
  rackView.select(selectedLocatorId);
  if(rackFilterIds)rackView.filter(rackFilterIds);
 }
 fit();
}
function showRack(detail,id=''){
 setResolution(displayResolution);
 const changed=sceneType!=='rack'||rackDetail!==detail;
 sceneType='rack';camera=rackCamera;scene.visible=false;rackRoot.visible=true;
 if(changed){rackDetail=detail;selectedLocatorId=id;reset();buildRack();}else selectLocator(id);
 host.querySelector('[data-scene-action="pause"]').hidden=true;
 app.canvas.setAttribute('aria-label','2.5D rack. Select a Locator using the HTML list.');fit();
}
function selectLocator(id){selectedLocatorId=id;rackView?.select(id);}
function filterRack(ids){rackFilterIds=ids;rackView?.filter(ids);}
function showOverview(){
 if(sceneType==='overview')return;
 setResolution(overviewResolution);
 rackView?.destroy();rackView=null;rackDetail=null;selectedLocatorId='';sceneType='overview';camera=overviewCamera;
 scene.visible=true;rackRoot.visible=false;host.querySelector('[data-scene-action="pause"]').hidden=false;
 app.canvas.setAttribute('aria-label','Interactive warehouse. Use zone tabs or the destination input for keyboard access.');fit();
}
function getViewState(){return {view,zone:selectedZone,paused,zoom:overviewCamera.zoom,panX:overviewCamera.panX,panY:overviewCamera.panY};}
function restoreViewState(saved){if(!saved)return;view=saved.view;selectedZone=saved.zone;paused=saved.paused||matchMedia('(prefers-reduced-motion: reduce)').matches;Object.assign(overviewCamera,{zoom:saved.zoom,panX:saved.panX,panY:saved.panY});paintPause();artwork.renderBusiness();fit();}
function reset(){camera.zoom=1;camera.panX=0;camera.panY=0;fit();}
function paintPause(){const b=host.querySelector('[data-scene-action="pause"]');b.textContent=paused?'▶':'Ⅱ';b.setAttribute('aria-label',paused?'Play animation':'Pause animation');b.setAttribute('aria-pressed',String(paused));}
const abort=new AbortController(),opts={signal:abort.signal};
host.addEventListener('click',e=>{
 const action=e.target.closest('[data-scene-action]')?.dataset.sceneAction;
 if(action==='zoom-in')setZoom(camera.zoom+.15);if(action==='zoom-out')setZoom(camera.zoom-.15);
 if(action==='reset')reset();if(action==='pause'){paused=!paused;paintPause();}
},opts);
app.canvas.addEventListener('pointerdown',e=>{gesture={x:e.clientX,y:e.clientY,panX:camera.panX,panY:camera.panY,moved:false};},opts);
window.addEventListener('pointermove',e=>{if(!gesture||!e.buttons)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.abs(dx)+Math.abs(dy)>5)gesture.moved=true;if(gesture.moved){camera.panX=gesture.panX+dx;camera.panY=gesture.panY+dy;fit();}},opts);
window.addEventListener('pointerup',()=>{setTimeout(()=>{gesture=null;},0);},opts);
window.addEventListener('pointercancel',()=>{gesture=null;},opts);
app.canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(camera.zoom*(e.deltaY<0?1.08:.92));},{...opts,passive:false});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{if(e.matches){paused=true;paintPause();}},opts);
app.ticker.add(ticker=>{
 if(!active||sceneType==='rack')return;const dt=Math.min(ticker.deltaMS/1000,.06);if(!paused)elapsed+=dt;
 artwork.animateActors();
});
paintPause();fit();host.querySelector('[data-scene-loading]').hidden=true;
return {
 app,
 update(data){showOverview();business=data.state;currentJob=data.job;currentId=data.palletId||'';target=data.destination||'';selectedZone=data.zone||selectedZone;const changed=view!==data.view;view=data.view;if(changed)reset();artwork.renderBusiness();},
 setActive(value){active=value;if(value){app.start();app.resize();fit();}else app.stop();},
 reset,fit,setTheme,showRack,showOverview,selectLocator,filterRack,getViewState,restoreViewState,
 snapshot(){return{view,sceneType,physicalRackId:rackDetail?.rack.id||null,selectedLocatorId,...rackView?.snapshot(),paused,zoom:camera.zoom,panX:camera.panX,panY:camera.panY,zone:selectedZone,theme:palette.id,elapsed,textures:textures.size,tickerListeners:app.ticker.count,actors:actors.length,canvasCount:host.querySelectorAll('canvas').length};},
 locatorScreenPoint(id){const q=rackView?.point(id),r=app.canvas.getBoundingClientRect();return q?{x:r.left+q.x,y:r.top+q.y}:null;},
 screenPoint(x,y,z=0){const q=scene.toGlobal(p(x,y,z)),r=app.canvas.getBoundingClientRect();return{x:r.left+q.x,y:r.top+q.y};},
 async exportImage(){const zoneFloor=artwork.zoneFloor;const wasLabels=labels.visible,wasFloor=zoneFloor.visible;labels.visible=false;zoneFloor.visible=false;ground.updateCacheTexture();app.renderer.render({container:app.stage});try{return await app.renderer.extract.base64({target:app.stage,format:'png'});}finally{labels.visible=wasLabels;zoneFloor.visible=wasFloor;ground.updateCacheTexture();}},
 destroy(){disposed=true;observer.disconnect();abort.abort();rackView?.destroy();clearArtwork();app.destroy(true,{children:true});for(const style of textStyles.values())style.destroy();textStyles.clear();}
};
}};
})(window);

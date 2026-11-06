/* Shared UI and scene palettes. Runs before the stylesheet and the first paint. */
(function () {
'use strict';
const STORAGE_KEY='wms-ui-theme-v1';
const themes={
 polar:{name:'极地蓝',english:'Polar Blue',scheme:'light',tokens:{
  bg:'#F4F7FC',surface:'#FFFFFF','surface-alt':'#F0F5FC',header:'#F8FAFF',sidebar:'#EAF0FA',text:'#172B4D','text-muted':'#526682',border:'#D5DFED','control-border':'#8193AB',input:'#FFFFFF',primary:'#2563EB','primary-hover':'#1D4ED8','on-primary':'#FFFFFF','primary-soft':'#E8F0FF',hover:'#EDF3FC','disabled-bg':'#E5EBF3','disabled-text':'#667892',shadow:'rgba(23,43,77,.14)',overlay:'rgba(23,43,77,.36)',
  'scene-bg':'#F8FBFF','scene-grid':'#D5DFED','scene-floor':'#E5EDF6','scene-floor-side':'#BDCBDF','scene-wall':'#D4DFED','scene-wall-light':'#ECF2F9','scene-ink':'#314C6B','scene-edge':'#8096AF','scene-paper':'#FFFFFF','scene-steel':'#637F9E','scene-steel-light':'#A4B9CF','scene-rack':'#2563EB','scene-rack-light':'#7BA8F8','scene-crate-top':'#E5D5B6','scene-crate':'#C5AB82','scene-crate-side':'#9F8460','scene-glass':'#9CBCCC','scene-safety':'#C18B23','scene-equipment':'#D99A32'
 }},
 teal:{name:'松石青',english:'Teal Calm',scheme:'light',tokens:{
  bg:'#F1F7F5',surface:'#FFFFFF','surface-alt':'#EDF5F1',header:'#F7FBF9',sidebar:'#E5F0ED',text:'#183D38','text-muted':'#526D66',border:'#CDDDD7','control-border':'#81988F',input:'#FFFFFF',primary:'#0F766E','primary-hover':'#115E59','on-primary':'#FFFFFF','primary-soft':'#DDF2EC',hover:'#E7F3EE','disabled-bg':'#E2EBE6','disabled-text':'#60766D',shadow:'rgba(24,61,56,.14)',overlay:'rgba(24,61,56,.36)',
  'scene-bg':'#F4FAF6','scene-grid':'#CDDCD3','scene-floor':'#DFEAE3','scene-floor-side':'#B9CCC0','scene-wall':'#CDDCD2','scene-wall-light':'#EDF4EE','scene-ink':'#315449','scene-edge':'#7E9789','scene-paper':'#FAFDFA','scene-steel':'#658778','scene-steel-light':'#A7C1B1','scene-rack':'#0F766E','scene-rack-light':'#72B7A9','scene-crate-top':'#E3D8BE','scene-crate':'#C2AF8C','scene-crate-side':'#9C8967','scene-glass':'#9EBFB3','scene-safety':'#B7892D','scene-equipment':'#CF9B3D'
 }},
 midnight:{name:'深海夜航',english:'Midnight',scheme:'dark',tokens:{
  bg:'#101826',surface:'#1B2A40','surface-alt':'#23354D',header:'#152237',sidebar:'#152237',text:'#E8EFFA','text-muted':'#A6B7CF',border:'#3B4E6B','control-border':'#7C90AE',input:'#152237',primary:'#86A6FF','primary-hover':'#A5BDFF','on-primary':'#101B30','primary-soft':'#273E65',hover:'#243650','disabled-bg':'#26364A','disabled-text':'#8395AE',shadow:'rgba(0,0,0,.36)',overlay:'rgba(0,0,0,.60)',
  'scene-bg':'#15263C','scene-grid':'#354C63','scene-floor':'#22364C','scene-floor-side':'#192A3D','scene-wall':'#31465E','scene-wall-light':'#3C536B','scene-ink':'#E0EAF6','scene-edge':'#7490AB','scene-paper':'#B7C9D8','scene-steel':'#69839D','scene-steel-light':'#91A9BF','scene-rack':'#86A6FF','scene-rack-light':'#B4C8FF','scene-crate-top':'#B29C7B','scene-crate':'#8E795A','scene-crate-side':'#6B5943','scene-glass':'#5E829A','scene-safety':'#DDB764','scene-equipment':'#D6AB5A'
 }}
};
const lightStatus={success:'#237A3D','success-soft':'#E9F6ED',warning:'#8A5700','warning-soft':'#FFF2D7',error:'#B42318','error-soft':'#FEECEB',info:'#205CC0','info-soft':'#E7F0FF',neutral:'#596A82','neutral-soft':'#EEF2F6'};
const darkStatus={success:'#75D99D','success-soft':'#193C30',warning:'#F2C166','warning-soft':'#443521',error:'#FFABA3','error-soft':'#482B32',info:'#94B9FF','info-soft':'#233B5E',neutral:'#A6B7CF','neutral-soft':'#2B3C50'};
for(const [id,theme] of Object.entries(themes)){
 theme.id=id;Object.assign(theme.tokens,theme.scheme==='dark'?darkStatus:lightStatus);
 theme.image='./assets/warehouse-'+id+'.png';
}
let current='polar';
function apply(id,persist=true){
 current=Object.hasOwn(themes,id)?id:'polar';
 const theme=themes[current],html=document.documentElement;
 html.dataset.theme=current;html.style.colorScheme=theme.scheme;
 for(const [key,value] of Object.entries(theme.tokens))html.style.setProperty('--wms-'+key,value);
 // The brand mark follows the interaction palette; external brand marks keep their colors.
 const favicon=document.querySelector('link[rel="icon"]');
 if(favicon)favicon.href='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="${theme.tokens.primary}"/><path d="M8 17L20 9l12 8v15H8zM15 32V21h10v11" fill="none" stroke="${theme.tokens['on-primary']}" stroke-width="2"/></svg>`);
 if(persist)try{localStorage.setItem(STORAGE_KEY,current);}catch{}
 document.dispatchEvent(new CustomEvent('wms-theme-change',{detail:theme}));
 return theme;
}
window.WarehouseTheme={themes,STORAGE_KEY,apply,get current(){return themes[current];}};
let saved;try{saved=localStorage.getItem(STORAGE_KEY);}catch{}
apply(saved,false);
})();

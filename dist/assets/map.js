/* Grünhof parcel explorer. All geometry is published VZD data, in metres. */
(() => {
  'use strict';
  const data = window.GOLF_DATA;
  if (!data) return;
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const storeKey = 'grunhof-land-explorer-v1';
  const parcels = data.parcels;
  const byCode = new Map(parcels.map(p => [p.code, p]));
  const colors = {municipal:'#7c8061',private:'#aa7556',state:'#6d7c76',unknown:'#a0927a'};
  const categories = {municipal:'Pašvaldība',private:'Privāts',state:'Valsts / LVM',unknown:'Jāprecizē'};
  const refs = {v1:{area:51.55,title:'1. variants · prioritārais golfs',file:'assets/reference-v1.jpg'},municipal:{area:110.57,title:'Skolas lielie lauki · agrākais 110 ha variants',file:'assets/reference-municipal.jpg'},forest:{area:42.49,title:'Meža teritorija',file:'assets/reference-forest.jpg'}};
  const groups = {estate:'Muiža, skola un parks',school:'Skolas lauksaimniecības zemes',village:'Kalpu ciemats un piegulošās zemes',base:'Veckastaņi · tehniskā bāze',golf:'Pārējās golfa ieceres zemes',forest:'Meža teritorija',reference:'Vēsturiskās atsauces'};
  const expandedCodes = parcels.filter(p=>p.groups.includes('expanded')).map(p=>p.code);
  const presetTitle = key => key==='expanded'?'Paplašinātais teritorijas pārskats':refs[key]?.title || (key==='all'?'Visas saraksta vienības':'Zaļās muižas apkārtne');
  const number = new Intl.NumberFormat('lv-LV',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmt = n => number.format(n);
  const codeLabel = code => code.slice(0,4)+' '+code.slice(4,7)+' '+code.slice(7);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let persisted = {};
  try { const p = JSON.parse(localStorage.getItem(storeKey) || '{}'); if(p && typeof p==='object' && !Array.isArray(p)) persisted=p; } catch {}
  const validCodes = list => Array.isArray(list) ? [...new Set(list.filter(x => typeof x==='string' && byCode.has(x)))] : [];
  const initial = new URLSearchParams(location.search).get('selection');
  const previousSelection = validCodes(persisted.selected);
  const oldDefault = parcels.filter(p=>p.groups.includes('v1')).map(p=>p.code);
  const expandOldDefault = persisted.uiRevision!==2 && previousSelection.length===oldDefault.length && oldDefault.every(c=>previousSelection.includes(c));
  let selected = new Set(initial !== null ? validCodes(initial.split(',')) : Array.isArray(persisted.selected) && !expandOldDefault ? previousSelection : expandedCodes);
  let activeCode = byCode.has(persisted.active) ? persisted.active : parcels[0].code;
  const customOwners = {};
  for(const [code, note] of Object.entries(persisted.owners || {})) {
    if(byCode.has(code) && note && typeof note.owner==='string') customOwners[code]={owner:note.owner.slice(0,240),source:typeof note.source==='string'?note.source.slice(0,320):''};
  }
  let scenarios = Array.isArray(persisted.scenarios) ? persisted.scenarios.filter(s=>s && typeof s.id==='string' && typeof s.name==='string').slice(0,15).map(s=>({id:s.id,name:s.name.slice(0,80),codes:validCodes(s.codes)})) : [];
  const svg=$('parcel-map'), canvas=$('map-canvas'), tooltip=$('map-tooltip');
  const [minX,minY,maxX,maxY]=data.bounds;
  const world={x:0,y:0,w:maxX-minX,h:maxY-minY};
  let view={...world};
  const paths=new Map(), labels=new Map();
  const callouts=new Map();
  const point=([x,y])=>[x-minX,maxY-y];
  const pathFor=rings=>rings.map(r=>'M'+r.map(x=>point(x).map(n=>n.toFixed(2)).join(',')).join('L')+'Z').join('');
  function element(name,attributes={},parent) {
    const node=document.createElementNS(NS,name);
    for(const [key,val]of Object.entries(attributes))node.setAttribute(key,String(val));
    if(parent)parent.append(node);return node;
  }
  function toast(message) {
    $('map-toast').textContent=message;$('map-toast').hidden=false;
    clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('map-toast').hidden=true,4200);
  }
  function persist() {
    try {localStorage.setItem(storeKey,JSON.stringify({uiRevision:2,selected:[...selected],active:activeCode,owners:customOwners,scenarios}));return true;}
    catch {toast('Pārlūks neļauj saglabāt izvēli. To vari lejupielādēt kā tabulu.');return false;}
  }
  function createMap() {
    element('rect',{x:-100000,y:-100000,width:200000,height:200000,fill:'url(#paper-grid)'},$('map-background'));
    for(const p of data.context)element('path',{d:pathFor(p.rings),class:'context-shape','fill-rule':'evenodd'},$('context-parcels'));
    for(const p of data.buildings)element('path',{d:pathFor(p.rings),class:'building-shape','fill-rule':'evenodd'},$('map-buildings'));
    for(const p of parcels.filter(p=>p.rings)) {
      const path=element('path',{d:pathFor(p.rings),class:'parcel-shape','data-code':p.code,'fill-rule':'evenodd',tabindex:0,role:'button','aria-label':p.name+', '+codeLabel(p.code)+', '+fmt(p.geometryHa)+' hektāri','style':'--parcel-color:'+colors[p.category]},$('project-parcels'));
      const title=element('title',{},path);title.textContent=p.name+' · '+codeLabel(p.code);
      paths.set(p.code,path);
      const [x,y]=point(p.labelPoint);
      const t=element('text',{x,y,class:'parcel-label','data-code':p.code},$('parcel-labels'));
      element('tspan',{x,dy:0},t).textContent=p.code.slice(-4);
      const shortName=p.code==='54960040125'?'Muiža un parks':p.code==='54960040242'?'Meža teritorija':p.name.split(' · ')[0];
      element('tspan',{x,dy:'1.35em'},t).textContent=shortName;
      labels.set(p.code,t);
    }
    for(const item of [
      {id:'school',code:'54960040015',title:'Skolas lielie lauki',dx:-170,dy:-38},
      {id:'village',code:'54960040492',title:'Kalpu ciemats',dx:42,dy:15},
      {id:'base',code:'54960040101',title:'Veckastaņi · bāze',dx:-170,dy:-51}
    ]) {
      const anchor=point(byCode.get(item.code).labelPoint),g=element('g',{class:'area-callout'},$('area-callouts'));
      const line=element('line',{'vector-effect':'non-scaling-stroke'},g),dot=element('circle',{},g),rect=element('rect',{},g),title=element('text',{class:'callout-title'},g),sub=element('text',{class:'callout-subtitle'},g);
      title.textContent=item.title;
      const list=parcels.filter(p=>p.groups.includes(item.id));
      sub.textContent=list.length+' vienības · '+fmt(list.reduce((n,p)=>n+(p.geometryHa||0),0))+' ha';
      callouts.set(item.id,{...item,anchor,g,line,dot,rect,title,sub});
    }
    $('mapped-count').textContent=paths.size+' no '+parcels.length+' vienībām kartē';
  }
  function applyView() {
    const ratio=canvas.clientWidth/Math.max(canvas.clientHeight,1);
    view.w=Math.max(60,Math.min(view.w,world.h*3*ratio));
    view.h=view.w/ratio;
    // Leave a generous margin for normal panning while keeping the map reachable.
    view.x=Math.max(-world.w,Math.min(view.x,world.w*1.7));
    view.y=Math.max(-world.h,Math.min(view.y,world.h*1.7));
    svg.setAttribute('viewBox',[view.x,view.y,view.w,view.h].join(' '));
    const metresPerPixel=view.w/Math.max(canvas.clientWidth,1);
    const textSize=metresPerPixel*11;
    for(const p of parcels.filter(p=>p.rings)) {
      const label=labels.get(p.code),pixelWidth=(p.bbox[2]-p.bbox[0])/metresPerPixel;
      const pixelArea=p.geometryHa*10000/(metresPerPixel*metresPerPixel);
      label.setAttribute('font-size',textSize);
      label.setAttribute('stroke-width',textSize*.28);
      const show=$('show-labels').checked && pixelArea>950 && pixelWidth>35;
      label.style.display=show?'':'none';
      label.querySelector('tspan:last-child').style.display=pixelArea>5000 && pixelWidth>105?'':'none';
    }
    const target=metresPerPixel*95;
    const values=[10,20,50,100,200,500,1000,2000,5000];
    const distance=values.reduce((a,b)=>Math.abs(b-target)<Math.abs(a-target)?b:a);
    $('scale-distance').textContent=distance>=1000?distance/1000+' km':distance+' m';
    $('scale-line').style.width=distance/metresPerPixel+'px';
    for(const c of callouts.values()) {
      const x=(c.anchor[0]-view.x)/metresPerPixel,y=(c.anchor[1]-view.y)/metresPerPixel;
      const show=$('show-labels').checked && metresPerPixel>2.2 && x>=0 && x<=canvas.clientWidth && y>=0 && y<=canvas.clientHeight;
      c.g.style.display=show?'':'none';if(!show)continue;
      const left=Math.max(8,Math.min(x+c.dx,canvas.clientWidth-162)),top=Math.max(8,Math.min(y+c.dy,canvas.clientHeight-50));
      const px=v=>view.x+v*metresPerPixel,py=v=>view.y+v*metresPerPixel;
      for(const [k,v]of Object.entries({x1:c.anchor[0],y1:c.anchor[1],x2:px(Math.max(left,Math.min(x,left+154))),y2:py(Math.max(top,Math.min(y,top+42)))}))c.line.setAttribute(k,v);
      for(const [k,v]of Object.entries({cx:c.anchor[0],cy:c.anchor[1],r:2.5*metresPerPixel}))c.dot.setAttribute(k,v);
      for(const [k,v]of Object.entries({x:px(left),y:py(top),width:154*metresPerPixel,height:42*metresPerPixel,'stroke-width':metresPerPixel*.7}))c.rect.setAttribute(k,v);
      for(const [text,offset,size]of [[c.title,16,11],[c.sub,31,9]]) {text.setAttribute('x',px(left+9));text.setAttribute('y',py(top+offset));text.setAttribute('font-size',size*metresPerPixel);}
    }
  }
  function fit(codes,title) {
    const list=codes.map(c=>byCode.get(c)).filter(p=>p?.bbox);
    if(!list.length) {if(codes.length)toast('Izvēlētajām vienībām robeža nav pieejama. Parādīta kopējā karte.');list.push(...parcels.filter(p=>p.bbox));}
    const b=[Math.min(...list.map(p=>p.bbox[0])),Math.min(...list.map(p=>p.bbox[1])),Math.max(...list.map(p=>p.bbox[2])),Math.max(...list.map(p=>p.bbox[3]))];
    const ratio=canvas.clientWidth/Math.max(canvas.clientHeight,1);
    const w=Math.max(b[2]-b[0],(b[3]-b[1])*ratio,100)*1.22;
    const h=w/ratio;
    view={x:(b[0]+b[2])/2-minX-w/2,y:maxY-(b[1]+b[3])/2-h/2,w,h};
    if(title)$('map-view-title').textContent=title;
    tooltip.hidden=true;applyView();
  }
  function zoom(factor,cx=.5,cy=.5) {
    const w=Math.max(60,Math.min(world.h*3*canvas.clientWidth/canvas.clientHeight,view.w*factor)),h=w*canvas.clientHeight/canvas.clientWidth;
    view={x:view.x+(view.w-w)*cx,y:view.y+(view.h-h)*cy,w,h};tooltip.hidden=true;applyView();
  }
  function detectPreset() {
    for(const key of ['expanded',...Object.keys(refs)]) {
      const codes=parcels.filter(p=>p.groups.includes(key)).map(p=>p.code);
      if(codes.length===selected.size && codes.every(c=>selected.has(c)))return key;
    }
    if(selected.size===parcels.length)return 'all';
    if(!selected.size)return 'none';return null;
  }
  function renderSummary() {
    const list=parcels.filter(p=>selected.has(p.code)),sum=list.reduce((a,p)=>a+(p.geometryHa||0),0),missing=list.filter(p=>!p.rings).length;
    $('selection-count').textContent=selected.size;
    $('selection-area').textContent=list.length>0 && list.every(p=>!p.rings)?'Nav datu':fmt(sum)+' ha';
    $('area-label').textContent=missing?'Zināmais pilnu vienību laukums kartē':'Pilnu vienību laukums kartē';
    const preset=detectPreset();
    document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===preset)));
    if(refs[preset]) {
      $('reference-label').textContent='Agrāk iezīmētais projekta laukums';
      $('reference-area').textContent=fmt(refs[preset].area)+' ha';
      $('reference-note').textContent='Oriģinālā ekrānattēla mērījums, nevis pilnu vienību summa.';
    } else {
      $('reference-label').textContent='Izvēles veids';
      $('reference-area').textContent=preset==='expanded'?'Paplašinātais komplekss':preset==='all'?'Pilns saraksts':selected.size?'Pielāgota izvēle':'Nav izvēles';
      $('reference-note').textContent=missing?missing+' vienībai robeža un laukums nav pieejams.':preset==='expanded'?'Iekļauti skolas lielie lauki, kalpu ciemats un abas Veckastaņu vienības.':'Projekta izmantotā daļa nosakāma atsevišķi.';
    }
    for(const [code,path]of paths) {
      path.classList.toggle('is-selected',selected.has(code));
      path.classList.toggle('is-active',activeCode===code);
      path.setAttribute('aria-pressed',String(activeCode===code));
    }
    for(const key of ['school','village','base']) {
      const list=parcels.filter(p=>p.groups.includes(key)),n=list.filter(p=>selected.has(p.code)).length,input=$('select-group-'+key);
      input.checked=n===list.length;input.indeterminate=n>0&&n<list.length;
      $('group-'+key+'-summary').textContent=list.length+' zemes vienības · '+fmt(list.reduce((a,p)=>a+(p.geometryHa||0),0))+' ha kartē';
      input.closest('.area-card').classList.toggle('is-included',input.checked);
    }
  }
  function renderList() {
    const search=$('parcel-search').value.toLocaleLowerCase('lv').replace(/\s+/g,''),category=$('owner-filter').value;
    const group=$('group-filter').value;
    const list=parcels.filter(p=>(group==='all'||p.displayGroup===group)&&(category==='all'||p.category===category)&&(p.name+p.code+p.owner+(customOwners[p.code]?.owner||'')).toLocaleLowerCase('lv').replace(/\s+/g,'').includes(search));
    $('list-counter').textContent=list.length+' / '+parcels.length;
    $('no-results').hidden=list.length!==0;
    const row=p=>'<div class="parcel-row'+(p.code===activeCode?' active':'')+'" data-row-code="'+p.code+'"><input type="checkbox" data-select-code="'+p.code+'" id="select-'+p.code+'" aria-label="Iekļaut izvēlē: '+esc(p.name)+'" '+(selected.has(p.code)?'checked':'')+'><div><button class="parcel-name" type="button" data-inspect-code="'+p.code+'">'+esc(p.name)+'</button><div class="row-code">'+codeLabel(p.code)+'</div><div class="row-meta"><span class="row-owner '+p.category+'">'+categories[p.category]+'</span><span class="'+(p.rings?'':'missing')+'">'+(p.rings?fmt(p.geometryHa)+' ha kartē':'Vēsturiska atsauce')+'</span></div></div></div>';
    $('parcel-list').innerHTML=Object.entries(groups).map(([key,title])=>{const members=list.filter(p=>p.displayGroup===key);return members.length?'<section class="list-group"><h3>'+esc(title)+' <span>'+members.length+'</span></h3>'+members.map(row).join('')+'</section>':'';}).join('');
  }
  function renderDetails() {
    const p=byCode.get(activeCode);if(!p)return;
    $('property-title').textContent=p.name;$('copy-code').textContent=codeLabel(p.code)+' ⧉';
    $('property-owner').textContent=p.owner;$('property-owner-source').textContent=p.ownerSource;
    $('property-area').textContent=p.rings?fmt(p.geometryHa)+' ha':'Nav zināms';
    $('property-recorded-area').textContent=p.recordedHa!==null?'Agrāk dokumentos: '+fmt(p.recordedHa)+' ha':'Aprēķins pēc VZD robežām; reģistrētā teksta platība nav iegūta.';
    if(!p.rings)$('property-recorded-area').textContent='Šī vienība nav ieskaitīta laukuma summā.';
    $('property-status').textContent=p.rings?'VZD robeža pieejama':'Robeža nav atrasta';
    $('property-date').textContent=p.rings?'Datnes griezums: 31.10.2026.':'Jāpārbauda apzīmējums vai vienības aktuālais statuss.';
    $('property-note').textContent=p.note;
    $('property-sources').replaceChildren();
    for(const source of p.contextSources||[]) {
      if(!source.url.startsWith('https://'))continue;
      const link=document.createElement('a');link.href=source.url;link.target='_blank';link.rel='noopener';link.textContent=source.label+' ↗';$('property-sources').append(link);
    }
    const isSelected=selected.has(activeCode);
    $('toggle-active').textContent=isSelected?'Iekļauts izvēlē ✓':'Iekļaut izvēlē +';$('toggle-active').setAttribute('aria-pressed',String(isSelected));
    const note=customOwners[activeCode];$('personal-note').hidden=!note;
    if(note) {
      $('personal-note').replaceChildren();
      const label=document.createElement('span');label.textContent='Tava piederības piezīme: '+note.owner;$('personal-note').append(label);
      if(note.source){const source=document.createElement('small');source.textContent=note.source;$('personal-note').append(source);}
    }
    $('edit-property').textContent=note?'Labot manu piederības piezīmi':'Pievienot piederības piezīmi +';
  }
  function setActive(code,focusMap=false) {
    if(!byCode.has(code))return;activeCode=code;renderSummary();renderDetails();
    document.querySelectorAll('[data-row-code]').forEach(r=>r.classList.toggle('active',r.dataset.rowCode===code));
    if(focusMap) {
      const p=byCode.get(code);
      if(p.bbox)fit([code],p.name);else toast('Šīs vienības atsevišķa robeža VZD datnē nav atrasta.');
    }
    persist();
  }
  function toggle(code,check) {
    if(!byCode.has(code))return;
    const value=check===undefined?!selected.has(code):check;
    if(value)selected.add(code);else selected.delete(code);
    activeCode=code;renderSummary();renderDetails();
    const input=document.querySelector('[data-select-code="'+code+'"]');if(input)input.checked=value;
    document.querySelectorAll('[data-row-code]').forEach(r=>r.classList.toggle('active',r.dataset.rowCode===code));persist();
  }
  function focusGroup(key) {
    const list=parcels.filter(p=>p.displayGroup===key);
    if(!list.length)return;
    $('group-filter').value=key;$('parcel-search').value='';$('owner-filter').value='all';
    activeCode=list[0].code;renderList();renderSummary();renderDetails();
    fit(list.map(p=>p.code),groups[key]);persist();
  }
  function resetOverview() {
    $('group-filter').value='all';$('parcel-search').value='';$('owner-filter').value='all';
    renderList();fit(expandedCodes,'Paplašinātais teritorijas pārskats');
  }
  function highlight(code) {
    for(const [c,path]of paths)path.classList.toggle('is-hovered',c===code);
    document.querySelectorAll('[data-row-code]').forEach(r=>r.classList.toggle('hovered',r.dataset.rowCode===code));
  }
  function showTooltip(code,event) {
    const p=byCode.get(code);if(!p)return;
    const owner=customOwners[code]?.owner||p.owner;
    tooltip.innerHTML='<b>'+esc(p.name)+'</b><span class="tooltip-code">'+codeLabel(code)+'</span><p>'+esc(owner)+(customOwners[code]?' · tava piezīme':' · projekta piezīme')+'</p><p>'+fmt(p.geometryHa)+' ha · pilnas vienības laukums kartē</p>';
    tooltip.hidden=false;
    const rect=canvas.getBoundingClientRect();
    const left=Math.max(8,Math.min(event.clientX-rect.left+15,rect.width-tooltip.offsetWidth-8));
    const top=Math.max(8,Math.min(event.clientY-rect.top+15,rect.height-tooltip.offsetHeight-8));
    tooltip.style.left=left+'px';tooltip.style.top=top+'px';
  }
  function renderScenarios() {
    $('saved-selections').innerHTML=scenarios.map(s=>'<div class="saved-scenario"><button type="button" data-load-scenario="'+esc(s.id)+'">'+esc(s.name)+' <small>('+s.codes.length+')</small></button><button type="button" data-remove-scenario="'+esc(s.id)+'" aria-label="Dzēst kombināciju '+esc(s.name)+'">×</button></div>').join('');
  }
  function closeDialog(dialog){dialog.close();}
  document.querySelectorAll('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>closeDialog(b.closest('dialog'))));
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}));
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{
    const key=b.dataset.preset;
    selected=new Set(key==='all'?parcels.map(p=>p.code):key==='none'?[]:parcels.filter(p=>p.groups.includes(key)).map(p=>p.code));
    if(selected.size)activeCode=[...selected][0];
    $('parcel-search').value='';$('owner-filter').value='all';$('group-filter').value='all';renderList();renderSummary();renderDetails();fit([...selected],presetTitle(key));persist();
  }));
  document.querySelectorAll('[data-focus-group]').forEach(b=>b.addEventListener('click',()=>focusGroup(b.dataset.focusGroup)));
  document.querySelectorAll('[data-select-group]').forEach(input=>input.addEventListener('change',()=>{
    const list=parcels.filter(p=>p.groups.includes(input.dataset.selectGroup));
    for(const p of list)if(input.checked)selected.add(p.code);else selected.delete(p.code);
    if(input.checked)activeCode=list[0].code;
    renderList();renderSummary();renderDetails();persist();
  }));
  $('parcel-search').addEventListener('input',renderList);$('owner-filter').addEventListener('change',renderList);
  $('group-filter').addEventListener('change',()=>{const key=$('group-filter').value;if(key==='all')resetOverview();else focusGroup(key);});
  $('parcel-list').addEventListener('change',e=>{if(e.target.dataset.selectCode)toggle(e.target.dataset.selectCode,e.target.checked);});
  $('parcel-list').addEventListener('click',e=>{const b=e.target.closest('[data-inspect-code]');if(b)setActive(b.dataset.inspectCode,true);});
  $('parcel-list').addEventListener('pointerover',e=>{const row=e.target.closest('[data-row-code]');if(row)highlight(row.dataset.rowCode);});
  $('parcel-list').addEventListener('pointerleave',()=>highlight(null));
  $('toggle-active').addEventListener('click',()=>toggle(activeCode));
  $('fit-selection').addEventListener('click',()=>fit([...selected],'Izvēlēto īpašumu pārskats'));$('reset-view').addEventListener('click',resetOverview);$('reset-overview').addEventListener('click',resetOverview);
  $('zoom-in').addEventListener('click',()=>zoom(.7));$('zoom-out').addEventListener('click',()=>zoom(1/.7));
  $('show-labels').addEventListener('change',applyView);$('show-context').addEventListener('change',()=>{$('context-parcels').style.display=$('show-context').checked?'':'none';$('map-buildings').style.display=$('show-context').checked?'':'none';});
  async function copyCode() {
    try{await navigator.clipboard.writeText(activeCode);toast('Kadastra apzīmējums nokopēts.');}
    catch{toast('Kadastra apzīmējums: '+activeCode);}
  }
  $('copy-code').addEventListener('click',copyCode);
  $('save-selection').addEventListener('click',()=>{if(!selected.size){toast('Vispirms izvēlies vismaz vienu zemes vienību.');return;}if(scenarios.length>=15){toast('Saglabātas 15 kombinācijas. Dzēs kādu, lai pievienotu jaunu.');return;}$('scenario-name').value='';$('save-dialog').showModal();$('scenario-name').focus();});
  $('save-form').addEventListener('submit',e=>{e.preventDefault();const name=$('scenario-name').value.trim();if(!name){$('scenario-name').focus();return;}scenarios.push({id:'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:name.slice(0,80),codes:[...selected]});const ok=persist();renderScenarios();$('save-dialog').close();if(ok)toast('Kombinācija saglabāta šajā pārlūkā.');});
  $('saved-selections').addEventListener('click',e=>{
    const load=e.target.closest('[data-load-scenario]'),remove=e.target.closest('[data-remove-scenario]');
    if(load){const s=scenarios.find(x=>x.id===load.dataset.loadScenario);if(!s)return;selected=new Set(s.codes);if(s.codes.length)activeCode=s.codes[0];$('parcel-search').value='';$('owner-filter').value='all';$('group-filter').value='all';renderList();renderSummary();renderDetails();fit([...selected],s.name);persist();}
    if(remove){scenarios=scenarios.filter(x=>x.id!==remove.dataset.removeScenario);renderScenarios();persist();}
  });
  $('edit-property').addEventListener('click',()=>{const note=customOwners[activeCode];$('owner-form-code').textContent=codeLabel(activeCode)+' · '+byCode.get(activeCode).name;$('owner-name').value=note?.owner||'';$('owner-source').value=note?.source||'';$('remove-owner-note').hidden=!note;$('owner-dialog').showModal();$('owner-name').focus();});
  $('owner-form').addEventListener('submit',e=>{e.preventDefault();const owner=$('owner-name').value.trim();if(!owner){$('owner-name').focus();return;}customOwners[activeCode]={owner:owner.slice(0,240),source:$('owner-source').value.trim().slice(0,320)};const ok=persist();renderDetails();renderList();$('owner-dialog').close();if(ok)toast('Piederības piezīme saglabāta šajā pārlūkā.');});
  $('remove-owner-note').addEventListener('click',()=>{delete customOwners[activeCode];const ok=persist();renderDetails();renderList();$('owner-dialog').close();if(ok)toast('Tava piezīme dzēsta. Projekta sākotnējie dati saglabāti.');});
  $('export-csv').addEventListener('click',()=>{
    if(!selected.size){toast('Vispirms izvēlies vismaz vienu zemes vienību.');return;}
    const rows=[['Kadastra apzīmējums','Nosaukums','Piederība projekta piezīmēs','Piederības avots','Mana piederības piezīme','Manas piezīmes avots','Pilnas vienības laukums kartē (ha)','Agrāk dokumentos norādītā platība (ha)','Robeža pieejama','Piezīmes','Robežu avots','Datnes griezums']];
    for(const p of parcels.filter(p=>selected.has(p.code)))rows.push([p.code,p.name,p.owner,p.ownerSource,customOwners[p.code]?.owner||'',customOwners[p.code]?.source||'',p.geometryHa===null?'':String(p.geometryHa).replace('.',','),p.recordedHa===null?'':String(p.recordedHa).replace('.',','),p.rings?'Jā':'Nē',p.note,data.source.url,data.source.snapshot]);
    const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+(/^[=+@\-]/.test(String(v))?"'":'')+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='grunhof-zemes-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Izvēles tabula sagatavota lejupielādei.');
  });
  document.querySelectorAll('[data-reference]').forEach(b=>b.addEventListener('click',()=>{const ref=refs[b.dataset.reference];$('reference-title').textContent=ref.title+' · '+fmt(ref.area)+' ha';$('reference-image').src=ref.file;$('reference-dialog').showModal();}));

  // Pointer capture supports dragging and two-finger pinch without page scroll.
  const pointers=new Map();let gesture=null;
  function startGesture(){const ps=[...pointers.values()];if(!ps.length){gesture=null;return;}if(ps.length===1)gesture={type:'pan',x:ps[0].x,y:ps[0].y,view:{...view},code:ps[0].code,moved:false};else{const a=ps[0],b=ps[1];gesture={type:'pinch',distance:Math.hypot(a.x-b.x,a.y-b.y),midX:(a.x+b.x)/2,midY:(a.y+b.y)/2,view:{...view},moved:true};}}
  svg.addEventListener('pointerdown',e=>{if(e.button!==0 && e.pointerType==='mouse')return;const rect=canvas.getBoundingClientRect();pointers.set(e.pointerId,{x:e.clientX-rect.left,y:e.clientY-rect.top,code:e.target.closest('[data-code]')?.dataset.code});svg.setPointerCapture(e.pointerId);tooltip.hidden=true;startGesture();});
  svg.addEventListener('pointermove',e=>{
    const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
    if(pointers.has(e.pointerId)) {
      pointers.set(e.pointerId,{...pointers.get(e.pointerId),x,y});
      if(gesture?.type==='pan'){const dx=x-gesture.x,dy=y-gesture.y;if(Math.hypot(dx,dy)>5)gesture.moved=true;view.x=gesture.view.x-dx*gesture.view.w/rect.width;view.y=gesture.view.y-dy*gesture.view.h/rect.height;applyView();}
      else if(gesture?.type==='pinch'){
        const [a,b]=[...pointers.values()];const distance=Math.hypot(a.x-b.x,a.y-b.y),factor=gesture.distance/Math.max(distance,1),w=gesture.view.w*factor,h=gesture.view.h*factor;
        const anchorX=gesture.view.x+gesture.midX/rect.width*gesture.view.w,anchorY=gesture.view.y+gesture.midY/rect.height*gesture.view.h;
        view={x:anchorX-(a.x+b.x)/2/rect.width*w,y:anchorY-(a.y+b.y)/2/rect.height*h,w,h};applyView();
      }
      svg.classList.toggle('is-panning',!!gesture?.moved);return;
    }
    const code=e.target.closest('[data-code]')?.dataset.code;highlight(code||null);if(code&&e.pointerType!=='touch')showTooltip(code,e);else tooltip.hidden=true;
  });
  function releasePointer(e,cancelled=false){const wasPinch=gesture?.type==='pinch';const click=!cancelled&&gesture?.type==='pan'&&!gesture.moved&&pointers.size===1;const code=gesture?.code;pointers.delete(e.pointerId);if(click&&code)setActive(code);if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);startGesture();if(wasPinch&&gesture)gesture.moved=true;svg.classList.remove('is-panning');}
  svg.addEventListener('pointerup',e=>releasePointer(e));svg.addEventListener('pointercancel',e=>releasePointer(e,true));
  svg.addEventListener('pointerleave',()=>{if(!pointers.size){tooltip.hidden=true;highlight(null);}});
  svg.addEventListener('wheel',e=>{e.preventDefault();const rect=canvas.getBoundingClientRect();zoom(Math.exp(Math.max(-200,Math.min(200,e.deltaY))*.0025),(e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height);},{passive:false});
  svg.addEventListener('keydown',e=>{
    const code=e.target.dataset.code;if(code && (e.key==='Enter'||e.key===' ')){e.preventDefault();setActive(code);return;}
    if(e.key==='+'||e.key==='='){e.preventDefault();zoom(.7);}else if(e.key==='-'){e.preventDefault();zoom(1/.7);}else if(e.key==='0'){e.preventDefault();fit([...selected]);}
    else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const step=view.w*.1;if(e.key==='ArrowLeft')view.x-=step;if(e.key==='ArrowRight')view.x+=step;if(e.key==='ArrowUp')view.y-=step;if(e.key==='ArrowDown')view.y+=step;applyView();}
  });
  createMap();renderList();renderScenarios();renderSummary();renderDetails();fit(initial!==null?[...selected]:expandedCodes,initial!==null?'Izvēlēto īpašumu pārskats':'Paplašinātais teritorijas pārskats');persist();
  let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{const cx=view.x+view.w/2,cy=view.y+view.h/2;view.h=view.w*canvas.clientHeight/canvas.clientWidth;view.x=cx-view.w/2;view.y=cy-view.h/2;applyView();},70);}).observe(canvas);
})();

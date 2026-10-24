// @ts-nocheck
// Preserved prototype renderer; the typed adapter defines its public boundary.
export function createRenderer(state) {
  const { d3, ObserverSky, GroundSky } = window;
  const $ = (s) => document.querySelector(s);
  const C = { Enlil: '#d7b778', Anu: '#72bcb5', Ea: '#849bd9' };
  const WHEEL_RINGS = {Enlil:[117,190],Anu:[200,273],Ea:[283,355]};
  const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  const DEFAULT_MONTHS = ['Nisannu','Ayyāru','Simānu','Duʾūzu','Abu','Ulūlu','Tašrītu','Araḫsamna','Kislimu','Ṭebētu','Šabāṭu','Addaru'];
  const JEWISH_MONTHS = ['Nisan','Iyyar','Sivan','Tammuz','Av','Elul','Tishrei','Cheshvan','Kislev','Tevet','Shevat','Adar'];
  let data = { entries: [], stars: [], meta: {} };
  let observerSolution=null,skySolution=null,observerKey='',horizonImageCache=null,observerTargets=[];
  let manualEpoch={year:1200,era:'bce'},selectedPoleFit=null;
  let groundViewer=null,groundGrid=false;
  let constellationData={stars:{},traditions:[]},constellationTradition='modern',constellationLabels=true,selectedFigure='';
  const constellationStars=new Map();
  const epochCache=new Map(),coordinateLookup=new Map();
  let zoomTransform = d3.zoomIdentity;
  const svg = d3.select('#sky-wheel');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite = (n) => n !== null && n !== undefined && n !== '' && Number.isFinite(+n);
  const pathName = (e) => ['Ea','Anu','Enlil'].find((p) => String(e.path || '').toLowerCase().includes(p.toLowerCase())) || e.path || 'Unknown';
  const col = (e) => C[pathName(e)] || '#94a0b3';
  const isPlanet = (e) => /planet/i.test(String(e.type || e.kind || e.objectType || '')) || (e.isPlanet === true);
  const hasPosition = (e) => finite(e.raDeg) && finite(e.decDeg) && !isPlanet(e);
  const starVisible = (s) => hasPosition(s) && finite(s.mag) && +s.mag <= state.magnitudeLimit;
  const locatorVisible = (e) => hasPosition(e) && ((e.anchorStars || []).length ? e.anchorStars.some(starVisible) : starVisible(e));
  const cleanText = (v) => Array.isArray(v) ? v.join(' ') : typeof v === 'object' ? JSON.stringify(v) : String(v || '');
  const name = (e) => e.ancientName || e.transliteration || e.id;
  const modern = (e) => e.modernIdentification || 'Identification unresolved';
  const babylonianMonth = (m) => data.entries.find((e) => +e.month === +m)?.monthName || DEFAULT_MONTHS[m-1] || '';
  const monthName = (m) => `${babylonianMonth(m)} / ${JEWISH_MONTHS[m-1]}`;
  const nominalDate = () => ({month:Math.floor(state.observer.calendarDay/30)+1,day:state.observer.calendarDay%30+1});
  function confidence(e) {
    const raw = String(e.confidence || 'Unresolved');
    const v = raw.toLowerCase();
    const kind = /high|secure|strong|certain|accepted|identified/.test(v) && !/un|not|less|uncertain/.test(v) ? 'confident' : /probable|medium|tentative|plausible|low|possible|disputed|moderate/.test(v) ? 'tentative' : 'unresolved';
    const label = ({high:'Strong',medium:'Probable',low:'Tentative',secure:'Secure',unresolved:'Unresolved'})[v] || raw.charAt(0).toUpperCase()+raw.slice(1);
    return {kind,label};
  }
  function matches(e) {
    return (state.path === 'all' || pathName(e) === state.path) && (!state.month || +e.month === state.month) && (!state.search || [name(e), e.transliteration, modern(e), cleanText(e.culturalNames), cleanText(e.notes), e.hip, e.gaiaDr2Id].join(' ').toLocaleLowerCase().includes(state.search.trim().toLocaleLowerCase()));
  }
  function source(s) {
    const x = typeof s === 'string' ? {url:s,label:s} : s || {};
    let url = x.url || x.href || '';
    if (!/^https?:\/\//i.test(url)) url = '';
    return {url,label:x.label || x.title || x.name || url || 'Research source'};
  }
  function listSources(items) { return (Array.isArray(items) ? items : []).map(source).filter((s)=>s.url); }
  function choose(e, scroll=false) {
    const focusWasInChart = document.activeElement?.matches?.('.entry-cell,.sky-marker,.blend-slot');
    state.selected = e.id; state.selectedStar = null;
    render();
    if(focusWasInChart) svg.selectAll('.entry-cell,.sky-marker,.blend-slot').filter((d)=>d.id===e.id).node()?.focus();
    if (scroll) $('#explorer').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }
  function setView(view) {
    if(!['blend','ground','register'].includes(view))return;
    state.view=view;
    const ground=view==='ground',register=view==='register';
    if(ground&&!state.observer.enabled){state.observer.enabled=true;syncObserverInputs();}
    $('#export-svg').hidden=register;
    $('#export-svg').disabled=false;
    $('#explorer').classList.toggle('register-mode',register);
    $('#explorer').classList.toggle('ground-mode',ground);
    $('#observer-enabled').disabled=ground;
    $('#observer-enabled').title=ground?'Observer coordinates are required for the ground sky':'';
    $('#toggle-labels').textContent=(ground?'Star labels ':'Labels ')+(state.labels?'on':'off');
    $('#export-svg').innerHTML=ground?'Export PNG <span aria-hidden="true">↓</span>':'Export SVG <span aria-hidden="true">↓</span>';
    if(groundViewer)groundViewer.setActive(ground);
    hideTip();render();
  }
  function showTip(event,e) {
    const t=$('#chart-tooltip'), box=$('.chart-wrap').getBoundingClientRect();
    t.innerHTML=`<strong>${esc(name(e))}</strong><span>${esc(modern(e))}<br>${esc(pathName(e))} · ${esc(monthName(+e.month))} · ${esc(confidence(e).label)}</span>`;
    t.hidden=false;
    const x=Math.min(box.width-255,Math.max(7,event.clientX-box.left+15));
    const y=Math.max(5,event.clientY-box.top-55);
    t.style.left=x+'px';t.style.top=y+'px';
  }
  function hideTip(){ $('#chart-tooltip').hidden=true; }
  function attachActions(selection) {
    selection.attr('tabindex',0).attr('role','button').attr('aria-label',(e)=>`${name(e)}: ${modern(e)}. ${pathName(e)}, month ${e.month}. ${confidence(e).label}.`).attr('aria-pressed',(e)=>String(e.id===state.selected))
      .on('click',(event,e)=>{event.stopPropagation();hideTip();choose(e);})
      .on('keydown',(event,e)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(e);}})
      .on('mousemove',showTip).on('mouseleave',hideTip).on('blur',hideTip);
  }
  function renderChart() {
    prepareObserver();renderObserverStatus();
    if(state.view==='register'){
      svg.on('.zoom',null);updateCatalogueCounts();
      $('#frame-label').textContent=`Celestial register · ${data.entries.length} assignments`;
      return;
    }
    const center=projectionCenter();
    $('#chart-explanation').textContent=state.view==='wheel'?'A calendar diagram: angular position indicates assigned month, not a star’s measured position.':`${center.name} at centre. ${state.view==='blend'?'Dashed line: selected calendar slot → proposed sky locator. ':''}Scroll or drag inside the circle to zoom or pan; scroll outside it to move the page. ${skySolution?.valid?`Sky reconstructed for ${state.observer.year} ${state.observer.era.toUpperCase()}; ${observerSolution?.valid?'horizon and meridian show the local reading.':'observer overlay unavailable or off.'}`:'Modern catalogue frame.'}`;
    svg.attr('aria-label',state.view==='wheel'?'Thirty-six celestial names arranged in three paths and twelve monthly sectors':`Azimuthal equidistant catalogue sky centred on ${center.name}; antipode at rim${state.view==='blend'?'; calendar wheel overlay':''}.`);
    if(state.view==='ground'){
      svg.on('.zoom',null);
      $('#chart-explanation').textContent='Perspective from the same observer and reading time as the wheel. Look in any direction, including below the horizon. Catalogue stars remain plotted regardless of twilight brightness.';
      renderGroundSky();updateCatalogueCounts();return;
    }
    svg.on('.zoom',null);
    svg.selectAll('*').remove();
    const defs=svg.append('defs');
    const glow=defs.append('filter').attr('id','soft-glow').attr('x','-100%').attr('y','-100%').attr('width','300%').attr('height','300%');
    glow.append('feGaussianBlur').attr('stdDeviation',3).attr('result','blur');
    const merge=glow.append('feMerge');merge.append('feMergeNode').attr('in','blur');merge.append('feMergeNode').attr('in','SourceGraphic');
    svg.append('rect').attr('width',860).attr('height',860).attr('fill','#0b1320').attr('fill-opacity',.01);
    const g=svg.append('g').attr('transform','translate(430,430)');
    if(state.view==='wheel') renderWheel(g); else {renderSky(g,defs);renderCalibration();}
    updateCatalogueCounts();
  }
  function updateCatalogueCounts(){
    const n=data.entries.filter(matches).length;
    $('#count-label').textContent=`${n} of ${data.entries.length} entries`;
    const cutoff=state.magnitudeLimit.toFixed(1),eligible=data.stars.filter(starVisible).length;
    if(state.view==='ground')$('#count-label').textContent=`${eligible.toLocaleString()} catalogue stars · full sphere`;
    $('#magnitude-value').textContent=`≤ ${cutoff} mag`;
    $('#magnitude-limit').setAttribute('aria-valuetext',`Magnitude ${cutoff} and brighter`);
    $('#brightness-count').textContent=`${eligible.toLocaleString()} of ${data.stars.length.toLocaleString()} catalogue stars meet cutoff`;
  }
  function groundViewChanged(view){
    const directions=['N','NE','E','SE','S','SW','W','NW'];
    $('#ground-bearing').textContent=`${directions[Math.round(view.azimuth/45)%8]} · ${view.azimuth.toFixed(0)}°`;
    $('#ground-elevation').textContent=`${view.altitude<0?'Looking down':'Looking up'} ${Math.abs(view.altitude).toFixed(0)}°`;
    $('#ground-field').textContent=`${view.fov.toFixed(0)}° field`;
    $('#ground-fov-value').textContent=`${view.fov.toFixed(0)}°`;
    $('#ground-fov').value=view.fov;
    $('#ground-fov').setAttribute('aria-valuetext',`${view.fov.toFixed(0)} degree horizontal field of view`);
  }
  function ensureGroundViewer(){
    if(!groundViewer)groundViewer=GroundSky.create($('#ground-canvas'),{
      onViewChange:groundViewChanged,
      onSelect:record=>chooseStar(record.source||record)
    });
    return groundViewer;
  }
  function selectedTradition(){return constellationData.traditions.find(t=>t.id===constellationTradition);}
  function initializeConstellations(){
    Object.entries(constellationData.stars).forEach(([key,record])=>constellationStars.set(key,record));
    // Use the same catalogue record for a line endpoint and its plotted star.
    [...data.stars,...data.entries.flatMap(e=>e.anchorStars||[]),...(data.calibrationStars||[])].filter(hasPosition).forEach(s=>constellationStars.set(starKey(s),s));
    const select=$('#ground-tradition');
    const options=items=>items.map(t=>`<option value="${esc(t.id)}">${esc(t.label)}</option>`).join('');
    const published=constellationData.traditions.filter(t=>t.kind!=='research-comparison'),comparisons=constellationData.traditions.filter(t=>t.kind==='research-comparison');
    select.innerHTML='<option value="none">No constellation overlay</option>'+(published.length?`<optgroup label="Source traditions">${options(published)}</optgroup>`:'')+(comparisons.length?`<optgroup label="Textual comparisons">${options(comparisons)}</optgroup>`:'');
    if(!selectedTradition())constellationTradition=constellationData.traditions[0]?.id||'none';
    select.value=constellationTradition;select.disabled=!constellationData.traditions.length;
    updateConstellationDescription();
  }
  function updateConstellationDescription(){
    const tradition=selectedTradition();
    $('#ground-constellation-labels').disabled=!tradition;
    $('#ground-tradition-note').textContent=tradition?`${tradition.constellations.length} plotted figures${tradition.unlocated?.length?` · ${tradition.unlocated.length} unlocated names`:''} · ${tradition.description}`:constellationData.traditions.length?'Catalogue stars alone. Choose a tradition to compare its figures.':'The constellation dataset could not be loaded. Reload to try again.';
    $('#ground-tradition-source').hidden=!tradition;
    if(tradition)$('#ground-tradition-source').href=source(tradition.source).url||'https://github.com/Stellarium/stellarium';
    const figures=tradition?.constellations||[],finder=$('#ground-figure');
    if(!figures.some(f=>f.id===selectedFigure))selectedFigure='';
    finder.innerHTML='<option value="">Choose a figure…</option>'+figures.map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
    finder.value=selectedFigure;finder.disabled=!figures.length;
    const unlocated=tradition?.unlocated||[],notice=tradition?.geometryNotice||'';
    $('#ground-tradition-evidence').hidden=!notice&&!unlocated.length;
    $('#ground-tradition-evidence summary').textContent=unlocated.length?'About this reconstruction & unresolved names':'About this reconstruction';
    $('#ground-tradition-evidence-body').innerHTML=`${notice?`<p>${esc(notice)}</p>`:''}${unlocated.length?'<p class="unlocated-heading">Names without identified sky positions:</p>'+unlocated.map(f=>figureEvidence(f,true)).join(''):''}`;
    renderFigureEvidence();
  }
  function figureEvidence(figure,unlocated=false){
    const references=listSources(figure.sources),evidence=figure.evidence?cleanText(figure.evidence):'';
    const geometry=({'catalogue-star-locator':'Marker at the identified catalogue star.','reference-member-markers':'Separate markers at modern reference members.','modern-reference-lines':'Modern reference outline, used for comparison.'})[figure.geometryRole]||figure.geometryRole;
    return `<article><strong>${esc(figure.name)}${figure.nativeName?` <bdi class="figure-native">${esc(figure.nativeName)}</bdi>`:''}</strong> ${figure.status?`<span class="figure-status">${esc(figure.status)}</span>`:''}${figure.suggestedIdentification?`<p>Proposed identification: ${esc(figure.suggestedIdentification)}</p>`:''}${figure.notes?`<p>${esc(cleanText(figure.notes))}</p>`:''}${evidence?`<p>${esc(evidence)}</p>`:''}${geometry?`<p class="figure-geometry">${esc(geometry)}</p>`:''}${references.length?`<div class="figure-references">${references.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a>`).join('')}</div>`:''}${unlocated?'<span class="unlocated-badge">Unlocated</span>':''}</article>`;
  }
  function renderFigureEvidence(){
    const figure=selectedTradition()?.constellations.find(f=>f.id===selectedFigure),panel=$('#ground-figure-note');
    panel.hidden=!figure;
    panel.innerHTML=figure?figureEvidence(figure):'';
  }
  function focusGroundFigure(){
    renderFigureEvidence();
    if(!observerSolution?.valid)return;
    const figure=groundConstellations(selectedTradition()).find(f=>f.id===selectedFigure);
    if(figure?.label)ensureGroundViewer().setView({azimuth:figure.label.azimuth,altitude:figure.label.altitude});
  }
  function groundConstellations(tradition){
    if(!tradition||!observerSolution?.valid)return [];
    const positions=new Map();
    const horizontal=key=>{
      if(!positions.has(key)){
        const record=constellationStars.get(key);
        if(!record||!hasPosition(record))throw Error('Missing constellation endpoint: '+key);
        positions.set(key,ObserverSky.horizontal(epochPosition(record),observerSolution));
      }
      return positions.get(key);
    };
    return tradition.constellations.map(figure=>{
      const lines=figure.lines.map(line=>line.map(horizontal));
      const members=[...new Set(figure.lines.flat())].map(horizontal);
      const sum=members.map(h=>GroundSky.horizontalVector(h.altitude,h.azimuth)).reduce((a,v)=>a.map((n,i)=>n+v[i]),[0,0,0]);
      const length=Math.hypot(...sum);
      const label=length>1e-8?{altitude:Math.asin(Math.max(-1,Math.min(1,sum[2]/length)))*180/Math.PI,azimuth:(Math.atan2(sum[0],sum[1])*180/Math.PI+360)%360}:members[0];
      return {id:figure.id,name:figure.name,nativeName:figure.nativeName,lines,label};
    });
  }
  function renderGroundSky(){
    const viewer=ensureGroundViewer(),valid=!!observerSolution?.valid;
    viewer.setActive(state.view==='ground');
    $('#ground-focus').disabled=!valid||!hasPosition(state.selectedStar||data.entries.find(e=>e.id===state.selected));
    $('#export-svg').disabled=!valid;
    const pool=new Map();
    // Actual catalogue members only: never turn an asterism centroid into a star.
    data.stars.filter(starVisible).forEach(s=>pool.set(starKey(s),{...s}));
    [...referenceStars(),...(data.calibrationStars||[]).filter(starVisible)].forEach(s=>{
      const key=starKey(s);pool.set(key,{...pool.get(key),...s,groundReference:true});
    });
    const tradition=selectedTradition();
    // Some figures use faint catalogue stars outside the base subset. Cluster
    // centres are legitimate line anchors, but must not become invented stars.
    if(tradition)for(const key of new Set(tradition.constellations.flatMap(f=>f.lines.flat()))){
      const s=constellationStars.get(key);
      if(s&&(!s.objectType||s.objectType==='star')&&!key.startsWith('DSO:')&&starVisible(s)&&!pool.has(starKey(s)))pool.set(starKey(s),s);
    }
    const stars=valid?[...pool.values()].map(s=>{
      const h=ObserverSky.horizontal(epochPosition(s),observerSolution);
      return {source:s,key:starKey(s),name:starName(s),mag:+s.mag,color:s.color,
        altitude:h.altitude,azimuth:h.azimuth,reference:!!s.groundReference,
        selected:!!state.selectedStar&&starKey(state.selectedStar)===starKey(s)};
    }):[];
    const pole=valid?{altitude:state.observer.latitude,azimuth:0}:null;
    viewer.setScene({valid,reason:observerSolution?.reason||'Choose an observer reading to display the local sky.',stars,labels:state.labels,grid:groundGrid,
      constellations:groundConstellations(tradition),constellationLabels,
      sun:valid?{altitude:observerSolution.sunAltitude,azimuth:observerSolution.sunAzimuth}:null,
      pole:pole?{...pole,name:selectedPoleFit?`${projectionCenter().name} · assumed pole`:'North celestial pole'}:null});
    groundViewChanged(viewer.getView());
  }
  function focusGroundSelection(){
    const s=state.selectedStar||data.entries.find(e=>e.id===state.selected);
    if(!observerSolution?.valid||!hasPosition(s))return;
    const h=ObserverSky.horizontal(epochPosition(s),observerSolution);
    ensureGroundViewer().setView({azimuth:h.azimuth,altitude:h.altitude});
  }
  function renderWheel(g) {
    const rings=WHEEL_RINGS;
    g.append('circle').attr('r',365).attr('fill','none').attr('stroke','#3a475e').attr('stroke-opacity',.6);
    d3.range(120).forEach((n)=>{const a=n/120*2*Math.PI;g.append('line').attr('x1',Math.sin(a)*366).attr('y1',-Math.cos(a)*366).attr('x2',Math.sin(a)*(n%10===0?377:n%5===0?372:369)).attr('y2',-Math.cos(a)*(n%10===0?377:n%5===0?372:369)).attr('stroke',n%10===0?'#a8936f':'#405069').attr('stroke-width',n%10===0?1:.65);});
    const arc=d3.arc();
    const entries=g.append('g').selectAll('g').data(data.entries).join('g').attr('class','entry-cell').attr('opacity',(e)=>matches(e)?1:.16);
    entries.append('path').attr('class','cell-area').attr('d',(e)=>{const r=rings[pathName(e)]||rings.Anu;return arc({innerRadius:r[0],outerRadius:r[1],startAngle:(+e.month-1)*Math.PI/6+.009,endAngle:+e.month*Math.PI/6-.009});}).attr('fill',(e)=>col(e)).attr('fill-opacity',(e)=>e.id===state.selected?.19:.035).attr('stroke',(e)=>e.id===state.selected?col(e):'#34445b').attr('stroke-opacity',(e)=>e.id===state.selected?.9:.5).attr('stroke-width',(e)=>e.id===state.selected?1.5:.7);
    entries.each(function(e){
      const cell=d3.select(this),a=(+e.month-.5)*Math.PI/6,r=rings[pathName(e)]||rings.Anu,mid=(r[0]+r[1])/2;
      const flip=a>Math.PI/2&&a<Math.PI*1.5,rot=a*180/Math.PI+(flip?180:0);
      cell.append('circle').attr('cx',Math.sin(a)*(mid-9)).attr('cy',-Math.cos(a)*(mid-9)).attr('r',e.id===state.selected?4:2.8).attr('fill',col(e)).attr('fill-opacity',hasPosition(e)?1:.4).attr('stroke',col(e)).attr('stroke-width',.7).attr('filter',e.id===state.selected?'url(#soft-glow)':null);
      const label=name(e),limit=pathName(e)==='Enlil'?15:20;
      if(state.labels)cell.append('text').attr('class','cell-label').attr('transform',`translate(${Math.sin(a)*(mid+10)},${-Math.cos(a)*(mid+10)}) rotate(${rot})`).attr('text-anchor','middle').attr('dominant-baseline','middle').attr('fill',e.id===state.selected?'#fff0d4':col(e)).attr('font-family','Inter,Arial,sans-serif').attr('font-size',pathName(e)==='Enlil'?10:10.5).attr('letter-spacing','.04em').text(label.length>limit?label.slice(0,limit-1)+'…':label);
    });
    attachActions(entries);
    const months=g.append('g').selectAll('g').data(d3.range(1,13)).join('g').attr('class','month-label').attr('role','button').attr('tabindex',0).attr('aria-label',(m)=>`Filter month ${m}: ${monthName(m)}`).attr('aria-pressed',(m)=>String(state.month===m)).on('click',(_,m)=>{state.month=state.month===m?0:m;$('#month-filter').value=String(state.month);render();}).on('keydown',(event,m)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();state.month=state.month===m?0:m;$('#month-filter').value=String(state.month);render();}});
    months.each(function(m){const a=(m-.5)*Math.PI/6,x=Math.sin(a)*397,y=-Math.cos(a)*397,mg=d3.select(this);mg.append('text').attr('x',x).attr('y',y-8).attr('text-anchor','middle').attr('fill',state.month===m?'#e8ca8c':'#c2b18f').attr('font-size',13).attr('font-family','Georgia,serif').text(ROMAN[m-1]);[babylonianMonth(m),JEWISH_MONTHS[m-1]].forEach((label,i)=>mg.append('text').attr('x',x).attr('y',y+6+i*13).attr('text-anchor','middle').attr('fill',state.month===m?'#b7c3d2':'#8395ab').attr('font-size',9).attr('font-family','Inter,Arial,sans-serif').text(label));});
    g.append('circle').attr('r',103).attr('fill','none').attr('stroke','#354359').attr('stroke-opacity',.6);
    g.append('circle').attr('r',95).attr('fill','none').attr('stroke','#26384c').attr('stroke-dasharray','1 7');
    g.append('text').attr('text-anchor','middle').attr('y',-35).attr('fill','#d5ae6d').attr('font-size',17).text('✦');
    g.append('text').attr('text-anchor','middle').attr('y',-7).attr('fill','#dfd4bd').attr('font-family','Georgia,serif').attr('font-size',18).text('THREE STARS');
    g.append('text').attr('text-anchor','middle').attr('y',16).attr('fill','#dfd4bd').attr('font-family','Georgia,serif').attr('font-size',18).text('EACH');
    g.append('text').attr('text-anchor','middle').attr('y',43).attr('fill','#71849c').attr('font-family','Inter,Arial,sans-serif').attr('font-size',8).attr('letter-spacing','.17em').text('ASTROLABE B');
    g.append('text').attr('text-anchor','middle').attr('y',57).attr('fill','#536b86').attr('font-family','Inter,Arial,sans-serif').attr('font-size',7.5).text('MONTHLY ASSIGNMENTS');
  }
  function wheelPoint(e) {
    const ring=WHEEL_RINGS[pathName(e)]||WHEEL_RINGS.Anu;
    const r=(ring[0]+ring[1])/2-9,a=((+e.month-.5)*30+state.wheelRotation)*Math.PI/180;
    return [Math.sin(a)*r,-Math.cos(a)*r];
  }
  function renderBlendWheel(content) {
    const layer=content.append('g').attr('class','blend-wheel').attr('opacity',state.wheelOpacity);
    const arc=d3.arc(),offset=state.wheelRotation*Math.PI/180;
    layer.append('g').attr('pointer-events','none').selectAll('path').data(data.entries).join('path').attr('class','blend-cell').attr('d',e=>{const r=WHEEL_RINGS[pathName(e)];return arc({innerRadius:r[0],outerRadius:r[1],startAngle:(e.month-1)*Math.PI/6+offset+.004,endAngle:e.month*Math.PI/6+offset-.004});}).attr('fill',col).attr('fill-opacity',e=>matches(e)?(e.id===state.selected?.19:.075):.01).attr('stroke',col).attr('stroke-width',e=>e.id===state.selected?1.8:.7).attr('stroke-opacity',e=>matches(e)?.65:.12);
    const slots=layer.append('g').selectAll('g').data(data.entries).join('g').attr('class','blend-slot').attr('opacity',e=>matches(e)?1:.18);
    slots.each(function(e){
      const cell=d3.select(this),[x,y]=wheelPoint(e),a=((e.month-.5)*30+state.wheelRotation)%360;
      cell.append('circle').attr('cx',x).attr('cy',y).attr('r',7).attr('fill','transparent');
      cell.append('path').attr('d',`M${x},${y-3.5}l3.5,3.5l-3.5,3.5l-3.5,-3.5Z`).attr('fill',e.id===state.selected?col(e):'#0b1320').attr('stroke',col(e)).attr('stroke-width',.9);
      if(state.labels){const r=(WHEEL_RINGS[pathName(e)][0]+WHEEL_RINGS[pathName(e)][1])/2+9,t=a*Math.PI/180,label=name(e),limit=pathName(e)==='Enlil'?15:20;cell.append('text').attr('transform',`translate(${Math.sin(t)*r},${-Math.cos(t)*r}) rotate(${a+(a>90&&a<270?180:0)})`).attr('text-anchor','middle').attr('dominant-baseline','middle').attr('fill',col(e)).attr('font-size',9.5).attr('paint-order','stroke').attr('stroke','#080f1b').attr('stroke-width',2.7).text(label.length>limit?label.slice(0,limit-1)+'…':label);}
    });
    attachActions(slots);
    const monthLabels=layer.append('g').attr('pointer-events','none');
    d3.range(1,13).forEach(m=>{const angle=((m-.5)*30+state.wheelRotation)%360,a=angle*Math.PI/180;monthLabels.append('text').attr('transform',`translate(${Math.sin(a)*346},${-Math.cos(a)*346}) rotate(${angle+(angle>90&&angle<270?180:0)})`).attr('text-anchor','middle').attr('dominant-baseline','middle').attr('fill','#e5d3b0').attr('font-size',9).attr('paint-order','stroke').attr('stroke','#080f1b').attr('stroke-width',2.5).text(ROMAN[m-1]+' · '+monthName(m));});
    const selected=state.catalogueLayer&&data.entries.find(e=>e.id===state.selected&&matches(e)&&locatorVisible(e));
    if(selected){const p=wheelPoint(selected),q=skyPoint(selected.raDeg,selected.decDeg);content.append('path').attr('class','blend-connector').attr('d',`M${p}L${q}`).attr('fill','none').attr('stroke',col(selected)).attr('stroke-width',1.2).attr('stroke-dasharray','5 4').attr('opacity',.85).attr('pointer-events','none');}
  }
  function projectionCenter() {
    if(state.center!=='ncp') {
      const star=(data.calibrationStars||[]).find(s=>String(s.name).toLowerCase()===state.center);
      if(star)return {...star,...epochPosition(star)};
    }
    return {name:'North celestial pole',raDeg:0,decDeg:90};
  }
  function skyPoint(ra,dec) {
    if(!finite(ra)||!finite(dec)||+dec < -90||+dec > 90)return [NaN,NaN];
    const s=coordinateLookup.get(`${ra},${dec}`)||{raDeg:+ra,decDeg:+dec,coordinateEpoch:2000};
    const p=epochPosition(s);return projectEquatorial(p.raDeg,p.decDeg);
  }
  function projectEquatorial(ra,dec) {
    if(!finite(ra)||!finite(dec)||+dec < -90||+dec > 90)return [NaN,NaN];
    const rad=Math.PI/180,rotation=state.rotation*rad;
    // Keep the original north-pole orientation exactly: RA increases clockwise.
    if(state.center==='ncp') {
      const a=(+ra)*rad+rotation,r=(90-(+dec))/180*355;
      return [Math.sin(a)*r,-Math.cos(a)*r];
    }
    const c=projectionCenter(),ca=c.raDeg*rad,cd=c.decDeg*rad;
    const cx=Math.cos(cd)*Math.cos(ca),cy=Math.cos(cd)*Math.sin(ca),cz=Math.sin(cd);
    const a=(+ra)*rad,d=(+dec)*rad,x=Math.cos(d)*Math.cos(a),y=Math.cos(d)*Math.sin(a),z=Math.sin(d);
    // Minimum 3D rotation c -> north pole (Rodrigues), with no extra roll.
    const k=1/(1+cz),X=(1-cx*cx*k)*x-cx*cy*k*y-cx*z,Y=-cx*cy*k*x+(1-cy*cy*k)*y-cy*z,Z=cx*x+cy*y+cz*z;
    const h=Math.hypot(X,Y),r=Math.atan2(h,Z)/Math.PI*355;
    if(h<1e-12&&Z>0)return [0,0];
    const bearing=(h<1e-12?0:Math.atan2(Y,X))+rotation;
    return [Math.sin(bearing)*r,-Math.cos(bearing)*r];
  }
  function centerDistance(ra,dec) {return Math.hypot(...skyPoint(ra,dec))/355*180;}
  function localZoom(t) {return d3.zoomIdentity.translate(t.x+430*t.k-430,t.y+430*t.k-430).scale(t.k);}
  function wheelGestureAllowed(event) {
    if ((event.ctrlKey && event.type !== 'wheel') || event.button) return false;
    const points=event.touches?.length?Array.from(event.touches):[event];
    // Follow the resized and panned wheel, including its outer coordinate labels.
    // Invert the SVG zoom before testing the wheel's own coordinate space.
    if (!points.every(point=>{const [x,y]=zoomTransform.invert(d3.pointer(point,svg.node()));return Math.hypot(x-430,y-430)<=395;})) return false;
    return event.type==='wheel'||!event.target.closest?.('.sky-marker,.reference-star,.calibration-star,.blend-slot');
  }
  function renderSky(g,defs) {
    defs.append('clipPath').attr('id','sky-clip').append('circle').attr('r',355);
    const wheel=g.append('g').attr('class','atlas-wheel').attr('transform',localZoom(zoomTransform));
    wheel.append('circle').attr('class','atlas-rim').attr('r',355).attr('fill','#080f1b').attr('stroke','#36485f');
    const viewport=wheel.append('g').attr('clip-path','url(#sky-clip)');
    const content=viewport.append('g');
    const grid=content.append('g');
    if(state.grid){
      [30,60,90,120,150].forEach((distance)=>{const r=distance/180*355,dec=90-distance;grid.append('circle').attr('r',r).attr('fill','none').attr('stroke',distance===90?'#465573':'#293a52').attr('stroke-width',distance===90?1:.6).attr('stroke-dasharray',distance===90?null:'2 4');grid.append('text').attr('x',5).attr('y',-r+11).attr('font-size',8).attr('fill','#607894').attr('font-family','Inter,Arial,sans-serif').text(state.center==='ncp'?(dec>0?'+':'')+dec+'°':distance+'°');});
      d3.range(0,360,30).forEach((angle)=>{const a=(angle+state.rotation)*Math.PI/180;grid.append('line').attr('x1',0).attr('y1',0).attr('x2',Math.sin(a)*355).attr('y2',-Math.cos(a)*355).attr('stroke','#26374e').attr('stroke-width',.6);});
      const ep=[];for(let l=0;l<=360;l+=2){const v=l*Math.PI/180,eps=23.4392911*Math.PI/180;let ra=Math.atan2(Math.sin(v)*Math.cos(eps),Math.cos(v))*180/Math.PI;const dec=Math.asin(Math.sin(eps)*Math.sin(v))*180/Math.PI;if(skySolution?.valid){const eq=ObserverSky.eclipticPosition(l,skySolution);ep.push(projectEquatorial(eq.raDeg,eq.decDeg));}else ep.push(skyPoint(ra,dec));}
      grid.append('path').attr('d',d3.line()(ep)).attr('fill','none').attr('stroke','#b09661').attr('stroke-width',.85).attr('stroke-opacity',.55).attr('stroke-dasharray','4 5');
    }
    renderObserverShade(content);
    if(state.wheelLayer) renderBlendWheel(content);
    if(state.catalogueLayer&&state.background){content.append('g').attr('aria-hidden','true').selectAll('circle').data(data.stars.filter(starVisible)).join('circle').attr('class','background-star').attr('opacity',observerOpacity).on('click',(event,s)=>{event.stopPropagation();chooseStar(s);}).attr('cx',(s)=>skyPoint(s.raDeg,s.decDeg)[0]).attr('cy',(s)=>skyPoint(s.raDeg,s.decDeg)[1]).attr('r',(s)=>Math.max(.35,2.15-(finite(s.mag)?+s.mag:5)*.26)).attr('fill',(s)=>s.color || '#b2c6e1').attr('fill-opacity',(s)=>Math.max(.2,.85-(finite(s.mag)?+s.mag:5)*.065));}
    const markers=content.append('g').selectAll('g').data(state.catalogueLayer?data.entries.filter(locatorVisible):[]).join('g').attr('class','sky-marker').attr('transform',(e)=>`translate(${skyPoint(e.raDeg,e.decDeg)})`).attr('opacity',(e)=>(matches(e)?1:.12)*observerOpacity(e));
    markers.append('circle').attr('class','marker-halo').attr('r',(e)=>e.id===state.selected?10:7).attr('fill',(e)=>col(e)).attr('fill-opacity',.08).attr('stroke',(e)=>col(e)).attr('stroke-width',1).attr('stroke-opacity',(e)=>e.id===state.selected?1:.6);
    markers.append('circle').attr('r',(e)=>e.id===state.selected?3.4:2.7).attr('fill','none').attr('stroke',(e)=>col(e)).attr('stroke-width',1.2);
    if(state.labels)markers.filter(e=>state.view!=='blend'||e.id===state.selected).append('text').attr('class','star-annotation').attr('x',11).attr('y',3).attr('font-size',9).attr('font-family','Inter,Arial,sans-serif').attr('fill',(e)=>col(e)).attr('paint-order','stroke').attr('stroke','#080f1b').attr('stroke-width',3).attr('stroke-linejoin','round').text((e)=>name(e));
    attachActions(markers);
    if(state.catalogueLayer&&state.references) drawStarPoints(content,referenceStars(),'reference-star',false);
    drawStarPoints(content,state.catalogueLayer?(data.calibrationStars||[]).filter(starVisible):[],'calibration-star',true);
    renderObserverOverlay(content);
    // This is already an equinox-of-date direction. Project it directly:
    // skyPoint would incorrectly apply the catalogue precession a second time.
    const equinoxLabel=state.center==='ncp'?'Spring equinox':'Ephemeris equinox';
    const equinox=content.append('g').attr('class','equinox-marker').attr('transform',`translate(${projectEquatorial(0,0)})`).attr('role','img').attr('aria-label',`${equinoxLabel}: right ascension 0h, declination 0 degrees`).attr('pointer-events','none');
    equinox.append('title').text(`${equinoxLabel} · 0h right ascension · 0° declination`);
    equinox.append('path').attr('d','M-7,0H7M0,-7V7').attr('fill','none').attr('stroke','#8bd5c2').attr('stroke-width',.9);
    equinox.append('circle').attr('r',3.5).attr('fill','#8bd5c2').attr('stroke','#07121e').attr('stroke-width',1.3);
    if(state.labels)equinox.append('text').attr('x',10).attr('y',-8).attr('fill','#b1e4d6').attr('font-size',9).attr('font-family','Inter,Arial,sans-serif').attr('paint-order','stroke').attr('stroke','#080f1b').attr('stroke-width',3).attr('stroke-linejoin','round').text(equinoxLabel);
    const pole=content.append('g').attr('class','celestial-pole').attr('transform',`translate(${projectEquatorial(0,90)})`).attr('aria-label','North celestial pole: declination plus 90 degrees');
    pole.append('path').attr('d','M-7,0H7M0,-7V7').attr('stroke','#f3db9b').attr('stroke-width',1);
    pole.append('circle').attr('r',4).attr('fill','none').attr('stroke','#f3db9b').attr('stroke-width',.7);
    pole.append('text').attr('x',11).attr('y',-11).attr('fill','#f3db9b').attr('font-size',8).attr('paint-order','stroke').attr('stroke','#080f1b').attr('stroke-width',2).text(`NCP (${skySolution?.valid?`${state.observer.year} ${state.observer.era.toUpperCase()}`:'2000 CE'})`);
    if(state.center!=='ncp') {
      const center=content.append('g').attr('class','projection-center').attr('aria-label',`Assumed rotation pole: ${projectionCenter().name}`);
      center.append('circle').attr('r',8).attr('fill','none').attr('stroke','#e3c67e').attr('stroke-dasharray','2 2');
      center.append('text').attr('x',-11).attr('y',-11).attr('text-anchor','end').attr('fill','#e3c67e').attr('font-size',8).attr('paint-order','stroke').attr('stroke','#080f1b').attr('stroke-width',2).text('ASSUMED POLE · '+projectionCenter().name);
    }
    const coordinates=wheel.append('g').attr('class','atlas-coordinates');
    d3.range(0,360,30).forEach((angle)=>{const a=(angle+state.rotation)*Math.PI/180;coordinates.append('text').attr('x',Math.sin(a)*377).attr('y',-Math.cos(a)*377+3).attr('text-anchor','middle').attr('fill','#8c9fb8').attr('font-size',11).attr('font-family','Inter,Arial,sans-serif').text(state.center==='ncp'?angle/15+'h':angle+'°');});
    g.append('text').attr('text-anchor','middle').attr('y',-404).attr('fill','#7388a3').attr('font-family','Inter,Arial,sans-serif').attr('font-size',9).attr('letter-spacing','.15em').text(state.center==='ncp'?'RIGHT ASCENSION · NORTH POLAR PROJECTION':'ANGLE ABOUT ASSUMED POLE · '+projectionCenter().name.toUpperCase());
    const total=data.entries.length, mapped=data.entries.filter(hasPosition).length;
    $('#sky-omissions').textContent=`${data.entries.filter(locatorVisible).length} of ${mapped} locators meet cutoff · ${total-mapped} entries without a fixed locator`;
    const zoom=d3.zoom().scaleExtent([1,5]).extent([[75,75],[785,785]]).filter(wheelGestureAllowed).on('zoom',(event)=>{zoomTransform=event.transform;wheel.attr('transform',localZoom(zoomTransform));hideTip();});
    svg.call(zoom).on('dblclick.zoom',null);
    svg.property('__zoom',zoomTransform);
  }
  function starName(s){return s.name||s.locatorName||s.properName||s.bayerFlamsteed||(s.hip?'HIP '+s.hip:s.gaiaDr2Id?'Gaia DR2 '+s.gaiaDr2Id:s.gaiaDr3Id?'Gaia DR3 '+s.gaiaDr3Id:s.id||'Catalogue star');}
  function starKey(s){return s.hip?'HIP '+s.hip:s.gaiaDr2Id?'Gaia '+s.gaiaDr2Id:s.gaiaDr3Id?'Gaia '+s.gaiaDr3Id:s.id||`${s.raDeg},${s.decDeg}`;}
  function referenceStars(){
    const found=new Map();
    data.entries.filter(matches).forEach((e)=>(e.anchorStars||[]).filter(starVisible).forEach((s)=>{const key=starKey(s);if(!found.has(key))found.set(key,{...s,associatedEntries:[name(e)],path:e.path});else found.get(key).associatedEntries.push(name(e));}));
    return [...found.values()];
  }
  function chooseStar(s){state.selectedStar=s;hideTip();renderDetail();if(state.view==='ground')renderGroundSky();}
  function drawStarPoints(content,stars,cls,calibration){
    const points=content.append('g').selectAll('g').data(stars).join('g').attr('class',cls).attr('opacity',observerOpacity).attr('transform',(s)=>`translate(${skyPoint(s.raDeg,s.decDeg)})`).attr('tabindex',0).attr('role','button').attr('aria-label',(s)=>`${starName(s)}, measured catalogue star. Right ascension ${formatRA(s.raDeg)}, declination ${formatDec(s.decDeg)}.`).on('click',(event,s)=>{event.stopPropagation();chooseStar(s);}).on('keydown',(event,s)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();chooseStar(s);}});
    points.append('circle').attr('r',calibration?5:4).attr('fill','transparent');
    points.append('circle').attr('r',calibration?2.4:1.9).attr('fill',calibration?'#fff2be':'#d3e6ff').attr('stroke','#07101b').attr('stroke-width',.5);
    points.append('title').text((s)=>`${starName(s)} · ${formatRA(s.raDeg)} / ${formatDec(s.decDeg)}`);
    if(state.labels||calibration)points.filter(s=>calibration || (state.view!=='blend'&&finite(s.mag)&&+s.mag<2.5)).append('text').attr('x',calibration?8:5).attr('y',calibration?13:-4).attr('fill',calibration?'#fff2be':'#bdcee4').attr('font-size',calibration?9:7).attr('paint-order','stroke').attr('stroke','#080f1b').attr('stroke-width',2.5).attr('stroke-linejoin','round').text(starName);
  }
  function renderStarDetail(s){
    const dist=centerDistance(s.raDeg,s.decDeg),src=source({url:s.sourceUrl,label:s.coordinateSource||'Catalogue source'});
    $('#entry-detail').innerHTML=`<div class="detail-kicker">MEASURED CATALOGUE STAR</div><h2>${esc(starName(s))}</h2><div class="coordinate-box"><div><span>RIGHT ASCENSION</span><strong>${formatRA(s.raDeg)}</strong></div><div><span>DECLINATION</span><strong>${formatDec(s.decDeg)}</strong></div></div><dl class="detail-dl"><dt>RA / Dec (degrees)</dt><dd>${(+s.raDeg).toFixed(8)}° / ${(+s.decDeg).toFixed(8)}°</dd><dt>Distance from current centre</dt><dd>${dist.toFixed(4)}° · ${(dist*60).toFixed(3)}′</dd>${finite(s.mag)?`<dt>Magnitude</dt><dd>${(+s.mag).toFixed(3)} ${esc(s.magBand||'')}</dd>`:''}${s.hip?`<dt>Hipparcos</dt><dd>HIP ${esc(s.hip)}</dd>`:''}${s.gaiaDr2Id?`<dt>Gaia DR2</dt><dd>${esc(s.gaiaDr2Id)}</dd>`:''}${s.gaiaDr3Id?`<dt>Gaia DR3</dt><dd>${esc(s.gaiaDr3Id)}</dd>`:''}<dt>Position epoch</dt><dd>${esc(s.coordinateEpoch||data.meta.coordinateEpoch||'As catalogued')}</dd><dt>Coordinate source</dt><dd>${esc(s.coordinateSource||'See catalogue provenance')}</dd></dl>${s.positionNote?`<p class="coordinate-note">${esc(s.positionNote)}</p>`:''}${s.associatedEntries?`<div class="detail-section"><h3>Reference for</h3><p class="entry-notes">${esc(s.associatedEntries.join(' · '))}</p></div>`:''}${src.url?`<a class="detail-source" href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.label)} ↗</a>`:''}<button id="back-entry" class="small-button star-back">Back to celestial name</button>`;
    addObserverDetail(s,true);
    $('#back-entry').addEventListener('click',()=>{state.selectedStar=null;renderDetail();});
  }
  function renderCalibration(){
    const center=projectionCenter(),ncp=state.center==='ncp',polaris=(data.calibrationStars||[]).find(s=>s.name==='Polaris');
    const pc=polaris?epochPosition(polaris):null;
    const poleDist=Math.hypot(...projectEquatorial(0,90))/355*180;
    $('#pole-summary').textContent=ncp?`The north celestial pole ${skySolution?.valid?'of the chosen date':'of the catalogue frame'} defines this projection. Polaris is ${pc?(90-pc.decDeg).toFixed(3):'about 0.74'}° away.`:`${center.name} is the assumed rotation pole. Best fit: ≈ ${state.observer.year} ${state.observer.era.toUpperCase()} (${selectedPoleFit?.offsetDeg.toFixed(3)}° from the mean pole). The ephemeris pole at this readout is ${poleDist.toFixed(3)}° away, marked for comparison. Search interval: 3000 BCE–3000 CE.${selectedPoleFit?.boundary?' The best fit is at the search boundary.':''}`;
    $('.calibration-orientation').textContent=ncp?'At rotation 0°: 0h ↑ · 6h → · 12h ↓ · 18h ←. Right ascension increases clockwise.':'The star defines the axis for the horizon, meridian and reading time. Rings measure angular distance from it. Orientation retains the ephemeris rotation phase after the minimum axis tilt.';
    $('#pole-inset').hidden=!state.poleInset;
    $('#pole-mini').setAttribute('aria-label',`Five-degree close-up around ${center.name}`);
    if(!state.poleInset)return;
    const mini=d3.select('#pole-mini');mini.selectAll('*').remove();const g=mini.append('g').attr('transform','translate(120,120)');
    [1,2.5,5].forEach(r=>{g.append('circle').attr('r',r/5*91).attr('fill','none').attr('stroke','#3c4a60').attr('stroke-dasharray','2 3');g.append('text').attr('x',3).attr('y',-r/5*91-3).attr('fill','#8091aa').attr('font-size',8).text(r+'°');});
    [0,90,180,270].forEach(angle=>{const a=(angle+state.rotation)*Math.PI/180;g.append('line').attr('x2',Math.sin(a)*91).attr('y2',-Math.cos(a)*91).attr('stroke','#26374e');g.append('text').attr('x',Math.sin(a)*108).attr('y',-Math.cos(a)*108+3).attr('text-anchor','middle').attr('fill','#b5c5d9').attr('font-size',9).text(ncp?angle/15+'h':angle+'°');});
    g.append('circle').attr('r',5).attr('fill','none').attr('stroke','#e3c67e').attr('stroke-dasharray','2 2');
    g.append('text').attr('x',-8).attr('y',16).attr('text-anchor','end').attr('fill','#e3c67e').attr('font-size',9).text(ncp?'NCP':center.name);
    const scale=180/355/5*91;
    if(poleDist<=5){const p=projectEquatorial(0,90),pole=g.append('g').attr('class','inset-ncp').attr('transform',`translate(${p[0]*scale},${p[1]*scale})`);pole.append('path').attr('d','M-5,0H5M0,-5V5').attr('stroke','#e3c67e');if(!ncp)pole.append('text').attr('x',7).attr('y',-7).attr('fill','#e3c67e').attr('font-size',9).text('Ephemeris NCP');}
    const near=(data.calibrationStars||[]).filter(s=>starVisible(s)&&centerDistance(s.raDeg,s.decDeg)<=5);
    const points=g.selectAll('.pole-inset-star').data(near).join('g').attr('class','pole-inset-star').attr('role','button').attr('tabindex',0).attr('aria-label',starName).attr('transform',s=>{const p=skyPoint(s.raDeg,s.decDeg);return `translate(${p[0]*scale},${p[1]*scale})`;}).on('click',(_,s)=>chooseStar(s)).on('keydown',(event,s)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();chooseStar(s);}});
    points.append('circle').attr('r',3).attr('fill','#fff0b9');points.append('text').attr('x',6).attr('y',-6).attr('fill','#fff0b9').attr('font-size',10).text(starName);
  }
  function formatRA(deg) {const total=((+deg%360)+360)%360/15,h=Math.floor(total),m=Math.floor((total-h)*60),s=((total-h)*60-m)*60;return `${String(h).padStart(2,'0')}ʰ ${String(m).padStart(2,'0')}ᵐ ${s.toFixed(1)}ˢ`;}
  function formatDec(deg) {const abs=Math.abs(+deg),d=Math.floor(abs),m=Math.floor((abs-d)*60),s=((abs-d)*60-m)*60;return `${+deg<0?'−':'+'}${d}° ${String(m).padStart(2,'0')}′ ${s.toFixed(0)}″`;}
  function renderDetail() {
    if(state.selectedStar){renderStarDetail(state.selectedStar);return;}
    const e=data.entries.find((x)=>x.id===state.selected);if(!e)return;
    const cf=confidence(e),links=listSources(e.sources),pos=hasPosition(e);
    const cultures=e.culturalNames&&typeof e.culturalNames==='object'?Object.entries(e.culturalNames):[];
    const note=Array.isArray(e.notes)?e.notes.join(' '):e.notes || '';
    const epoch=e.coordinateEpoch || data.meta.coordinateEpoch;
    let html=`<div class="detail-kicker">MONTH ${esc(ROMAN[+e.month-1])} · ${esc(monthName(+e.month)).toUpperCase()}</div><h2>${esc(name(e))}</h2><p class="transliteration">${esc(e.transliteration && e.transliteration!==name(e)?e.transliteration:(e.translation || e.meaning || ''))}</p><p class="modern-name">${esc(modern(e))}</p><div class="detail-tags"><span class="tag" style="color:${col(e)};border-color:${col(e)}55">PATH OF ${esc(pathName(e).toUpperCase())}</span><span class="tag ${cf.kind}">${esc(cf.label)} identification</span>${isPlanet(e)?'<span class="tag">Planet designation</span>':''}</div>${note?`<p class="entry-notes">${esc(note)}</p>`:''}`;
    html+='<div class="detail-section"><h3>Catalogue anchor</h3>';
    if(pos){html+=`<div class="coordinate-box"><div><span>RIGHT ASCENSION</span><strong>${formatRA(e.raDeg)}</strong></div><div><span>DECLINATION</span><strong>${formatDec(e.decDeg)}</strong></div></div><dl class="detail-dl">${finite(e.mag)?`<dt>Magnitude</dt><dd>${(+e.mag).toFixed(2)}${e.magBand?' '+esc(e.magBand):''}</dd>`:''}${e.hip?`<dt>Hipparcos</dt><dd>HIP ${esc(e.hip)}</dd>`:''}${e.gaiaDr2Id?`<dt>Gaia DR2</dt><dd>${esc(e.gaiaDr2Id)}</dd>`:''}<dt>Distance from current centre</dt><dd>${centerDistance(e.raDeg,e.decDeg).toFixed(2)}°</dd>${epoch?`<dt>Position epoch</dt><dd>${esc(epoch)}</dd>`:''}</dl><p class="coordinate-note">${esc(e.coordinateNote || 'Reference position for this identification.')} ${esc(typeof e.coordinateSource==='object'?e.coordinateSource.label||e.coordinateSource.name:e.coordinateSource||'')}</p>`;}else{html+=`<p class="coordinate-note">${esc(e.coordinateNote || (isPlanet(e)?'Planets change position relative to the stars.':'No catalogue position is assigned.'))}</p>`;}
    html+='</div>';
    if(cultures.length)html+=`<div class="detail-section"><h3>Names across traditions</h3><dl class="detail-dl">${cultures.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(cleanText(v))}</dd>`).join('')}</dl></div>`;
    if(links.length)html+=`<div class="detail-section"><h3>Research trail <span class="source-count">${links.length} source${links.length===1?'':'s'}</span></h3>${links.map((s)=>`<a class="detail-source" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a>`).join('')}</div>`;
    $('#entry-detail').innerHTML=html;
    addObserverDetail(e);
  }
  function renderTable(){
    const rows=data.entries.filter(matches).sort((a,b)=>+a.month-+b.month||['Enlil','Anu','Ea'].indexOf(pathName(a))-['Enlil','Anu','Ea'].indexOf(pathName(b)));
    $('#register-body').innerHTML=rows.map((e)=>{const cf=confidence(e);return `<tr class="${e.id===state.selected?'selected':''}"><td>${esc(ROMAN[+e.month-1])} · ${esc(monthName(+e.month))}</td><td><button data-entry="${esc(e.id)}">${esc(name(e))}${e.transliteration&&e.transliteration!==name(e)?`<span class="table-transliteration">${esc(e.transliteration)}</span>`:''}</button></td><td><span class="path-dot" style="background:${col(e)}"></span>${esc(pathName(e))}</td><td>${esc(modern(e))}</td><td><span class="confidence-label ${cf.kind}">${esc(cf.label)}</span></td></tr>`;}).join('');
    $('#empty-results').hidden=!!rows.length;
    document.querySelectorAll('[data-entry]').forEach((b)=>b.addEventListener('click',()=>choose(data.entries.find((e)=>e.id===b.dataset.entry),true)));
  }
  function render(){renderChart();renderDetail();renderTable();}
  function saveFile(content,type,filename){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
  function exportCSV(){const fields=['id','month','monthName','jewishMonthName','path','ancientName','transliteration','modernIdentification','confidence','raDeg','decDeg','mag','hip','gaiaDr2Id','coordinateRole','laterAssociation','coordinateEpoch','coordinateSource','coordinateNote','notes'];const csv=[fields.join(','),...data.entries.filter(matches).map((e)=>fields.map((k)=>'"'+cleanText(k==='jewishMonthName'?JEWISH_MONTHS[e.month-1]:e[k]).replace(/"/g,'""')+'"').join(','))].join('\r\n');saveFile('\ufeff'+csv,'text/csv;charset=utf-8','mazzaroth-celestial-register.csv');}
  function exportSVG(){if(state.view==='ground'){ensureGroundViewer().render();$('#ground-canvas').toBlob(blob=>{if(blob)saveFile(blob,'image/png','mazzaroth-ground-sky.png');},'image/png');return;}const node=$('#sky-wheel').cloneNode(true);node.setAttribute('xmlns','http://www.w3.org/2000/svg');node.setAttribute('width','1720');node.setAttribute('height','1720');const bg=document.createElementNS('http://www.w3.org/2000/svg','rect');bg.setAttribute('width','860');bg.setAttribute('height','860');bg.setAttribute('fill','#0b1320');node.insertBefore(bg,node.firstChild);const desc=document.createElementNS('http://www.w3.org/2000/svg','desc');desc.textContent=`Mazzaroth — ${state.view==='wheel'?'Astrolabe B comparative monthly diagram':state.view==='blend'?'Calendar wheel over catalogue sky':'Catalogue sky projection'}. ${data.meta.coordinateLabel||'Catalogue positions'}. ${state.view==='blend'?`Wheel angle ${state.wheelRotation}°; sky angle ${state.rotation}°.`:state.view==='sky'?`Sky angle ${state.rotation}°.`:''} ${state.view==='wheel'?'':`Projection centre ${projectionCenter().name}; ${selectedPoleFit?`assumed rotation pole, best-fit epoch ${state.observer.year} ${state.observer.era.toUpperCase()}, mean-pole residual ${selectedPoleFit.offsetDeg.toFixed(4)}°; `:''}${observerSolution?.valid?`${state.observer.year} ${state.observer.era.toUpperCase()}, ${state.observer.latitude}° latitude, ${state.observer.longitude}° longitude, ${state.observer.period}, ${state.observer.timing} timing, Sun altitude ${observerSolution.sunAltitude.toFixed(2)}°, nominal ${monthName(nominalDate().month)} ${nominalDate().day}, ${state.observer.calendarDay}° (365 days scaled to 360)`:skySolution?.valid?`${state.observer.year} ${state.observer.era.toUpperCase()}, no observer overlay`:'catalogue epoch unchanged'}. Apparent-magnitude cutoff ${state.magnitudeLimit.toFixed(1)} (mixed Gaia G / Johnson V).`} Historical identifications have varying confidence. See source atlas for provenance.`;node.insertBefore(desc,node.firstChild);saveFile('<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(node),'image/svg+xml;charset=utf-8',`mazzaroth-${state.view}.svg`);}
  const creditText = value => String(value||'').replace(/<\/?(?:p|br)[^>]*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1 ($2)').replace(/\*+/g,'').trim();
  function sourcesDialog(){
    const meta=data.meta;
    const lines=[meta.methodology,meta.notes].filter(Boolean).map(cleanText);
    const fallback='The wheel shows Astrolabe B’s monthly assignments. The catalogue sky uses an azimuthal equidistant projection, with the opposite pole at the rim. Group markers show the unweighted spherical centres of their reference stars. Unidentified entries have no sky marker.';
    $('#method-content').innerHTML=`<h3>The reconstruction</h3><p>${esc(fallback)}</p>${lines.map((x)=>`<p>${esc(x)}</p>`).join('')}<h3>Brightness filter</h3><p>Lower magnitudes are brighter. The catalogue combines Gaia G and Hipparcos Johnson V measurements, which use different passbands. The slider is therefore an approximate brightness filter. Figure markers stay visible when at least one reference star meets the cutoff; their positions remain unchanged.</p><h3>Catalogue provenance</h3><p>${esc(cleanText(meta.catalogueSummary || meta.catalogSummary || 'See individual entries for catalogue identifiers and coordinate provenance.'))}</p><p>${esc(meta.coordinateLabel || 'Positions are displayed in the coordinate frame and epoch supplied by the research dataset. Observer mode applies epoch reconstruction; a selected pole star retains its fitted epoch even with the overlay off.')} The gold dashed curve is the ecliptic of the selected date (J2000 when the observer is off with Celestial pole selected); grey circles mark declination for the north-pole view and angular distance from the centre for star-centred views.</p>`;
    $('#method-content').innerHTML+=`<h3 id="constellation-credits">Constellation traditions</h3><p>Each tradition follows the source credited below. Western figures are Stellarium stick figures, not IAU boundaries; the Chinese chart includes later southern additions. Dendera represents a late Greco-Egyptian synthesis. The Norse Edda figures are a modern reconstruction from medieval texts.</p><p>Lines connect catalogue members by short great-circle arcs. Below-horizon figures are dimmed; faint-star filtering does not erase the figures. Single-object asterisms use rings. Some figure endpoints represent cluster centres or nonstellar reference points. The Hebrew biblical and Avestan sets use markers at identified star groups; the cited texts do not supply connecting lines. Later Hebrew and Middle Persian zodiac names use attributed modern reference outlines. Names with unknown positions appear in the evidence notes. Labels are placed at the spherical mean of the figure’s members and may be suppressed to avoid overlap. The downloadable JSON retains all English and native names, original connections, coordinate provenance, and credits.</p>${constellationData.traditions.map(t=>{
      const credit=t.source||{},url=source(credit).url,licenseUrl=source({url:credit.licenseUrl}).url,descriptionUrl=source({url:credit.descriptionUrl}).url;
      return `<h4>${esc(t.label)} · ${t.constellations.length} figures</h4><p>${esc(credit.authors)}. ${licenseUrl?`<a href="${esc(licenseUrl)}" target="_blank" rel="noopener">${esc(credit.license)}</a>`:esc(credit.license)}. ${url?`<a href="${esc(url)}" target="_blank" rel="noopener">${t.kind==='research-comparison'?'Source text':'Pinned source'}</a>`:''}${descriptionUrl?` · <a href="${esc(descriptionUrl)}" target="_blank" rel="noopener">Original description</a>`:''}.</p><p>${esc(credit.changes)}</p>${t.geometryNotice?`<p>${esc(t.geometryNotice)}</p>`:''}<details class="constellation-credit-details"><summary>Original authors and license statement</summary><p>${esc(creditText(credit.authorsText))}</p><p>${esc(creditText(credit.licenseText))}</p></details>`;
    }).join('')}`;
    const all=[...listSources(meta.sources),...data.entries.flatMap((e)=>listSources(e.sources))];
    const seen=new Set();const unique=all.filter((s)=>{if(seen.has(s.url))return false;seen.add(s.url);return true;});
    $('#historical-sources').innerHTML=unique.map((s)=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('')||'<li>Source references are available in the research dataset.</li>';
    $('#sources-dialog').showModal();
  }
  function bind(){
    bindObserver();
    document.querySelectorAll('[data-look]').forEach(button=>button.addEventListener('click',()=>{
      const value=button.dataset.look,viewer=ensureGroundViewer();
      viewer.setView(value==='up'?{altitude:90}:value==='down'?{altitude:-90}:{azimuth:+value,altitude:15});
    }));
    $('#ground-reset').addEventListener('click',()=>ensureGroundViewer().reset());
    $('#ground-focus').addEventListener('click',focusGroundSelection);
    $('#ground-fov').addEventListener('input',event=>ensureGroundViewer().setView({fov:+event.target.value}));
    $('#ground-grid').addEventListener('change',event=>{groundGrid=event.target.checked;renderChart();});
    $('#ground-tradition').addEventListener('change',event=>{constellationTradition=event.target.value;selectedFigure='';$('#ground-tradition-evidence').open=false;updateConstellationDescription();renderGroundSky();});
    $('#ground-figure').addEventListener('change',event=>{selectedFigure=event.target.value;focusGroundFigure();});
    $('#ground-constellation-labels').addEventListener('change',event=>{constellationLabels=event.target.checked;renderGroundSky();});
    $('#toggle-labels').addEventListener('click',()=>{state.labels=!state.labels;$('#toggle-labels').setAttribute('aria-pressed',String(state.labels));$('#toggle-labels').textContent=(state.view==='ground'?'Star labels ':'Labels ')+(state.labels?'on':'off');renderChart();});
    $('#wheel-rotation').addEventListener('input',e=>{state.wheelRotation=+e.target.value;$('#wheel-rotation-value').textContent=state.wheelRotation+'°';renderChart();});
    $('#wheel-opacity').addEventListener('input',e=>{state.wheelOpacity=+e.target.value/100;$('#wheel-opacity-value').textContent=e.target.value+'%';renderChart();});
    $('#rotation').addEventListener('input',(e)=>{state.rotation=+e.target.value;$('#rotation-value').textContent=state.rotation+'°';renderChart();});
    $('#background-stars').addEventListener('change',(e)=>{state.background=e.target.checked;renderChart();});
    $('#reference-stars').addEventListener('change',(e)=>{state.references=e.target.checked;renderChart();});
    document.querySelectorAll('input[name="projection-center"]').forEach(input=>input.addEventListener('change',()=>{if(!input.checked)return;selectPole(input.value);zoomTransform=d3.zoomIdentity;hideTip();render();}));
    $('#center-pole').addEventListener('click',()=>{state.rotation=0;zoomTransform=d3.zoomIdentity;$('#rotation').value='0';$('#rotation-value').textContent='0°';render();});
    $('#pole-closeup').addEventListener('click',()=>{state.poleInset=!state.poleInset;$('#pole-closeup').setAttribute('aria-expanded',String(state.poleInset));$('#pole-inset').hidden=!state.poleInset;renderCalibration();});
    $('#show-grid').addEventListener('change',(e)=>{state.grid=e.target.checked;renderChart();});
    $('#reset').addEventListener('click',()=>{if(groundViewer)groundViewer.reset();state.center='ncp';state.poleChoice='ncp';selectedPoleFit=null;manualEpoch={year:1200,era:'bce'};Object.assign(state.observer,{enabled:true,latitude:32.54,longitude:44.42,year:1200,era:'bce',calendarDay:90,period:'morning',twilight:-9,timing:'solar'});$('#observer-place').value='babylon';syncObserverInputs();Object.assign(state,{center:'ncp',path:'all',month:0,search:'',rotation:0,wheelRotation:0,wheelOpacity:.75,magnitudeLimit:6.5,wheelLayer:true,catalogueLayer:true});zoomTransform=d3.zoomIdentity;document.querySelectorAll('input[name="projection-center"]').forEach(input=>input.checked=input.value===state.poleChoice);$('#magnitude-limit').value='6.5';$('#wheel-rotation').value='0';$('#wheel-rotation-value').textContent='0°';$('#wheel-opacity').value='75';$('#wheel-opacity-value').textContent='75%';$('#search').value='';$('#month-filter').value='0';$('#rotation').value='0';$('#rotation-value').textContent='0°';document.querySelectorAll('[data-path]').forEach((b)=>{const on=b.dataset.path==='all';b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});render();});
    $('#export-csv').addEventListener('click',exportCSV);$('#export-svg').addEventListener('click',exportSVG);
    ['#open-sources','#footer-sources'].forEach((s)=>$(s).addEventListener('click',sourcesDialog));
    $('#constellation-sources').addEventListener('click',()=>{sourcesDialog();$('#constellation-credits').scrollIntoView({block:'start'});});
    $('#close-sources').addEventListener('click',()=>$('#sources-dialog').close());
    $('#sources-dialog').addEventListener('click',(e)=>{if(e.target===$('#sources-dialog')){const b=e.target.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)e.target.close();}});
  }
  function selectedPole() {
    return state.center==='ncp'?null:(data.calibrationStars||[]).find(s=>String(s.name).toLowerCase()===state.center)||null;
  }
  function isAssumedPole(s) {
    const pole=selectedPole();return !!pole&&starKey(pole)===starKey(s);
  }
  function selectPole(center) {
    if(state.poleChoice==='custom')manualEpoch={year:state.observer.year,era:state.observer.era};
    state.poleChoice=center;
    state.center=center==='custom'?'ncp':center;
    const pole=selectedPole();
    selectedPoleFit=pole?ObserverSky.poleFit(pole):null;
    const year=selectedPoleFit?.year;
    Object.assign(state.observer,selectedPoleFit?{year:year<=0?1-year:year,era:year<=0?'bce':'ce'}:center==='custom'?manualEpoch:{year:1200,era:'bce'});
    if(pole&&state.observer.targetKey===starKey(pole)) {
      state.observer.targetKey=starKey(observerTargets.find(s=>!isAssumedPole(s)));
      state.observer.timing='solar';
    }
    syncObserverInputs();
  }
  function initializeObserver() {
    const records=[...data.stars,...data.entries,...data.entries.flatMap(e=>e.anchorStars||[]),...(data.calibrationStars||[])];
    records.filter(hasPosition).forEach(s=>coordinateLookup.set(`${s.raDeg},${s.decDeg}`,s));
    const candidates=new Map();
    [...data.entries.flatMap(e=>e.anchorStars||[]),...(data.calibrationStars||[])].filter(hasPosition).forEach(s=>candidates.set(starKey(s),s));
    observerTargets=[...candidates.values()].sort((a,b)=>starName(a).localeCompare(starName(b)));
    state.observer.targetKey=starKey(observerTargets.find(s=>s.hip===15863)||observerTargets[0]);
    syncObserverInputs();
  }
  function epochPosition(s) {
    if(!skySolution?.valid)return s;
    const key=`${s.raDeg},${s.decDeg}`;
    if(!epochCache.has(key))epochCache.set(key,ObserverSky.position(s,skySolution));
    return epochCache.get(key);
  }
  function prepareObserver() {
    const o=state.observer;
    const key=JSON.stringify([state.center,state.poleChoice,o]);
    if(key===observerKey)return;
    observerKey=key;epochCache.clear();horizonImageCache=null;
    observerSolution=null;skySolution=null;
    if(!o.enabled&&state.center==='ncp'&&state.poleChoice!=='custom')return;
    try{
      const settings={year:o.era==='bce'?1-o.year:o.year,calendarDay:o.calendarDay,latitude:o.latitude,longitude:o.longitude,period:o.period,sunAltitude:o.twilight,timing:o.timing,target:observerTargets.find(s=>starKey(s)===o.targetKey),poleStar:selectedPole()};
      if(o.enabled)observerSolution=ObserverSky.solve(settings);
      skySolution=observerSolution?.valid?observerSolution:ObserverSky.epochFrame(settings);
    }catch(error){observerSolution={valid:false,reason:error.message||String(error)};}
  }
  function observerOpacity(s){return observerSolution?.valid&&ObserverSky.horizontal(epochPosition(s),observerSolution).altitude<0?.16:1;}
  function syncObserverInputs() {
    const o=state.observer;
    $('#observer-enabled').checked=o.enabled;
    for(const key of ['latitude','longitude','year','era','calendarDay','timing'])$(`#observer-${key}`).value=o[key];
    for(const key of ['year','era']){$(`#observer-${key}`).disabled=state.poleChoice!=='custom';$(`#observer-${key}`).title=state.poleChoice==='custom'?'Enter the epoch year and era':'Set by the selected preset; choose Custom to edit';}
    $('#observer-twilight').value=o.twilight;
    document.querySelectorAll('[name="reading-period"]').forEach(el=>el.checked=el.value===o.period);
    $('#observer-target').innerHTML=observerTargets.filter(s=>!isAssumedPole(s)).map(s=>`<option value="${esc(starKey(s))}">${esc(starName(s))}</option>`).join('');
    $('#observer-target').value=o.targetKey;
  }
  function renderObserverStatus() {
    const o=state.observer,active=observerSolution?.valid;
    $('#observer-controls').hidden=state.view==='wheel';
    $('#observer-fields').hidden=!o.enabled;
    $('.observer-legend').hidden=!active;
    const poleModel=$('#observer-pole-model');
    poleModel.hidden=!selectedPoleFit;
    poleModel.textContent=selectedPoleFit?`${projectionCenter().name} defines the rotation axis. Best-fit epoch ≈ ${o.year} ${o.era.toUpperCase()} · mean-pole offset ${selectedPoleFit.offsetDeg.toFixed(3)}°. The model treats this offset as zero.`:'';
    const date=nominalDate();
    $('#observer-calendar-value').textContent=`${monthName(date.month)} · ${date.day}`;
    $('#observer-calendarDay').value=o.calendarDay;
    $('#observer-calendarDay').setAttribute('aria-valuetext',`${monthName(date.month)}, day ${date.day}`);
    $('#observer-calendar-month').value=date.month;
    $('#observer-calendar-day').value=date.day;
    $('#observer-calendar-scale').textContent=`${o.calendarDay}° · ${ObserverSky.calendarElapsedDays(o.calendarDay).toFixed(3)} elapsed days from the spring equinox`;
    $('#observer-twilight-label').hidden=o.timing==='culmination';
    $('#observer-target-label').hidden=o.timing!=='culmination';
    const status=$('#observer-status');status.classList.toggle('error',o.enabled&&!active);
    if(!o.enabled){status.textContent=selectedPoleFit?'Best-fit epoch sky; observer overlay off.':state.poleChoice==='custom'?'Custom epoch sky; observer overlay off.':'Catalogue frame, epoch unchanged.';if(state.view!=='wheel')$('#frame-label').textContent=selectedPoleFit?`${o.year} ${o.era.toUpperCase()} · assumed pole`:state.poleChoice==='custom'?`${o.year} ${o.era.toUpperCase()} · custom epoch`:'J2000 · catalogue frame';return;}
    if(!active){if(state.view!=='wheel')$('#frame-label').textContent=skySolution?.valid?`${o.year} ${o.era.toUpperCase()} · no reading`:'Catalogue frame · no reading';status.textContent=(observerSolution?.reason||'No reading could be calculated.')+(state.view==='ground'?' Ground sky is unavailable for this reading.':skySolution?.valid?' Epoch sky retained; no observer overlay.':' Catalogue frame shown; no observer overlay.');return;}
    const z=observerSolution;
    status.textContent=`${selectedPoleFit?'Assumed-pole model · ':''}${z.dateLabel} (proleptic Gregorian) · ≈${z.localTimeLabel.slice(0,5)} ${selectedPoleFit?'model local mean time':'local mean solar time'} · Sun ${z.sunAltitude.toFixed(1)}° · LST ${(z.lstDeg/15).toFixed(2)}h${o.timing==='culmination'&&z.sunAltitude>=0?' · Daylight: this timing star fails the night-reading condition.':''}${o.timing==='culmination'&&!z.matchesPeriod?' · Transit falls outside the chosen morning/evening half-day.':''}`;
    if(state.view!=='wheel')$('#frame-label').textContent=`${o.year} ${o.era.toUpperCase()} · ${selectedPoleFit?'assumed pole · ':''}${o.period} readout`;
  }
  // This inverse matches projectEquatorial, including its minimum-rotation convention.
  function inverseProjectedVector(x,y) {
    const rad=Math.PI/180,c=projectionCenter(),ca=c.raDeg*rad,cd=c.decDeg*rad;
    const r=Math.hypot(x,y)/355*Math.PI,a=Math.atan2(x,-y)-state.rotation*rad;
    const X=Math.sin(r)*Math.cos(a),Y=Math.sin(r)*Math.sin(a),Z=Math.cos(r);
    const cx=Math.cos(cd)*Math.cos(ca),cy=Math.cos(cd)*Math.sin(ca),cz=Math.sin(cd),k=1/(1+cz);
    return [(1-cx*cx*k)*X-cx*cy*k*Y+cx*Z,-cx*cy*k*X+(1-cy*cy*k)*Y+cy*Z,-cx*X-cy*Y+cz*Z];
  }
  function horizonImage() {
    const key=observerKey+state.center+','+state.rotation;
    if(horizonImageCache?.key===key)return horizonImageCache.url;
    const canvas=document.createElement('canvas'),n=420;canvas.width=canvas.height=n;
    const ctx=canvas.getContext('2d'),im=ctx.createImageData(n,n),rad=Math.PI/180;
    const up=observerSolution._basis.up;
    const c=projectionCenter(),ca=c.raDeg*rad,cd=c.decDeg*rad,cx=Math.cos(cd)*Math.cos(ca),cy=Math.cos(cd)*Math.sin(ca),cz=Math.sin(cd),k=1/(1+cz);
    const rot=state.rotation*rad;
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      const x=(i+.5-n/2)/(n/2),y=(j+.5-n/2)/(n/2),r=Math.hypot(x,y);if(r>1)continue;
      const a=Math.atan2(x,-y)-rot,s=Math.sin(r*Math.PI),X=s*Math.cos(a),Y=s*Math.sin(a),Z=Math.cos(r*Math.PI);
      const vx=(1-cx*cx*k)*X-cx*cy*k*Y+cx*Z,vy=-cx*cy*k*X+(1-cy*cy*k)*Y+cy*Z,vz=-cx*X-cy*Y+cz*Z;
      if(vx*up[0]+vy*up[1]+vz*up[2]<0){const p=(j*n+i)*4;im.data[p]=1;im.data[p+1]=4;im.data[p+2]=10;im.data[p+3]=190;}
    }
    ctx.putImageData(im,0,0);horizonImageCache={key,url:canvas.toDataURL()};return horizonImageCache.url;
  }
  function observerPath(sample,start=0,end=360) {
    // Re-evaluate the spherical curve between samples: a single degree can
    // sweep hundreds of screen pixels near an azimuthal projection's antipode.
    // The fixed tolerance also stays subpixel at the supported 5x zoom.
    const maxError=.04,maxSegment=8,maxDepth=28,cache=new Map();
    const rad=Math.PI/180,c=projectionCenter(),ca=c.raDeg*rad,cd=c.decDeg*rad;
    const centre=[Math.cos(cd)*Math.cos(ca),Math.cos(cd)*Math.sin(ca),Math.sin(cd)];
    function at(t) {
      if(cache.has(t))return cache.get(t);
      const e=sample(t),a=e.raDeg*rad,h=e.decDeg*rad,v=[Math.cos(h)*Math.cos(a),Math.cos(h)*Math.sin(a),Math.sin(h)];
      const dot=v[0]*centre[0]+v[1]*centre[1]+v[2]*centre[2];
      const cross=Math.hypot(v[1]*centre[2]-v[2]*centre[1],v[2]*centre[0]-v[0]*centre[2],v[0]*centre[1]-v[1]*centre[0]);
      // The antipode has no unique screen bearing. Exclude only a numerical
      // neighbourhood (~6e-9 degrees), then approach the rim on either side.
      const p=dot<0&&cross<1e-10?null:projectEquatorial(e.raDeg,e.decDeg);
      const result=p?.every(Number.isFinite)?p:null;
      cache.set(t,result);return result;
    }
    let d='',last=null;
    function append(p) {
      if(!p){last=null;return;}
      if(last&&p[0]===last[0]&&p[1]===last[1])return;
      d+=(last?'L':'M')+p.map(x=>x.toFixed(3)).join(',');last=p;
    }
    function trace(a,b,pa,pb,depth) {
      const mid=(a+b)/2,pm=at(mid);
      if(!pa&&!pm&&!pb){append(null);return;}
      if(pa&&pm&&pb){
        const length=Math.hypot(pb[0]-pa[0],pb[1]-pa[1]);
        const error=Math.hypot(pm[0]-(pa[0]+pb[0])/2,pm[1]-(pa[1]+pb[1])/2);
        if(length<=maxSegment&&error<=maxError){append(pa);append(pb);return;}
      }
      if(depth<maxDepth){trace(a,mid,pa,pm,depth+1);trace(mid,b,pm,pb,depth+1);}
      else {append(pa);append(null);append(pb);}
    }
    for(let t=start;t<end;t+=1){const next=Math.min(t+1,end);trace(t,next,at(t),at(next),0);}
    return d;
  }
  function renderObserverShade(content) {
    if(!observerSolution?.valid)return;
    content.append('image').attr('class','horizon-shade').attr('x',-355).attr('y',-355).attr('width',710).attr('height',710).attr('href',horizonImage());
  }
  function renderObserverOverlay(content) {
    if(!observerSolution?.valid)return;
    const z=observerSolution,g=content.append('g').attr('class','observer-overlay');
    const horizontal=(alt,az)=>ObserverSky.fromHorizontal(alt,az,z);
    [0,6].forEach(alt=>g.append('path').attr('class',alt?'altitude-guide':'horizon-boundary').attr('d',observerPath(a=>horizontal(alt,a))).attr('fill','none').attr('stroke','#8bd5c2').attr('stroke-width',alt?.8:1.8).attr('stroke-dasharray',alt?'3 5':null).attr('opacity',alt?.55:.95));
    const meridian=a=>horizontal(a<=90?a:180-a,a<=90?0:180);
    g.append('path').attr('class','observer-meridian').attr('d',observerPath(meridian,0,180)).attr('fill','none').attr('stroke','#e6c27b').attr('stroke-width',1.2).attr('stroke-dasharray','7 4');
    [{a:0,h:0,label:'N'},{a:90,h:0,label:'E'},{a:180,h:0,label:'S'},{a:270,h:0,label:'W'},{a:0,h:90,label:'ZENITH'}].forEach(m=>{
      const q=horizontal(m.h,m.a),p=projectEquatorial(q.raDeg,q.decDeg),mark=g.append('g').attr('transform',`translate(${p})`);
      mark.append('circle').attr('r',m.h?3:2).attr('fill',m.h?'#e6c27b':'#8bd5c2');
      if(!m.h)mark.append('text').attr('class','observer-map-label').attr('x',6).attr('y',13).attr('fill','#a0e0d0').text(m.label);
    });
    const sp=projectEquatorial(z.sunEquatorial.raDeg,z.sunEquatorial.decDeg),sun=g.append('g').attr('transform',`translate(${sp})`);
    sun.append('circle').attr('r',4).attr('fill','#dfae6b').attr('fill-opacity',.8);
    sun.append('text').attr('class','observer-map-label').attr('x',7).attr('y',-6).attr('fill','#cda673').text(`SUN ${z.sunAltitude.toFixed(0)}°`);
  }
  function addObserverDetail(s,individual=false) {
    if(!observerSolution?.valid||state.view==='wheel'||!hasPosition(s))return;
    const p=epochPosition(s),h=ObserverSky.horizontal(p,observerSolution),axis=ObserverSky.axisPosition(p,observerSolution);
    const html=`<section class="observer-readout"><h3>Observer’s readout · ${state.observer.period}</h3><dl class="detail-dl"><dt>Altitude</dt><dd>${h.altitude.toFixed(2)}°</dd><dt>Azimuth · N = 0°</dt><dd>${h.azimuth.toFixed(2)}°</dd><dt>Hour angle${selectedPoleFit?' · assumed axis':''}</dt><dd>${Number.isFinite(h.hourAngleDeg)?h.hourAngleDeg.toFixed(2)+'°':'Undefined at pole'}</dd><dt>${selectedPoleFit?'RA · assumed axis':'RA of date'}</dt><dd>${Number.isFinite(h.hourAngleDeg)?(axis.raDeg/15).toFixed(3)+'h':'Undefined at pole'}</dd><dt>${selectedPoleFit?'Dec · assumed axis':'Declination of date'}</dt><dd>${axis.decDeg.toFixed(2)}°</dd></dl><p>${h.altitude<0?'Below the geometric horizon.':'Above the geometric horizon; twilight and atmosphere determine actual visibility.'}</p>${individual&&!isAssumedPole(s)?'<button id="use-timing-star" class="small-button">Use this star to set the reading time →</button>':''}</section>`;
    const anchor=$('#entry-detail .entry-notes')||$('#entry-detail .modern-name');
    if(anchor)anchor.insertAdjacentHTML('afterend',html);else $('#entry-detail').insertAdjacentHTML('beforeend',html);
    if(individual&&!isAssumedPole(s))$('#use-timing-star').addEventListener('click',()=>{const key=starKey(s);if(!observerTargets.some(x=>starKey(x)===key))observerTargets.push(s);state.observer.targetKey=key;state.observer.timing='culmination';syncObserverInputs();render();});
  }
  function bindObserver() {
    const update=()=>{render();};
    $('#observer-enabled').addEventListener('change',e=>{state.observer.enabled=e.target.checked;update();});
    document.querySelectorAll('[name="reading-period"]').forEach(el=>el.addEventListener('change',()=>{if(el.checked){state.observer.period=el.value;update();}}));
    for(const key of ['latitude','longitude','year','twilight'])$('#observer-'+key).addEventListener('change',e=>{if(!e.target.checkValidity()){e.target.reportValidity();return;}state.observer[key]=+e.target.value;if(key==='latitude'||key==='longitude')$('#observer-place').value='custom';update();});
    for(const key of ['era','timing'])$('#observer-'+key).addEventListener('change',e=>{state.observer[key]=e.target.value;update();});
    $('#observer-target').addEventListener('change',e=>{state.observer.targetKey=e.target.value;update();});
    let frame=null;$('#observer-calendarDay').addEventListener('input',e=>{state.observer.calendarDay=+e.target.value;if(frame!==null)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=null;update();});});
    for(const id of ['observer-calendar-month','observer-calendar-day'])$('#'+id).addEventListener('change',e=>{if(!e.target.checkValidity()){e.target.reportValidity();return;}state.observer.calendarDay=(+$('#observer-calendar-month').value-1)*30+(+$('#observer-calendar-day').value-1);update();});
    document.querySelectorAll('[data-calendar-day]').forEach(el=>el.addEventListener('click',()=>{state.observer.calendarDay=+el.dataset.calendarDay;update();}));
    $('#observer-place').addEventListener('change',e=>{const loc={babylon:[32.54,44.42],assur:[35.46,43.26]}[e.target.value];if(loc){[state.observer.latitude,state.observer.longitude]=loc;syncObserverInputs();update();}});
  }

  async function start(){
    try{
      const [payload,cultures]=await Promise.all([
        window.MAZZAROTH_DATA || fetch(new URL('resources/data.json',document.baseURI)).then(r=>{if(!r.ok)throw Error('Dataset request failed: '+r.status);return r.json();}),
        window.MAZZAROTH_CONSTELLATIONS || fetch(new URL('resources/constellations.json',document.baseURI)).then(r=>{if(!r.ok)throw Error('Constellation request failed: '+r.status);return r.json();}).catch(error=>{console.error(error);return null;})
      ]);
      if(cultures)constellationData=cultures;
      data={...payload,entries:payload.entries||[],stars:payload.stars||[],meta:payload.meta||{}};
      if(!data.entries.length)throw Error('The celestial register is empty.');
      data.entries=data.entries.map((e,i)=>({...e,id:String(e.id ?? i+1),month:+e.month,path:pathName(e)}));
      const invalid=data.entries.filter((e)=>!(e.month>=1&&e.month<=12)||!C[e.path]);if(invalid.length)throw Error('The dataset contains an invalid month or divine path.');
      state.selected=(data.entries.find((e)=>/mul\.mul|pleiades/i.test(name(e)+' '+modern(e)))||data.entries[0]).id;

      $('#observer-calendar-month').innerHTML=d3.range(1,13).map(m=>`<option value="${m}">${ROMAN[m-1]} · ${esc(monthName(m))}</option>`).join('');
      initializeObserver();
      initializeConstellations();
      $('#loading').hidden=true;bind();setView(state.view);renderDetail();renderTable();
      window.MazzarothAtlas={getData:()=>data,getState:()=>({...state}),setView,select:(id)=>{const e=data.entries.find((x)=>x.id===id);if(e)choose(e);},skyPoint,projectEquatorial,centerDistance,projectionCenter,referenceStars,getObserver:()=>observerSolution,epochPosition,inverseProjectedVector,getGroundView:()=>groundViewer?.getView()};
    }catch(error){$('#loading').textContent='The research dataset could not be loaded. '+error.message;$('#count-label').textContent='Dataset unavailable';console.error(error);throw error;}
  }
  return {start, refresh:render, setView, destroy(){groundViewer?.destroy();svg.on('.zoom',null);delete window.MazzarothAtlas;}};
}

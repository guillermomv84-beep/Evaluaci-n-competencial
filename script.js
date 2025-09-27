const STORAGE_KEY = 'evalcomp:v6:stable';
const state = {
  data: null, area: null, ciclo: null, trimestre: '1º Trimestre',
  work: {}, instruments: [], cfg: { centro:'', docente:'', grupo:'', fecha:'' }
};
const $ = id => document.getElementById(id);
const esc = s => (s||'').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));

function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }
function load(){ try{ const raw=localStorage.getItem(STORAGE_KEY); if(!raw)return; const p=JSON.parse(raw);
  state.work=p.work||{}; state.instruments=p.instruments||[]; state.cfg=p.cfg||state.cfg; state.area=p.area||state.area; state.ciclo=p.ciclo||state.ciclo; state.trimestre=p.trimestre||state.trimestre;
} catch(e){} }

async function boot(){
  try{
    const res = await fetch('evaluacion_competencial.json');
    state.data = await res.json();
  }catch(e){
    console.error('No se pudo cargar el JSON', e);
    return;
  }

  const areaSel=$('areaSelect'), cicloSel=$('cicloSelect'), triSel=$('trimestreSelect'), search=$('searchInput');
  const cfgCentro=$('cfgCentro'), cfgDocente=$('cfgDocente'), cfgGrupo=$('cfgGrupo'), cfgFecha=$('cfgFecha');
  const btnAddInstrument=$('btnAddInstrument'), newInstrument=$('newInstrument');
  const btnExport=$('btnExport'), btnClearTri=$('btnClearTri');

  load();

  // Poblar áreas de forma segura
  areaSel.innerHTML='';
  Object.keys(state.data || {}).forEach(a=>{
    const o=document.createElement('option'); o.value=a; o.textContent=a; areaSel.appendChild(o);
  });

  // CFG (no bloquear si no existen)
  if(cfgCentro){ cfgCentro.value=state.cfg.centro||''; cfgCentro.addEventListener('input', ()=>{state.cfg.centro=cfgCentro.value; save();}); }
  if(cfgDocente){ cfgDocente.value=state.cfg.docente||''; cfgDocente.addEventListener('input', ()=>{state.cfg.docente=cfgDocente.value; save();}); }
  if(cfgGrupo){ cfgGrupo.value=state.cfg.grupo||''; cfgGrupo.addEventListener('input', ()=>{state.cfg.grupo=cfgGrupo.value; save();}); }
  if(cfgFecha){ cfgFecha.value=state.cfg.fecha||''; cfgFecha.addEventListener('change', ()=>{state.cfg.fecha=cfgFecha.value; save();}); }

  // Defaults
  if(!state.area){
    areaSel.selectedIndex = 0;
    state.area = areaSel.value;
  }else{
    areaSel.value = state.area;
  }
  loadCiclos();
  if(!state.ciclo){
    cicloSel.selectedIndex = 0;
    state.ciclo = cicloSel.value;
  }else{
    cicloSel.value = state.ciclo;
  }
  if(triSel && state.trimestre) triSel.value = state.trimestre;

  // Listeners seguros
  if(areaSel) areaSel.addEventListener('change', ()=>{ state.area=areaSel.value; loadCiclos(); renderAll(); save(); });
  if(cicloSel) cicloSel.addEventListener('change', ()=>{ state.ciclo=cicloSel.value; renderAll(); save(); });
  if(triSel) triSel.addEventListener('change', ()=>{ state.trimestre=triSel.value; renderAll(); save(); });
  if(btnAddInstrument) btnAddInstrument.addEventListener('click', ()=>{
    const name=(newInstrument?.value||'').trim(); if(!name) return;
    if(!state.instruments.includes(name)) state.instruments.push(name);
    if(newInstrument) newInstrument.value='';
    save(); renderAll();
  });
  if(btnExport) btnExport.addEventListener('click', exportSelectedAllTrimestres);
  if(btnClearTri) btnClearTri.addEventListener('click', ()=>{
    const tri=state.trimestre; if(!confirm(`¿Seguro que quieres limpiar todo lo del ${tri}?`)) return;
    Object.keys(state.work).forEach(k=>{ if(state.work[k]?.selected) state.work[k].selected[tri]=false; if(state.work[k]?.indicadores) state.work[k].indicadores[tri]=[]; });
    save(); renderAll();
  });
  if(search) search.addEventListener('input', ()=> filterCriterios(search.value.trim().toLowerCase()));

  renderAll();
}

function loadCiclos(){
  const cicloSel=$('cicloSelect'); if(!cicloSel) return;
  cicloSel.innerHTML='';
  const ciclos = Object.keys((state.data?.[state.area])||{});
  ciclos.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; cicloSel.appendChild(o); });
}

function ensureCritState(critId){
  if(!state.work[critId]) state.work[critId]={selected:{}, indicadores:{}};
  ['1º Trimestre','2º Trimestre','3º Trimestre'].forEach(t=>{
    if(typeof state.work[critId].selected[t]!=='boolean') state.work[critId].selected[t]=false;
    if(!Array.isArray(state.work[critId].indicadores[t])) state.work[critId].indicadores[t]=[];
  });
}

function renderAll(){
  const tb = $('tituloBloque');
  if(tb) tb.textContent = `${state.area} · ${state.ciclo} · ${state.trimestre}`;
  renderAccordion();
  updateTotalsBar();
}

function renderAccordion(){
  const acc=$('accordion'); if(!acc) return; acc.innerHTML='';
  const ces = state.data?.[state.area]?.[state.ciclo]; if(!ces) return;

  Object.entries(ces).forEach(([ceKey,ceObj])=>{
    const item=document.createElement('div'); item.className='accordion-item open';
    const title = `${ceKey} — ${ceObj.descripcion||''}`;
    item.innerHTML=`
      <div class="acc-header" role="button" tabindex="0" aria-expanded="true">
        <div class="acc-title"><span class="badge">${ceKey}</span> ${esc(ceObj.descripcion||'')}</div>
        <div class="chev">▾</div>
      </div>
      <div class="acc-body" id="acc-body-${ceKey}"></div>`;

    const body=item.querySelector(`#acc-body-${CSS.escape(ceKey)}`);

    Object.entries(ceObj.criterios||{}).forEach(([critCode,critDesc])=>{
      const critId=`${ceKey}-${critCode}`;
      ensureCritState(critId);
      const selectedNow=!!state.work[critId].selected[state.trimestre];
      const indicadoresNow=state.work[critId].indicadores[state.trimestre]||[];

      const wrap=document.createElement('div'); wrap.className='criterio';
      wrap.dataset.search = `${ceKey} ${critCode} ${ceObj.descripcion||''} ${critDesc}`.toLowerCase();
      wrap.innerHTML=`
        <header>
          <div class="meta"><span class="badge">${ceKey}</span><strong>${critCode}</strong></div>
          <div style="flex:1">${esc(critDesc)}</div>
        </header>
        <div class="selector-tri">
          <label class="small"><input type="checkbox" ${selectedNow?'checked':''}/> Incluir en ${state.trimestre}</label>
        </div>
        <hr class="sep"/>
        <div class="grid" id="grid-${ceKey}-${critCode}"></div>
        <div class="row-actions no-print">
          <button class="add-row">Añadir fila</button>
        </div>`;

      const grid = wrap.querySelector(`#grid-${CSS.escape(ceKey)}-${CSS.escape(critCode)}`);
      paintSaved(grid, indicadoresNow);

      // Eventos
      const chk = wrap.querySelector('input[type=checkbox]');
      chk.addEventListener('change', ()=>{ state.work[critId].selected[state.trimestre] = chk.checked; save(); updateTotalsBar(); });
      wrap.querySelector('.add-row').addEventListener('click', ()=>{ addRow(grid,null); collectGrid(grid,critId); updateTotalsBar(); });
      grid.addEventListener('click', (ev)=>{
        if(ev.target.classList.contains('del')){
          const row = ev.target.closest('.row'); if(row) row.remove();
          collectGrid(grid,critId); updateTotalsBar();
        }
      });
      grid.addEventListener('change', ()=>{ collectGrid(grid,critId); updateTotalsBar(); });
      grid.addEventListener('blur', ()=>{ collectGrid(grid,critId); updateTotalsBar(); }, true);

      body.appendChild(wrap);
    });

    // Toggle seguro
    const hdr = item.querySelector('.acc-header');
    const toggle = () => {
      const isOpen = item.classList.toggle('open');
      hdr.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    };
    hdr.addEventListener('click', toggle);
    hdr.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); toggle(); } });

    acc.appendChild(item);
  });
}

function addRow(grid,preset){
  const row=document.createElement('div'); row.className='row';
  row.innerHTML=`
    <input placeholder="Indicador de logro" value="${esc(preset?.indicador||'')}"/>
    <input placeholder="Tarea" value="${esc(preset?.tarea||'')}"/>
    <select>${renderInstrumentOptions(preset?.instrumento)}</select>
    <input type="number" min="0" max="100" step="1" placeholder="Ponderación (0-100)" value="${preset?.peso??''}"/>
    <button class="del" title="Eliminar fila">×</button>`;
  grid.appendChild(row);
}

function renderInstrumentOptions(selected){
  const base=['Rúbrica','Lista de cotejo','Escala estimativa','Prueba práctica'];
  const all=Array.from(new Set([...base, ...state.instruments]));
  return all.map(v=>`<option value="${esc(v)}" ${selected===v?'selected':''}>${esc(v)}</option>`).join('');
}

function paintSaved(grid,list){ grid.innerHTML=''; if(!list||!list.length){ addRow(grid,null); return; } list.forEach(item=> addRow(grid,item)); }

function collectGrid(grid,critId){
  const rows=grid.querySelectorAll('.row'); const t=state.trimestre;
  const list=Array.from(rows).map(r=>{
    const [ind,tarea,peso]=r.querySelectorAll('input');
    const inst=r.querySelector('select');
    return { indicador:(ind?.value||'').trim(), tarea:(tarea?.value||'').trim(), instrumento:inst?.value||'', peso:Number(peso?.value||0) };
  }).filter(x=>x.indicador||x.tarea);
  ensureCritState(critId); state.work[critId].indicadores[t]=list; save();
}

function filterCriterios(q){
  document.querySelectorAll('.criterio').forEach(div=>{
    const text=(div.dataset.search||'').toLowerCase();
    div.style.display = text.includes(q) ? '' : 'none';
  });
}

function computeTotals(tri){
  const ces = state.data?.[state.area]?.[state.ciclo]; if(!ces) return {total:0};
  let total=0;
  Object.entries(ces).forEach(([ceKey,ceObj])=>{
    Object.keys(ceObj.criterios||{}).forEach(critCode=>{
      const st = state.work[`${ceKey}-${critCode}`];
      if(st?.selected?.[tri]){
        const list=st.indicadores?.[tri]||[];
        total += list.reduce((s,x)=> s + (Number(x.peso)||0), 0);
      }
    });
  });
  return {total};
}

function updateTotalsBar(){
  const tri = state.trimestre;
  const t = computeTotals(tri).total;
  const val = document.getElementById('totalesValor');
  const est = document.getElementById('totalesEstado');
  if(val) val.textContent = `${t} / 100`;
  if(est){
    est.className = 'estado';
    if(t===100){ est.textContent='OK (100/100)'; est.classList.add('ok'); }
    else if(t<100){ est.textContent=`Falta ${100-t}`; est.classList.add('warn'); }
    else { est.textContent=`Te pasas por ${t-100}`; est.classList.add('bad'); }
  }
}

function exportSelectedAllTrimestres(){
  const cont=document.getElementById('printSelected'); if(!cont) return;
  cont.innerHTML='';

  // Cabecera PDF con logo fijo
  const header=document.createElement('div'); header.className='header-pdf';
  const img=document.createElement('img'); img.src='logo.jpg';
  const info=document.createElement('div'); info.className='info';
  const fecha = state.cfg.fecha || new Date().toISOString().slice(0,10);
  info.innerHTML = `<div><strong>Centro:</strong> ${esc(state.cfg.centro||'')}</div>
                    <div><strong>Docente:</strong> ${esc(state.cfg.docente||'')}</div>
                    <div><strong>Grupo:</strong> ${esc(state.cfg.grupo||'')}</div>
                    <div><strong>Fecha:</strong> ${esc(fecha)}</div>`;
  header.appendChild(img); header.appendChild(info); cont.appendChild(header);

  const h=document.createElement('div'); h.className='h-doc'; h.innerHTML=`<h2 style="margin:0">${state.area} · ${state.ciclo}</h2>`; cont.appendChild(h);

  const ces = state.data?.[state.area]?.[state.ciclo]; if(!ces) return;
  ['1º Trimestre','2º Trimestre','3º Trimestre'].forEach(tri=>{
    const seleccionados=[];
    Object.entries(ces).forEach(([ceKey,ceObj])=>{
      Object.entries(ceObj.criterios||{}).forEach(([critCode,critDesc])=>{
        const st = state.work[`${ceKey}-${critCode}`];
        if(st?.selected?.[tri]){
          seleccionados.push({ ceKey, critCode, critDesc, indicadores: (st.indicadores?.[tri]||[]) });
        }
      });
    });
    if(!seleccionados.length) return;

    const sec=document.createElement('section'); sec.innerHTML = `<h3 class="h-tri">${tri}</h3>`;
    let totalTri=0;
    seleccionados.forEach(item=>{
      const card=document.createElement('div'); card.className='card';
      const rows=(item.indicadores||[]).map(i=>{ totalTri += (Number(i.peso)||0);
        return `<tr><td>${esc(i.indicador||'')}</td><td>${esc(i.tarea||'')}</td><td>${esc(i.instrumento||'')}</td><td>${i.peso??''}</td></tr>`; }).join('');
      card.innerHTML=`
        <div class="meta"><span class="badge">${item.ceKey}</span> <strong>${item.critCode}</strong></div>
        <div class="desc">${esc(item.critDesc)}</div>
        <table class="tbl">
          <thead><tr><th>Indicador de logro</th><th>Tarea</th><th>Instrumento de evaluación</th><th>Peso</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" class="small">(Sin indicadores añadidos)</td></tr>'}</tbody>
        </table>`;
      sec.appendChild(card);
    });
    const sum=document.createElement('div'); sum.className='summary';
    const estado = totalTri===100 ? 'OK (100/100)' : (totalTri<100? `Falta ${100-totalTri}` : `Se excede en ${totalTri-100}`);
    sum.innerHTML = `<h4>Resumen ${tri}</h4><div>Total de ponderación: <strong>${totalTri} / 100</strong> · ${estado}</div>`;
    sec.appendChild(sum);
    cont.appendChild(sec);
  });

  window.print();
}

document.addEventListener('DOMContentLoaded', boot);
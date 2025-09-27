const STORAGE_KEY = 'evalcomp:v4:fixedlogo+renames+help';
const state = {
  data: null, area: null, ciclo: null, trimestre: '1º Trimestre',
  work: {}, instruments: [], cfg: { centro:'', docente:'', grupo:'', fecha:'' } // logo fijo
};
const $ = id => document.getElementById(id);
const esc = s => (s||'').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));

function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }
function load(){ try{ const raw=localStorage.getItem(STORAGE_KEY); if(!raw)return; const p=JSON.parse(raw);
  state.work=p.work||{}; state.instruments=p.instruments||[]; state.cfg=p.cfg||state.cfg; state.area=p.area||state.area; state.ciclo=p.ciclo||state.ciclo; state.trimestre=p.trimestre||state.trimestre;
} catch(e){} }

async function boot(){
  const res = await fetch('evaluacion_competencial.json'); state.data = await res.json();
  const areaSel=$('areaSelect'), cicloSel=$('cicloSelect'), triSel=$('trimestreSelect'), search=$('searchInput');
  const cfgCentro=$('cfgCentro'), cfgDocente=$('cfgDocente'), cfgGrupo=$('cfgGrupo'), cfgFecha=$('cfgFecha');
  load();

  // Áreas
  Object.keys(state.data).forEach(a=>{ const o=document.createElement('option'); o.value=a; o.textContent=a; areaSel.appendChild(o); });

  // CFG
  cfgCentro.value=state.cfg.centro||''; cfgDocente.value=state.cfg.docente||''; cfgGrupo.value=state.cfg.grupo||''; cfgFecha.value=state.cfg.fecha||'';
  cfgCentro.addEventListener('input', ()=>{state.cfg.centro=cfgCentro.value; save();});
  cfgDocente.addEventListener('input', ()=>{state.cfg.docente=cfgDocente.value; save();});
  cfgGrupo.addEventListener('input', ()=>{state.cfg.grupo=cfgGrupo.value; save();});
  cfgFecha.addEventListener('change', ()=>{state.cfg.fecha=cfgFecha.value; save();});

  // Defaults
  if(!state.area){ areaSel.selectedIndex=0; state.area=areaSel.value; } else { areaSel.value=state.area; }
  loadCiclos(); if(!state.ciclo){ cicloSel.selectedIndex=0; state.ciclo=cicloSel.value; } else { cicloSel.value=state.ciclo; }
  if(state.trimestre) triSel.value=state.trimestre;

  areaSel.addEventListener('change', ()=>{state.area=areaSel.value; loadCiclos(); renderAll(); save(); });
  cicloSel.addEventListener('change', ()=>{state.ciclo=cicloSel.value; renderAll(); save(); });
  triSel.addEventListener('change', ()=>{state.trimestre=triSel.value; renderAll(); save(); });
  $('btnAddInstrument').addEventListener('click', ()=>{
    const name=(document.getElementById('newInstrument').value||'').trim(); if(!name) return;
    if(!state.instruments.includes(name)) state.instruments.push(name);
    document.getElementById('newInstrument').value=''; save(); renderAll();
  });
  $('btnExport').addEventListener('click', exportSelectedAllTrimestres);
  $('btnClearTri').addEventListener('click', ()=>{
    const tri=state.trimestre; if(!confirm(`¿Seguro que quieres limpiar todo lo del ${tri}?`)) return;
    Object.keys(state.work).forEach(k=>{ if(state.work[k]?.selected) state.work[k].selected[tri]=false; if(state.work[k]?.indicadores) state.work[k].indicadores[tri]=[]; });
    save(); renderAll();
  });
  document.getElementById('btnHelp_removed').addEventListener('click', openHelp_removed);
  document.getElementById('modal_removedClose').addEventListener('click', closeHelp_removed);
  document.getElementById('modal_removedOk').addEventListener('click', closeHelp_removed);
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeHelp_removed(); });

  document.getElementById('searchInput').addEventListener('input', (e)=> filterCriterios(e.target.value.trim().toLowerCase()));
  renderAll();
}

function openHelp_removed(){ const m=$('modal_removed'); m.setAttribute('aria-hidden','false'); }
function closeHelp_removed(){ const m=$('modal_removed'); m.setAttribute('aria-hidden','true'); }

function loadCiclos(){ const cicloSel=$('cicloSelect'); cicloSel.innerHTML=''; Object.keys(state.data[state.area]||{}).forEach(c=>{ const o=document.createElement('option'); o.value=c;o.textContent=c; cicloSel.appendChild(o); }); }
function ensureCritState(critId){ if(!state.work[critId]) state.work[critId]={selected:{}, indicadores:{}};
  ['1º Trimestre','2º Trimestre','3º Trimestre'].forEach(t=>{ if(typeof state.work[critId].selected[t]!=='boolean') state.work[critId].selected[t]=false; if(!Array.isArray(state.work[critId].indicadores[t])) state.work[critId].indicadores[t]=[]; }); }

function renderAll(){ $('tituloBloque').textContent=`${state.area} · ${state.ciclo} · ${state.trimestre}`; renderAccordion(); updateTotalsBar(); }

function renderAccordion(){
  const acc=$('accordion'); acc.innerHTML=''; const ciclos=state.data[state.area]; if(!ciclos||!ciclos[state.ciclo]) return; const ces=ciclos[state.ciclo];
  Object.entries(ces).forEach(([ceKey,ceObj])=>{
    const item=document.createElement('div'); item.className='accordion-item open';
    item.innerHTML=`<div class='acc-header'><div class='acc-title'><span class='badge'>${ceKey}</span> ${esc(ceObj.descripcion||'')}</div><div class='chev'>▾</div></div><div class='acc-body' id='acc-body-${ceKey}'></div>`;
    const body=item.querySelector(`#acc-body-${CSS.escape(ceKey)}`);
    Object.entries(ceObj.criterios||{}).forEach(([critCode,critDesc])=>{
      const critId=`${ceKey}-${critCode}`; ensureCritState(critId);
      const selectedNow=!!state.work[critId].selected[state.trimestre]; const indicadoresNow=state.work[critId].indicadores[state.trimestre]||[];
      const wrap=document.createElement('div'); wrap.className='criterio'; wrap.dataset.search=`${ceKey} ${critCode} ${ceObj.descripcion||''} ${critDesc}`.toLowerCase();
      wrap.innerHTML=`<header><div class='meta'><span class='badge'>${ceKey}</span><strong>${critCode}</strong></div><div style='flex:1'>${esc(critDesc)}</div></header>
      <div class='selector-tri'><label class='small'><input type='checkbox' ${selectedNow?'checked':''}/> Incluir en ${state.trimestre}</label></div>
      <hr class='sep'/><div class='grid' id='grid-${ceKey}-${critCode}'></div><div class='row-actions no-print'><button class='add-row'>Añadir fila</button></div>`;
      const grid=wrap.querySelector(`#grid-${CSS.escape(ceKey)}-${CSS.escape(critCode)}`); paintSaved(grid, indicadoresNow);
      wrap.querySelector('input[type=checkbox]').addEventListener('change', ()=>{ state.work[critId].selected[state.trimestre]=!state.work[critId].selected[state.trimestre]; save(); updateTotalsBar(); });
      wrap.querySelector('.add-row').addEventListener('click', ()=>{ addRow(grid,null); collectGrid(grid,critId); updateTotalsBar(); });
      grid.addEventListener('click', (ev)=>{ if(ev.target.classList.contains('del')){ const row=ev.target.closest('.row'); if(row) row.remove(); collectGrid(grid,critId); updateTotalsBar(); }});
      grid.addEventListener('change', ()=>{ collectGrid(grid,critId); updateTotalsBar(); });
      grid.addEventListener('blur', ()=>{ collectGrid(grid,critId); updateTotalsBar(); }, true);
      body.appendChild(wrap);
    });
    item.querySelector('.acc-header').addEventListener('click', ()=> item.classList.toggle('open'));
    acc.appendChild(item);
  });
}

function addRow(grid,preset){
  const row=document.createElement('div'); row.className='row';
  row.innerHTML=`
    <input placeholder='Indicador de logro' value='${esc(preset?.indicador||'')}'/>
    <input placeholder='Tarea' value='${esc(preset?.tarea||'')}'/>
    <select>${renderInstrumentOptions(preset?.instrumento)}</select>
    <input type='number' min='0' max='100' step='1' placeholder='Ponderación (0-100)' value='${preset?.peso??''}'/>
    <button class='del' title='Eliminar fila'>×</button>`;
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
  const list=Array.from(rows).map(r=>{ const [ind,tarea,peso]=r.querySelectorAll('input'); const inst=r.querySelector('select');
    return { indicador:(ind?.value||'').trim(), tarea:(tarea?.value||'').trim(), instrumento:inst?.value||'', peso:Number(peso?.value||0) }; }).filter(x=>x.indicador||x.tarea);
  ensureCritState(critId); state.work[critId].indicadores[t]=list; save();
}

function filterCriterios(q){
  document.querySelectorAll('.criterio').forEach(div=>{
    const text=(div.dataset.search||'').toLowerCase(); div.style.display = text.includes(q) ? '' : 'none';
  });
}

function computeTotals(tri){
  const ciclos=state.data[state.area]; if(!ciclos||!ciclos[state.ciclo]) return {total:0}; const ces=ciclos[state.ciclo];
  let total=0;
  Object.entries(ces).forEach(([ceKey,ceObj])=>{
    Object.keys(ceObj.criterios||{}).forEach(critCode=>{
      const critId=`${ceKey}-${critCode}`; const st=state.work[critId];
      if(st?.selected?.[tri]){
        const list=st.indicadores?.[tri]||[];
        total += list.reduce((s,x)=> s + (Number(x.peso)||0), 0);
      }
    });
  });
  return {total};
}

function updateTotalsBar(){
  const tri=state.trimestre; const {total}=computeTotals(tri);
  $('totalesValor').textContent=`${total} / 100`;
  const e=$('totalesEstado'); e.className='estado';
  if(total===100){ e.textContent='OK (100/100)'; e.classList.add('ok'); }
  else if(total<100){ e.textContent=`Falta ${100-total}`; e.classList.add('warn'); }
  else { e.textContent=`Te pasas por ${total-100}`; e.classList.add('bad'); }
}

function exportSelectedAllTrimestres(){
  const cont=$('printSelected'); cont.innerHTML='';

  // Cabecera PDF con logo fijo + datos
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

  const ciclos=state.data[state.area]; if(!ciclos||!ciclos[state.ciclo]) return; const ces=ciclos[state.ciclo]; const trimestres=['1º Trimestre','2º Trimestre','3º Trimestre'];

  trimestres.forEach(tri=>{
    const seleccionados=[]; Object.entries(ces).forEach(([ceKey,ceObj])=>{
      Object.entries(ceObj.criterios||{}).forEach(([critCode,critDesc])=>{ const critId=`${ceKey}-${critCode}`; const st=state.work[critId];
        if(st?.selected?.[tri]){ seleccionados.push({ceKey,critCode,critDesc, indicadores: (st.indicadores?.[tri]||[]) }); } });
    });
    if(!seleccionados.length) return;
    const sec=document.createElement('section'); sec.innerHTML=`<h3 class='h-tri'>${tri}</h3>`; let totalTri=0;
    seleccionados.forEach(item=>{
      const card=document.createElement('div'); card.className='card';
      const rows=(item.indicadores||[]).map(i=>{ totalTri += (Number(i.peso)||0);
        return `<tr><td>${esc(i.indicador||'')}</td><td>${esc(i.tarea||'')}</td><td>${esc(i.instrumento||'')}</td><td>${(i.peso??'')}</td></tr>`; }).join('');
      card.innerHTML=`<div class='meta'><span class='badge'>${item.ceKey}</span> <strong>${item.critCode}</strong></div><div class='desc'>${esc(item.critDesc)}</div>
      <table class='tbl'><thead><tr><th>Indicador de logro</th><th>Tarea</th><th>Instrumento de evaluación</th><th>Peso</th></tr></thead><tbody>${rows or '<tr><td colspan="4" class="small">(Sin indicadores añadidos)</td></tr>'}</tbody></table>`;
      sec.appendChild(card);
    });
    const sum=document.createElement('div'); sum.className='summary'; const estado = totalTri===100 ? 'OK (100/100)' : (totalTri<100? `Falta ${100-totalTri}` : `Se excede en ${totalTri-100}`);
    sum.innerHTML=`<h4>Resumen ${tri}</h4><div>Total de ponderación: <strong>${totalTri} / 100</strong> · ${estado}</div>`; sec.appendChild(sum);
    cont.appendChild(sec);
  });
  window.print();
}

document.addEventListener('DOMContentLoaded', boot);
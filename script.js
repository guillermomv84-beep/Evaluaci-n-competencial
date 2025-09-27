/** Estado con persistencia en localStorage **/
const STORAGE_KEY = 'evalcomp:v2:selected-all-trimestres';
const state = {
  data: null,
  area: null,
  ciclo: null,
  trimestre: '1º Trimestre',
  work: {} // { 'CE1-1.1': { selected: { '1º Trimestre': bool, ... }, indicadores: { '1º Trimestre': [..], ... } } }
};
const $ = id => document.getElementById(id);
const esc = s => (s||'').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));

function save(){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      area: state.area, ciclo: state.ciclo, trimestre: state.trimestre, work: state.work
    }));
  } catch(e) {}
}
function load(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const parsed = JSON.parse(raw);
    state.work = parsed.work || {};
    state.area = parsed.area || state.area;
    state.ciclo = parsed.ciclo || state.ciclo;
    state.trimestre = parsed.trimestre || state.trimestre;
  } catch(e){}
}

async function boot(){
  const res = await fetch('evaluacion_competencial.json');
  state.data = await res.json();

  const areaSel = $('areaSelect');
  const cicloSel = $('cicloSelect');
  const trimestreSel = $('trimestreSelect');

  // áreas
  Object.keys(state.data).forEach(area => {
    const opt = document.createElement('option'); opt.value = area; opt.textContent = area; areaSel.appendChild(opt);
  });

  load();

  if(!state.area){ areaSel.selectedIndex = 0; state.area = areaSel.value; } else { areaSel.value = state.area; }
  loadCiclos();
  if(!state.ciclo){ cicloSel.selectedIndex = 0; state.ciclo = cicloSel.value; } else { cicloSel.value = state.ciclo; }
  if(state.trimestre) trimestreSel.value = state.trimestre;

  areaSel.addEventListener('change', ()=>{ state.area = areaSel.value; loadCiclos(); renderAll(); save(); });
  cicloSel.addEventListener('change', ()=>{ state.ciclo = cicloSel.value; renderAll(); save(); });
  trimestreSel.addEventListener('change', ()=>{ state.trimestre = trimestreSel.value; renderAll(); save(); });

  $('btnExport').addEventListener('click', exportSelectedAllTrimestres);

  renderAll();
}

function loadCiclos(){
  const cicloSel = $('cicloSelect'); cicloSel.innerHTML='';
  const ciclos = Object.keys(state.data[state.area] || {});
  ciclos.forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = c; cicloSel.appendChild(opt); });
}

function ensureCritState(critId){
  if(!state.work[critId]) state.work[critId] = { selected: {}, indicadores: {} };
  ['1º Trimestre','2º Trimestre','3º Trimestre'].forEach(t => {
    if(typeof state.work[critId].selected[t] !== 'boolean') state.work[critId].selected[t] = false;
    if(!Array.isArray(state.work[critId].indicadores[t])) state.work[critId].indicadores[t] = [];
  });
}

function renderAll(){
  $('tituloBloque').textContent = `${state.area} · ${state.ciclo} · ${state.trimestre}`;
  renderCriterios();
}

function renderCriterios(){
  const cont = $('criteriosContainer'); cont.innerHTML = '';
  const ciclos = state.data[state.area]; if(!ciclos || !ciclos[state.ciclo]) return;
  const ces = ciclos[state.ciclo];

  Object.entries(ces).forEach(([ceKey, ceObj])=>{
    Object.entries(ceObj.criterios || {}).forEach(([critCode, critDesc])=>{
      const critId = `${ceKey}-${critCode}`;
      ensureCritState(critId);
      const selectedNow = !!state.work[critId].selected[state.trimestre];
      const indicadoresNow = state.work[critId].indicadores[state.trimestre] || [];

      const wrap = document.createElement('div');
      wrap.className = 'criterio';
      wrap.innerHTML = `
        <header>
          <div class="meta"><span class="badge">${ceKey}</span><strong>${critCode}</strong></div>
          <div style="flex:1">${esc(critDesc)}</div>
        </header>

        <div class="selector-tri">
          <label class="small">
            <input type="checkbox" ${selectedNow ? 'checked' : ''} /> Incluir en ${state.trimestre}
          </label>
        </div>
        <hr class="sep"/>

        <div class="grid" id="grid-${ceKey}-${critCode}"></div>

        <div class="row-actions no-print">
          <button class="add-row">Añadir fila</button>
        </div>
      `;

      const grid = wrap.querySelector(`#grid-${CSS.escape(ceKey)}-${CSS.escape(critCode)}`);
      paintSaved(grid, indicadoresNow);

      // eventos
      const chk = wrap.querySelector('input[type=checkbox]');
      chk.addEventListener('change', ()=>{ state.work[critId].selected[state.trimestre] = chk.checked; save(); });

      wrap.querySelector('.add-row').addEventListener('click', ()=>{ addRow(grid, null); collectGrid(grid, critId); });
      grid.addEventListener('click', (ev)=>{
        if(ev.target.classList.contains('del')){
          const row = ev.target.closest('.row'); if(row) row.remove();
          collectGrid(grid, critId);
        }
      });
      grid.addEventListener('change', ()=> collectGrid(grid, critId));
      grid.addEventListener('blur', ()=> collectGrid(grid, critId), true);

      cont.appendChild(wrap);
    });
  });
}

function addRow(grid, preset){
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `
    <input placeholder="Indicador de logro" value="${esc(preset?.indicador||'')}" />
    <input placeholder="Tarea" value="${esc(preset?.tarea||'')}" />
    <select>
      <option value="Rúbrica">Rúbrica</option>
      <option value="Lista de cotejo">Lista de cotejo</option>
      <option value="Escala estimativa">Escala estimativa</option>
      <option value="Prueba práctica">Prueba práctica</option>
    </select>
    <input type="number" min="0" max="10" step="0.5" placeholder="Ponderación" value="${preset?.peso ?? ''}" />
    <button class="del" title="Eliminar fila">×</button>
  `;
  if(preset?.instrumento){ row.querySelector('select').value = preset.instrumento; }
  grid.appendChild(row);
}

function paintSaved(grid, list){
  grid.innerHTML = '';
  if(!list || !list.length){ addRow(grid, null); return; }
  list.forEach(item => addRow(grid, item));
}

function collectGrid(grid, critId){
  const rows = grid.querySelectorAll('.row');
  const t = state.trimestre;
  const list = Array.from(rows).map(r => {
    const [ind,tarea,peso] = r.querySelectorAll('input');
    const inst = r.querySelector('select');
    return {
      indicador: (ind?.value||'').trim(),
      tarea: (tarea?.value||'').trim(),
      instrumento: inst?.value || '',
      peso: Number(peso?.value || 0)
    };
  }).filter(x => x.indicador || x.tarea);
  ensureCritState(critId);
  state.work[critId].indicadores[t] = list;
  save();
}

/** Exportar: SOLO criterios seleccionados de 1º, 2º y 3º trimestre (del área+ciclo actual) **/
function exportSelectedAllTrimestres(){
  const cont = $('printSelected');
  cont.innerHTML = '';
  const ciclos = state.data[state.area];
  if(!ciclos || !ciclos[state.ciclo]) return;
  const ces = ciclos[state.ciclo];

  // Cabecera
  const h = document.createElement('div');
  h.className = 'h-doc';
  const now = new Date().toLocaleDateString();
  h.innerHTML = `<h2 style="margin:0 0 6px;">${state.area} · ${state.ciclo}</h2>
                 <div class="small">Fecha: ${now}</div>`;
  cont.appendChild(h);

  const trimestres = ['1º Trimestre','2º Trimestre','3º Trimestre'];
  trimestres.forEach(tri => {
    // Recolectar seleccionados en este trimestre
    const seleccionados = [];
    Object.entries(ces).forEach(([ceKey, ceObj])=>{
      Object.entries(ceObj.criterios || {}).forEach(([critCode, critDesc])=>{
        const critId = `${ceKey}-${critCode}`;
        const st = state.work[critId];
        if(st && st.selected && st.selected[tri]){
          seleccionados.push({ ceKey, critCode, critDesc, indicadores: (st.indicadores?.[tri]||[]) });
        }
      });
    });

    if(!seleccionados.length) return; // no imprimimos esa sección si no hay nada

    const sec = document.createElement('section');
    sec.className = 'tri-block';
    sec.innerHTML = `<h3 class="h-tri">${tri}</h3>`;
    seleccionados.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="meta"><span class="badge">${item.ceKey}</span> <strong>${item.critCode}</strong></div>
        <div class="desc">${esc(item.critDesc)}</div>
        ${renderTablaIndicadores(item.indicadores)}
      `;
      sec.appendChild(card);
    });
    cont.appendChild(sec);
  });

  // Lanzar impresión (solo se mostrará printSelected por CSS)
  window.print();
}

function renderTablaIndicadores(list){
  if(!list || !list.length) return '<div class="small" style="margin-top:4px;">(Sin indicadores añadidos)</div>';
  const rows = list.map(i => `
    <tr>
      <td>${esc(i.indicador||'')}</td>
      <td>${esc(i.tarea||'')}</td>
      <td>${esc(i.instrumento||'')}</td>
      <td>${(i.peso ?? '')}</td>
    </tr>`).join('');
  return `<table class="tbl">
    <thead><tr><th>Indicador</th><th>Tarea</th><th>Instrumento</th><th>Peso</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

document.addEventListener('DOMContentLoaded', boot);
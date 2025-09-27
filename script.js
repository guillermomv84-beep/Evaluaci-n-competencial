const state = {
  data: null, area: null, ciclo: null, trimestre: "1º Trimestre", work: {}
};
const $ = (id)=> document.getElementById(id);
const esc = (s)=> (s||'').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));

async function boot(){
  const res = await fetch('evaluacion_competencial.json');
  state.data = await res.json();
  const areaSel = $('areaSelect'), cicloSel = $('cicloSelect'), trimestreSel = $('trimestreSelect');
  Object.keys(state.data).forEach(area => { const o=document.createElement('option'); o.value=area;o.textContent=area; areaSel.appendChild(o); });
  areaSel.addEventListener('change', ()=>{ state.area=areaSel.value; loadCiclos(); renderCE(); renderCriterios(); });
  cicloSel.addEventListener('change', ()=>{ state.ciclo=cicloSel.value; renderCE(); renderCriterios(); });
  trimestreSel.addEventListener('change', ()=>{ state.trimestre=trimestreSel.value; renderCriterios(); });
  document.getElementById('btnExport').addEventListener('click', ()=> window.print());
  areaSel.selectedIndex=0; state.area=areaSel.value; loadCiclos(); cicloSel.selectedIndex=0; state.ciclo=cicloSel.value; renderCE(); renderCriterios();
}
function loadCiclos(){
  const cicloSel = $('cicloSelect'); cicloSel.innerHTML='';
  Object.keys(state.data[state.area]||{}).forEach(c => { const o=document.createElement('option'); o.value=c;o.textContent=c; cicloSel.appendChild(o); });
}
function renderCE(){
  const ceList = $('ceList'); ceList.innerHTML='';
  const ciclos = state.data[state.area]; if(!ciclos || !ciclos[state.ciclo]) return;
  const ces = ciclos[state.ciclo];
  Object.entries(ces).forEach(([ceKey, ceObj])=>{
    const div=document.createElement('div'); div.className='ce-item';
    div.innerHTML = `<h3>${ceKey}</h3><p class="muted">${esc(ceObj.descripcion||'')}</p>`; ceList.appendChild(div);
  });
  $('tituloBloque').textContent = `${state.area} · ${state.ciclo} · ${state.trimestre}`;
}
function renderCriterios(){
  const cont = $('criteriosContainer'); cont.innerHTML='';
  const ciclos = state.data[state.area]; if(!ciclos || !ciclos[state.ciclo]) return;
  const ces = ciclos[state.ciclo];
  Object.entries(ces).forEach(([ceKey, ceObj])=>{
    Object.entries(ceObj.criterios||{}).forEach(([critCode, critDesc])=>{
      const critId = `${ceKey}-${critCode}`; if(!state.work[critId]) state.work[critId]={trimestre:state.trimestre, indicadores:[]};
      const wrap = document.createElement('div'); wrap.className='criterio';
      wrap.innerHTML = `
        <header>
          <div class="meta"><span class="badge">${ceKey}</span><strong>${critCode}</strong></div>
          <div>${esc(critDesc)}</div>
        </header>
        <hr class="sep"/>
        <div class="grid-indicadores" id="grid-${critId}">
          <input placeholder="Indicador de logro" />
          <input placeholder="Tarea" />
          <select>
            <option value="Rúbrica">Rúbrica</option>
            <option value="Lista de cotejo">Lista de cotejo</option>
            <option value="Escala estimativa">Escala estimativa</option>
            <option value="Prueba práctica">Prueba práctica</option>
          </select>
          <input type="number" min="0" max="10" step="0.5" placeholder="Ponderación" />
          <button class="del" title="Eliminar fila">×</button>
        </div>
        <button class="add-row no-print">Añadir indicador</button>`;
      const grid = wrap.querySelector(`#grid-${CSS.escape(critId)}`);
      wrap.querySelector('.add-row').addEventListener('click', ()=> addRow(grid, critId));
      grid.addEventListener('change', ()=> collectGrid(grid, critId));
      grid.addEventListener('blur', ()=> collectGrid(grid, critId), true);
      grid.querySelector('.del').addEventListener('click', (ev)=>{
        const row = ev.target.closest('.grid-indicadores');
        row.querySelectorAll('input').forEach(i=> i.value=''); row.querySelector('select').selectedIndex=0; collectGrid(grid, critId);
      });
      paintSaved(grid, state.work[critId].indicadores);
      cont.appendChild(wrap);
    });
  });
}
function addRow(grid, critId){
  const row=document.createElement('div'); row.className='grid-indicadores';
  row.innerHTML=`
    <input placeholder="Indicador de logro" />
    <input placeholder="Tarea" />
    <select>
      <option value="Rúbrica">Rúbrica</option>
      <option value="Lista de cotejo">Lista de cotejo</option>
      <option value="Escala estimativa">Escala estimativa</option>
      <option value="Prueba práctica">Prueba práctica</option>
    </select>
    <input type="number" min="0" max="10" step="0.5" placeholder="Ponderación" />
    <button class="del" title="Eliminar fila">×</button>`;
  row.querySelector('.del').addEventListener('click', ()=>{ row.remove(); collectGrid(grid, critId); });
  grid.parentElement.insertBefore(row, grid.nextSibling);
}
function collectGrid(mainGrid, critId){
  const rows = mainGrid.parentElement.querySelectorAll('.grid-indicadores');
  const indicadores = Array.from(rows).map(r=>{
    const [ind,tarea,peso]=r.querySelectorAll('input'); const inst=r.querySelector('select');
    return { indicador:(ind?.value||'').trim(), tarea:(tarea?.value||'').trim(), instrumento:inst?.value||'', peso:Number(peso?.value||0) };
  }).filter(x=> x.indicador || x.tarea);
  state.work[critId] = state.work[critId] || { trimestre: state.trimestre, indicadores: [] };
  state.work[critId].trimestre = state.trimestre;
  state.work[critId].indicadores = indicadores;
}
function paintSaved(grid, list){
  if(!list || !list.length) return;
  const [ind,tarea,peso]=grid.querySelectorAll('input'); const inst=grid.querySelector('select');
  const first=list[0]; if(first){ ind.value=first.indicador||''; tarea.value=first.tarea||''; inst.value=first.instrumento||'Rúbrica'; peso.value=first.peso??''; }
  for(let i=1;i<list.length;i++){
    const row=document.createElement('div'); row.className='grid-indicadores';
    row.innerHTML=`
      <input placeholder="Indicador de logro" value="${esc(list[i].indicador||'')}" />
      <input placeholder="Tarea" value="${esc(list[i].tarea||'')}" />
      <select>
        <option value="Rúbrica">Rúbrica</option>
        <option value="Lista de cotejo">Lista de cotejo</option>
        <option value="Escala estimativa">Escala estimativa</option>
        <option value="Prueba práctica">Prueba práctica</option>
      </select>
      <input type="number" min="0" max="10" step="0.5" placeholder="Ponderación" value="${list[i].peso??''}" />
      <button class="del" title="Eliminar fila">×</button>`;
    row.querySelector('select').value=list[i].instrumento||'Rúbrica';
    row.querySelector('.del').addEventListener('click', ()=>{ row.remove(); collectGrid(grid, `${grid.id.slice(5)}`); });
    grid.parentElement.insertBefore(row, grid.nextSibling);
  }
}
document.addEventListener('DOMContentLoaded', boot);
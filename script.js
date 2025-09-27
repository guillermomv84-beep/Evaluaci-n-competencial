const state = {
  data: null,
  area: null,
  ciclo: null,
  trimestre: "1º Trimestre",
  work: {} // { criterioId: { trimestre, indicadores:[{indicador,tarea,instrumento,peso}] } }
};

function byId(id){ return document.getElementById(id); }

async function boot(){
  const res = await fetch('evaluacion_competencial.json');
  state.data = await res.json();

  const areaSel = byId('areaSelect');
  const cicloSel = byId('cicloSelect');
  const trimestreSel = byId('trimestreSelect');

  // Areas
  Object.keys(state.data).forEach(area => {
    const opt = document.createElement('option');
    opt.value = area; opt.textContent = area;
    areaSel.appendChild(opt);
  });

  areaSel.addEventListener('change', ()=>{
    state.area = areaSel.value;
    loadCiclos();
    renderCE();
    renderCriterios();
  });

  cicloSel.addEventListener('change', ()=>{
    state.ciclo = cicloSel.value;
    renderCE();
    renderCriterios();
  });

  trimestreSel.addEventListener('change', ()=>{
    state.trimestre = trimestreSel.value;
    renderCriterios();
  });

  byId('btnExport').addEventListener('click', exportPDF);

  // init defaults
  areaSel.selectedIndex = 0;
  state.area = areaSel.value;
  loadCiclos();
  cicloSel.selectedIndex = 0;
  state.ciclo = cicloSel.value;
  renderCE();
  renderCriterios();
}

function loadCiclos(){
  const cicloSel = byId('cicloSelect');
  cicloSel.innerHTML='';
  const ciclos = Object.keys(state.data[state.area] || {});
  ciclos.forEach(c => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = c;
    cicloSel.appendChild(opt);
  });
}

function renderCE(){
  const ceList = byId('ceList'); ceList.innerHTML = '';
  const ciclos = state.data[state.area];
  if(!ciclos || !ciclos[state.ciclo]) return;
  const ces = ciclos[state.ciclo];
  Object.entries(ces).forEach(([ceKey, ceObj])=>{
    const div = document.createElement('div');
    div.className = 'ce-item';
    div.innerHTML = `<h3>${ceKey}</h3><p class="muted">${escapeHtml(ceObj.descripcion||'')}</p>`;
    ceList.appendChild(div);
  });
}

function renderCriterios(){
  const cont = byId('criteriosContainer');
  cont.innerHTML = '';
  const ciclos = state.data[state.area];
  if(!ciclos || !ciclos[state.ciclo]) return;
  const ces = ciclos[state.ciclo];

  // Mostrar TODOS los criterios del curso (no solo los del trimestre)
  Object.entries(ces).forEach(([ceKey, ceObj])=>{
    Object.entries(ceObj.criterios || {}).forEach(([critCode, critDesc])=>{
      const critId = `${ceKey}-${critCode}`;

      // bloque
      const wrap = document.createElement('div');
      wrap.className = 'criterio';
      wrap.innerHTML = `
        <header>
          <div class="meta">
            <span class="badge">${ceKey}</span>
            <strong>${critCode}</strong>
          </div>
          <div>${escapeHtml(critDesc)}</div>
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
        <button class="add-row">Añadir indicador</button>
      `;

      // estado inicial si no existe
      if(!state.work[critId]){
        state.work[critId] = { trimestre: state.trimestre, indicadores: [] };
      } else {
        // no pisar trimestre si ya lo eligió
      }

      // añadir fila/gestión
      const grid = wrap.querySelector(`#grid-${cssId(critId)}`) || wrap.querySelector(`#grid-${critId}`);
      const addBtn = wrap.querySelector('.add-row');
      addBtn.addEventListener('click', ()=>{
        addRow(grid, critId);
      });

      // botón eliminar de la primera fila (vacía) => borra esa fila de inputs
      const firstDel = grid.querySelector('.del');
      firstDel.addEventListener('click', (ev)=>{
        const row = ev.target.closest('.grid-indicadores');
        // limpiar inputs
        const inputs = row.querySelectorAll('input');
        inputs.forEach(i=> i.value='');
        const sel = row.querySelector('select'); if(sel) sel.selectedIndex = 0;
      });

      // guardar cambios al blur/change
      grid.addEventListener('change', ()=> collectGrid(grid, critId));
      grid.addEventListener('blur', ()=> collectGrid(grid, critId), true);

      // Pintar indicadores ya guardados (si había)
      paintSaved(grid, state.work[critId].indicadores);

      cont.appendChild(wrap);
    });
  });
}

function addRow(grid, critId){
  const row = document.createElement('div');
  row.className = 'grid-indicadores';
  row.innerHTML = `
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
  `;
  row.querySelector('.del').addEventListener('click', ()=>{
    row.remove();
    collectGrid(grid, critId);
  });
  grid.parentElement.insertBefore(row, grid.nextSibling);
}

function collectGrid(gridOrRow, critId){
  // recopila todas las filas grid-indicadores hermanas a partir del bloque principal + añadidas
  const parent = gridOrRow.parentElement;
  const rows = [gridOrRow, ...parent.querySelectorAll('.grid-indicadores:not(#'+gridOrRow.id+')')];
  const indicadores = rows.map(r => {
    const [ind,tarea,peso] = r.querySelectorAll('input');
    const inst = r.querySelector('select');
    return {
      indicador: ind?.value?.trim() || "",
      tarea: tarea?.value?.trim() || "",
      instrumento: inst?.value || "",
      peso: Number(peso?.value || 0)
    };
  }).filter(x => x.indicador || x.tarea); // filtra filas totalmente vacías

  state.work[critId] = state.work[critId] || { trimestre: state.trimestre, indicadores: [] };
  state.work[critId].trimestre = state.trimestre; // asignación de trimestre actual
  state.work[critId].indicadores = indicadores;
}

function paintSaved(grid, indicadores){
  if(!indicadores || !indicadores.length) return;
  // primera fila existe: rellenarla con el primero
  const [ind,tarea,peso] = grid.querySelectorAll('input');
  const inst = grid.querySelector('select');
  const first = indicadores[0];
  if(first){
    ind.value = first.indicador || "";
    tarea.value = first.tarea || "";
    inst.value = first.instrumento || "Rúbrica";
    peso.value = first.peso ?? "";
  }
  // resto de filas
  for(let i=1;i<indicadores.length;i++){
    const row = document.createElement('div');
    row.className = 'grid-indicadores';
    row.innerHTML = `
      <input placeholder="Indicador de logro" value="${escapeAttr(indicadores[i].indicador||"")}" />
      <input placeholder="Tarea" value="${escapeAttr(indicadores[i].tarea||"")}" />
      <select>
        <option value="Rúbrica">Rúbrica</option>
        <option value="Lista de cotejo">Lista de cotejo</option>
        <option value="Escala estimativa">Escala estimativa</option>
        <option value="Prueba práctica">Prueba práctica</option>
      </select>
      <input type="number" min="0" max="10" step="0.5" placeholder="Ponderación" value="${indicadores[i].peso ?? ""}" />
      <button class="del" title="Eliminar fila">×</button>
    `;
    row.querySelector('select').value = indicadores[i].instrumento || "Rúbrica";
    row.querySelector('.del').addEventListener('click', ()=>{
      row.remove();
      collectGrid(grid, findCritIdFromGrid(grid));
    });
    grid.parentElement.insertBefore(row, grid.nextSibling);
  }
}

function findCritIdFromGrid(grid){
  // critId está en el id del grid (grid-CE?-X.Y)
  const id = grid.id || "";
  return id.startsWith("grid-") ? id.substring(5) : id;
}

function exportPDF(){
  const app = document.getElementById('app');
  // Intentar con html2pdf si está disponible, si no, usar print()
  if(window.html2pdf){
    const opt = { margin: 10, filename: 'evaluacion_competencial.pdf' };
    window.html2pdf().from(app).set(opt).save();
  } else {
    // fallback
    window.print();
  }
}

function escapeHtml(s){ return (s||"").replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }
function cssId(s){ return s.replace(/[^a-zA-Z0-9_-]/g, '_'); }

document.addEventListener('DOMContentLoaded', boot);
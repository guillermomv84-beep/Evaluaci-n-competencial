const state = {
  data: [],
  selectedCourse: "",
  selectedArea: "",
  selectedTrimester: "",
  selectedCompetencia: null,
  planning: { criterios: {} },
  customCounter: 0,
  listenersAttached: false,
  planSummaryElement: null
};

const selectors = {
  course: null,
  area: null,
  trimester: null,
  competencia: null
};

let summaryBox = null;
let overviewPanel = null;
let detailsPanel = null;
let exportBtn = null;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}

function initializeApp() {
  selectors.course = document.getElementById("courseSelect");
  selectors.area = document.getElementById("areaSelect");
  selectors.trimester = document.getElementById("trimesterSelect");
  selectors.competencia = document.getElementById("competenciaSelect");
  summaryBox = document.getElementById("selectionSummary");
  overviewPanel = document.getElementById("competenciasOverview");
  detailsPanel = document.getElementById("competenciaDetails");
  exportBtn = document.getElementById("exportPdf");

  if (
    !selectors.course ||
    !selectors.area ||
    !selectors.trimester ||
    !selectors.competencia ||
    !summaryBox ||
    !overviewPanel ||
    !detailsPanel ||
    !exportBtn
  ) {
    console.error("No se pudieron localizar los elementos principales de la interfaz.");
    return;
  }

  resetSelectors();
  loadData();
}

function loadData() {
  summaryBox.innerHTML = `<p class="info-text">Cargando datos curriculares...</p>`;
  detailsPanel.innerHTML = `<div class="info-text">Cargando la información del decreto para el área seleccionada.</div>`;

  fetch("data.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("No se pudo cargar el archivo data.json");
      }
      return response.json();
    })
    .then((data) => {
      const areas = Array.isArray(data?.areas) ? data.areas : [];
      if (!areas.length) {
        throw new Error("El archivo data.json no contiene áreas registradas.");
      }
      applyDataset(areas);
    })
    .catch((error) => {
      showDataLoadError(error);
    });
}

function applyDataset(areas) {
  state.data = areas;
  initializeSelectors();
}

function initializeSelectors() {
  resetSelectors();
  populateCourses();
  if (!state.listenersAttached) {
    selectors.course.addEventListener("change", handleCourseChange);
    selectors.area.addEventListener("change", handleAreaChange);
    selectors.trimester.addEventListener("change", handleTrimesterChange);
    selectors.competencia.addEventListener("change", handleCompetenciaChange);
    exportBtn.addEventListener("click", handleExportToPdf);
    state.listenersAttached = true;
  }
  renderCompetencia();
  updateSelectionSummary();
  updateCompetenciasOverview();
}

function resetSelectors() {
  state.selectedCourse = "";
  state.selectedArea = "";
  state.selectedTrimester = "";
  state.selectedCompetencia = null;
  resetPlanning();
  selectors.course.innerHTML = `<option value="">Selecciona un curso...</option>`;
  selectors.course.disabled = true;
  selectors.area.innerHTML = `<option value="">Selecciona un área...</option>`;
  selectors.area.disabled = true;
  selectors.trimester.innerHTML = `<option value="">Selecciona un trimestre...</option>`;
  selectors.trimester.disabled = true;
  selectors.competencia.innerHTML = `<option value="">Selecciona una competencia específica...</option>`;
  selectors.competencia.disabled = true;
  toggleExport(false);
  if (overviewPanel) {
    overviewPanel.innerHTML = `<p class="info-text">Selecciona un curso y un área para revisar las competencias disponibles por trimestre.</p>`;
  }
}

function showDataLoadError(error, options = {}) {
  const { allowRetry = true, manualOnly = false } = options;
  console.error(error);
  state.data = [];
  resetSelectors();
  detailsPanel.innerHTML = `<div class="info-text">Carga el archivo curricular para comenzar a planificar.</div>`;

  const container = document.createElement("div");
  container.className = "data-error";

  const message = document.createElement("p");
  const detail = error && error.message ? ` <span class="error-detail">(${error.message})</span>` : "";
  message.innerHTML = manualOnly
    ? `No se pudo interpretar el archivo JSON seleccionado.${detail}`
    : `No se pudo cargar automáticamente el archivo <strong>data.json</strong>.${detail}`;
  container.appendChild(message);

  const help = document.createElement("p");
  help.className = "info-text";
  help.innerHTML = manualOnly
    ? "Comprueba que el archivo mantiene la estructura de <strong>data.json</strong> e inténtalo de nuevo."
    : "Si abres la herramienta directamente desde tu equipo (ruta <code>file://</code>), el navegador bloquea la lectura automática. Selecciona el archivo manualmente para continuar.";
  container.appendChild(help);

  const actions = document.createElement("div");
  actions.className = "data-error-actions";

  if (allowRetry) {
    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "btn btn-outline";
    retryBtn.textContent = "Reintentar carga";
    retryBtn.addEventListener("click", () => loadData());
    actions.appendChild(retryBtn);
  }

  const fileLabel = document.createElement("label");
  fileLabel.className = "btn btn-primary file-input-label";
  fileLabel.textContent = "Seleccionar data.json";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/json";
  fileInput.addEventListener("change", handleManualFileLoad);
  fileLabel.appendChild(fileInput);
  actions.appendChild(fileLabel);

  container.appendChild(actions);

  summaryBox.innerHTML = "";
  summaryBox.appendChild(container);
}

function handleManualFileLoad(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    try {
      const text = loadEvent.target?.result;
      const parsed = JSON.parse(text);
      const areas = Array.isArray(parsed?.areas) ? parsed.areas : [];
      if (!areas.length) {
        throw new Error("El archivo no contiene el nodo \"areas\" con información válida.");
      }
      applyDataset(areas);
    } catch (err) {
      showDataLoadError(err, { allowRetry: false, manualOnly: true });
    }
  };

  reader.onerror = () => {
    showDataLoadError(new Error("No se pudo leer el archivo seleccionado."), {
      allowRetry: false,
      manualOnly: true
    });
  };

  reader.readAsText(file);
  input.value = "";
}

function populateCourses() {
  const courseSet = new Set();
  state.data.forEach((area) => {
    (area.cursos || []).forEach((course) => courseSet.add(course.curso));
  });
  const courses = Array.from(courseSet).sort((a, b) => courseOrder(a) - courseOrder(b));
  if (!courses.length) {
    selectors.course.innerHTML = `<option value="">No hay cursos disponibles</option>`;
    selectors.course.disabled = true;
    return;
  }

  selectors.course.innerHTML = `<option value="">Selecciona un curso...</option>`;
  selectors.course.disabled = false;
  courses.forEach((course) => {
    const option = document.createElement("option");
    option.value = course;
    option.textContent = course;
    selectors.course.append(option);
  });
}

function courseOrder(course) {
  const match = /\d+/.exec(course);
  return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

function handleCourseChange() {
  state.selectedCourse = selectors.course.value;
  state.selectedArea = "";
  state.selectedTrimester = "";
  state.selectedCompetencia = null;
  resetPlanning();
  updateAreaOptions();
  updateTrimesterOptions();
  updateCompetenciaOptions();
  renderCompetencia();
  updateSelectionSummary();
  toggleExport(false);
  updateCompetenciasOverview();
}

function updateAreaOptions() {
  selectors.area.innerHTML = `<option value="">Selecciona un área...</option>`;
  selectors.area.disabled = !state.selectedCourse;
  if (!state.selectedCourse) {
    return;
  }
  const areas = state.data.filter((area) =>
    (area.cursos || []).some((course) => course.curso === state.selectedCourse)
  );
  areas.forEach((area) => {
    const option = document.createElement("option");
    option.value = area.nombre;
    option.textContent = area.nombre;
    selectors.area.append(option);
  });
  if (!areas.length) {
    selectors.area.disabled = true;
    summaryBox.innerHTML = `<p class="info-text">No hay áreas registradas para ${state.selectedCourse}. Revisa el archivo <strong>data.json</strong>.</p>`;
  }
}

function handleAreaChange() {
  state.selectedArea = selectors.area.value;
  state.selectedTrimester = "";
  state.selectedCompetencia = null;
  resetPlanning();
  updateTrimesterOptions();
  updateCompetenciaOptions();
  renderCompetencia();
  updateSelectionSummary();
  toggleExport(false);
  updateCompetenciasOverview();
}

function updateTrimesterOptions() {
  selectors.trimester.innerHTML = `<option value="">Selecciona un trimestre...</option>`;
  selectors.trimester.disabled = !(state.selectedCourse && state.selectedArea);
  if (!state.selectedCourse || !state.selectedArea) {
    return;
  }
  const courseData = getSelectedCourseData();
  if (!courseData) {
    return;
  }
  const trimesterSet = new Set();
  courseData.competencias.forEach((competencia) => {
    if (competencia.trimestre) {
      trimesterSet.add(competencia.trimestre);
    }
  });
  const trimesters = Array.from(trimesterSet).sort((a, b) => trimesterOrder(a) - trimesterOrder(b));
  trimesters.forEach((trimester) => {
    const option = document.createElement("option");
    option.value = trimester;
    option.textContent = trimester;
    selectors.trimester.append(option);
  });
  selectors.trimester.disabled = !trimesters.length;
}

function trimesterOrder(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const match = /\d+/.exec(value);
  return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

function handleTrimesterChange() {
  state.selectedTrimester = selectors.trimester.value;
  state.selectedCompetencia = null;
  resetPlanning();
  updateCompetenciaOptions();
  renderCompetencia();
  updateSelectionSummary();
  toggleExport(false);
  updateCompetenciasOverview();
}

function updateCompetenciaOptions() {
  const needsTrimester = !state.selectedTrimester;
  const showAllCompetencias = !needsTrimester && trimesterOrder(state.selectedTrimester) === 1;
  const placeholder = needsTrimester
    ? "Selecciona un trimestre para ver sus competencias..."
    : showAllCompetencias
    ? "Selecciona una competencia específica de cualquier trimestre..."
    : "Selecciona una competencia específica...";
  selectors.competencia.innerHTML = `<option value="">${placeholder}</option>`;
  selectors.competencia.disabled = true;

  if (!state.selectedCourse || !state.selectedArea) {
    return;
  }

  const courseData = getSelectedCourseData();
  if (!courseData || !Array.isArray(courseData.competencias)) {
    return;
  }

  if (needsTrimester) {
    return;
  }

  const competencias = courseData.competencias
    .filter((competencia) =>
      showAllCompetencias ? true : competencia.trimestre === state.selectedTrimester
    )
    .sort((a, b) => {
      const trimesterDiff = trimesterOrder(a.trimestre) - trimesterOrder(b.trimestre);
      if (trimesterDiff !== 0) return trimesterDiff;
      return a.codigo.localeCompare(b.codigo, "es", { numeric: true, sensitivity: "base" });
    });

  if (!competencias.length) {
    const option = document.createElement("option");
    option.value = "";
    option.disabled = true;
    option.textContent = "No hay competencias disponibles en este trimestre";
    selectors.competencia.append(option);
    return;
  }

  competencias.forEach((competencia) => {
    const option = document.createElement("option");
    option.value = `${competencia.codigo}::${competencia.trimestre}`;
    const prefix = showAllCompetencias
      ? `${competencia.trimestre || "-"} · ${competencia.codigo}`
      : competencia.codigo;
    option.textContent = `${prefix} · ${competencia.titulo}`;
    option.dataset.trimestre = competencia.trimestre;
    selectors.competencia.append(option);
  });

  selectors.competencia.disabled = false;
}

function handleCompetenciaChange() {
  const rawValue = selectors.competencia.value;
  const courseData = getSelectedCourseData();
  if (!rawValue || !courseData) {
    state.selectedCompetencia = null;
    resetPlanning();
    renderCompetencia();
    updateSelectionSummary();
    toggleExport(false);
    updateCompetenciasOverview();
    return;
  }
  const [code, encodedTrimester] = rawValue.split("::");
  const selectedOption = selectors.competencia.selectedOptions[0];
  const trimesterFromOption = selectedOption?.dataset.trimestre || encodedTrimester || state.selectedTrimester;
  const competencia = courseData.competencias.find(
    (item) => item.codigo === code && item.trimestre === trimesterFromOption
  );
  if (competencia && trimesterFromOption && trimesterFromOption !== state.selectedTrimester) {
    state.selectedTrimester = trimesterFromOption;
    if (selectors.trimester.value !== trimesterFromOption) {
      selectors.trimester.value = trimesterFromOption;
    }
  }
  state.selectedCompetencia = competencia || null;
  resetPlanning();
  renderCompetencia();
  updateSelectionSummary();
  toggleExport(Boolean(state.selectedCompetencia));
  updateCompetenciasOverview();
}

function getSelectedCourseData() {
  const area = state.data.find((item) => item.nombre === state.selectedArea);
  if (!area) return null;
  return (area.cursos || []).find((course) => course.curso === state.selectedCourse) || null;
}

function updateSelectionSummary() {
  if (!state.selectedCourse) {
    summaryBox.innerHTML = `<p class="info-text">Selecciona un curso para iniciar tu planificación.</p>`;
    return;
  }
  const rows = [];
  rows.push(`<span><strong>Curso:</strong> ${state.selectedCourse || "-"}</span>`);
  rows.push(`<span><strong>Área:</strong> ${state.selectedArea || "-"}</span>`);
  const trimesterLabel = state.selectedCompetencia?.trimestre || state.selectedTrimester || "-";
  rows.push(`<span><strong>Trimestre:</strong> ${trimesterLabel}</span>`);
  rows.push(
    `<span><strong>Competencia específica:</strong> ${state.selectedCompetencia ? `${state.selectedCompetencia.codigo} · ${state.selectedCompetencia.titulo}` : "-"}</span>`
  );
  summaryBox.innerHTML = rows.map((row) => `<div>${row}</div>`).join("");
}

function updateCompetenciasOverview() {
  if (!overviewPanel) {
    return;
  }

  overviewPanel.innerHTML = "";

  if (!state.selectedCourse) {
    overviewPanel.innerHTML = `<p class="info-text">Selecciona un curso para consultar las competencias específicas disponibles.</p>`;
    return;
  }

  if (!state.selectedArea) {
    overviewPanel.innerHTML = `<p class="info-text">Elige un área para listar las competencias específicas de cada trimestre.</p>`;
    return;
  }

  const courseData = getSelectedCourseData();
  if (!courseData || !Array.isArray(courseData.competencias) || !courseData.competencias.length) {
    overviewPanel.innerHTML = `<p class="info-text">No hay competencias registradas para esta combinación en el archivo <strong>data.json</strong>.</p>`;
    return;
  }

  const heading = document.createElement("h3");
  heading.className = "overview-title";
  heading.textContent = "Competencias específicas por trimestre";
  overviewPanel.appendChild(heading);

  const groups = new Map();
  courseData.competencias.forEach((competencia) => {
    const trimester = competencia.trimestre || "Sin trimestre definido";
    if (!groups.has(trimester)) {
      groups.set(trimester, []);
    }
    groups.get(trimester).push(competencia);
  });

  const selectedTrimester = state.selectedCompetencia?.trimestre || state.selectedTrimester;

  Array.from(groups.entries())
    .sort((a, b) => trimesterOrder(a[0]) - trimesterOrder(b[0]))
    .forEach(([trimester, competencias]) => {
      const section = document.createElement("section");
      section.className = "competencias-trimestre";
      if (trimester === selectedTrimester) {
        section.classList.add("active");
      }

      const trimesterHeading = document.createElement("h4");
      trimesterHeading.textContent = trimester;
      section.appendChild(trimesterHeading);

      const list = document.createElement("div");
      list.className = "competencias-grid";

      competencias
        .slice()
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true, sensitivity: "base" }))
        .forEach((competencia) => {
          const card = document.createElement("article");
          card.className = "competencia-resumen";

          const code = document.createElement("span");
          code.className = "competencia-resumen-codigo";
          code.textContent = competencia.codigo;

          const title = document.createElement("h5");
          title.className = "competencia-resumen-titulo";
          title.textContent = competencia.titulo;

          const description = document.createElement("p");
          description.className = "competencia-resumen-descripcion";
          description.textContent = competencia.descripcion;

          card.append(code, title, description);
          list.appendChild(card);
        });

      section.appendChild(list);
      overviewPanel.appendChild(section);
    });
}

function renderCompetencia() {
  detailsPanel.innerHTML = "";
  if (!state.selectedCompetencia) {
    detailsPanel.innerHTML = `<div class="info-text">Selecciona una competencia específica para visualizar sus criterios de evaluación y planificar tus indicadores.</div>`;
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "pdf-export";

  const header = document.createElement("div");
  header.className = "competencia-header";

  const title = document.createElement("h2");
  title.textContent = `${state.selectedCompetencia.codigo} · ${state.selectedCompetencia.titulo}`;
  header.appendChild(title);

  const description = document.createElement("p");
  description.className = "info-text";
  description.textContent = state.selectedCompetencia.descripcion;
  header.appendChild(description);

  const meta = document.createElement("div");
  meta.className = "competencia-meta";
  meta.innerHTML = `
    <span class="meta-tag">Curso ${state.selectedCourse}</span>
    <span class="meta-tag">${state.selectedArea}</span>
    <span class="meta-tag">${state.selectedCompetencia?.trimestre || state.selectedTrimester}</span>
  `;
  header.appendChild(meta);
  wrapper.appendChild(header);

  const criteriaContainer = document.createElement("div");
  criteriaContainer.className = "criteria-container";

  (state.selectedCompetencia.criterios || []).forEach((criterio) => {
    const id = buildCriterionId(state.selectedCompetencia.codigo, criterio.codigo);
    const card = createCriterionCard(criterio, { id, editable: false });
    criteriaContainer.appendChild(card);
  });

  const customInfo = document.createElement("p");
  customInfo.className = "info-text";
  customInfo.textContent = "¿Necesitas añadir un criterio propio o ampliar los existentes? Puedes crear tantos criterios personalizados como requieras.";

  const addCustomBtn = document.createElement("button");
  addCustomBtn.type = "button";
  addCustomBtn.className = "btn btn-outline";
  addCustomBtn.textContent = "Añadir criterio personalizado";
  addCustomBtn.addEventListener("click", () => addCustomCriterion(criteriaContainer));

  wrapper.appendChild(criteriaContainer);
  wrapper.appendChild(customInfo);
  wrapper.appendChild(addCustomBtn);

  const summarySection = document.createElement("section");
  summarySection.className = "plan-summary";
  state.planSummaryElement = summarySection;

  wrapper.appendChild(summarySection);

  updatePlanSummary();

  detailsPanel.appendChild(wrapper);
}

function resetPlanning() {
  state.planning = { criterios: {} };
  state.customCounter = 0;
  if (state.planSummaryElement) {
    state.planSummaryElement.innerHTML = "";
  }
  state.planSummaryElement = null;
}

function buildCriterionId(competenciaCode, criterioCode) {
  const trimester = state.selectedCompetencia?.trimestre || state.selectedTrimester;
  return `${state.selectedArea}__${state.selectedCourse}__${trimester}__${competenciaCode}__${criterioCode}`;
}

function getOrCreatePlanEntry(id, criterio, editable) {
  if (!state.planning.criterios[id]) {
    state.planning.criterios[id] = {
      id,
      codigo: editable ? "" : criterio.codigo || "",
      descripcion: editable ? "" : criterio.descripcion || "",
      saberesBasicos: editable ? [] : [...(criterio.saberesBasicos || [])],
      competenciasClave: editable ? [] : [...(criterio.competenciasClave || [])],
      origen: editable ? "personalizado" : "decreto",
      area: state.selectedArea,
      curso: state.selectedCourse,
      trimestre: state.selectedCompetencia?.trimestre || state.selectedTrimester,
      competencia: state.selectedCompetencia?.codigo || "",
      competenciaTitulo: state.selectedCompetencia?.titulo || "",
      indicadores: []
    };
  } else {
    const entry = state.planning.criterios[id];
    entry.area = state.selectedArea;
    entry.curso = state.selectedCourse;
    entry.trimestre = state.selectedCompetencia?.trimestre || state.selectedTrimester;
    entry.competencia = state.selectedCompetencia?.codigo || entry.competencia;
    entry.competenciaTitulo = state.selectedCompetencia?.titulo || entry.competenciaTitulo;
  }
  return state.planning.criterios[id];
}

function createCriterionCard(criterio, options) {
  const { id, editable } = options;
  const card = document.createElement("article");
  card.className = "criterion-card";
  if (editable) {
    card.classList.add("custom");
  }

  const entry = getOrCreatePlanEntry(id, criterio, editable);

  const header = document.createElement("div");
  header.className = "criterion-header";

  const title = document.createElement("h3");
  title.className = "criterion-title";
  title.textContent = editable
    ? entry.codigo
      ? `Criterio ${entry.codigo}`
      : "Criterio personalizado"
    : `Criterio ${criterio.codigo}`;

  header.appendChild(title);

  const saberesList = document.createElement("div");
  saberesList.className = "tag-list";

  const competenciasList = document.createElement("div");
  competenciasList.className = "tag-list";

  if (editable) {
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "small-btn danger";
    removeBtn.textContent = "Eliminar";
    removeBtn.addEventListener("click", () => {
      delete state.planning.criterios[id];
      card.remove();
    });
    header.appendChild(removeBtn);
  }

  card.appendChild(header);

  const description = document.createElement(editable ? "textarea" : "p");
  description.className = editable ? "custom-field" : "criterion-description";
  description.placeholder = editable ? "Describe el criterio personalizado" : "";
  description.value = editable ? entry.descripcion : undefined;
  if (!editable) {
    description.textContent = criterio.descripcion;
  }
  if (editable) {
    description.addEventListener("input", (event) => {
      entry.descripcion = event.target.value;
    });
  }
  card.appendChild(description);

  if (editable) {
    const codeInput = document.createElement("input");
    codeInput.type = "text";
    codeInput.className = "custom-field";
    codeInput.placeholder = "Código del criterio";
    codeInput.value = entry.codigo;
    codeInput.addEventListener("input", (event) => {
      entry.codigo = event.target.value;
      title.textContent = event.target.value
        ? `Criterio ${event.target.value}`
        : "Criterio personalizado";
    });
    card.insertBefore(codeInput, description);

    const saberesArea = document.createElement("textarea");
    saberesArea.className = "custom-field";
    saberesArea.placeholder = "Saberes básicos asociados (separados por comas o saltos de línea)";
    saberesArea.value = entry.saberesBasicos.join("\n");
    saberesArea.addEventListener("input", (event) => {
      entry.saberesBasicos = parseList(event.target.value);
      renderTagList(saberesList, entry.saberesBasicos, "tag tag-saber");
    });

    const competenciasArea = document.createElement("textarea");
    competenciasArea.className = "custom-field";
    competenciasArea.placeholder = "Competencias clave vinculadas (separadas por comas o saltos de línea)";
    competenciasArea.value = entry.competenciasClave.join("\n");
    competenciasArea.addEventListener("input", (event) => {
      entry.competenciasClave = parseList(event.target.value);
      renderTagList(competenciasList, entry.competenciasClave, "tag tag-competencia");
    });

    card.appendChild(saberesArea);
    card.appendChild(competenciasArea);
  }

  const saberesLabel = document.createElement("p");
  saberesLabel.className = "info-text";
  saberesLabel.textContent = "Saberes básicos vinculados";
  card.appendChild(saberesLabel);

  renderTagList(
    saberesList,
    editable ? entry.saberesBasicos : criterio.saberesBasicos,
    "tag tag-saber"
  );
  card.appendChild(saberesList);

  const competenciasLabel = document.createElement("p");
  competenciasLabel.className = "info-text";
  competenciasLabel.textContent = "Competencias clave asociadas";
  card.appendChild(competenciasLabel);

  renderTagList(
    competenciasList,
    editable ? entry.competenciasClave : criterio.competenciasClave,
    "tag tag-competencia"
  );
  card.appendChild(competenciasList);

  const indicatorSection = document.createElement("div");
  const indicatorHeader = document.createElement("div");
  indicatorHeader.className = "indicator-actions";

  const addIndicatorBtn = document.createElement("button");
  addIndicatorBtn.type = "button";
  addIndicatorBtn.className = "small-btn primary";
  addIndicatorBtn.textContent = "Añadir indicador de logro";
  addIndicatorBtn.addEventListener("click", () => {
    if (indicatorSection.querySelector(".indicator-form")) return;
    const form = createIndicatorForm(entry, tableWrapper, totalPonderacion);
    indicatorSection.insertBefore(form, tableWrapper);
  });

  indicatorHeader.appendChild(addIndicatorBtn);
  indicatorSection.appendChild(indicatorHeader);

  const tableWrapper = document.createElement("div");
  indicatorSection.appendChild(tableWrapper);

  const totalPonderacion = document.createElement("div");
  totalPonderacion.className = "total-ponderacion";
  indicatorSection.appendChild(totalPonderacion);

  card.appendChild(indicatorSection);

  renderIndicatorTable(entry, tableWrapper, totalPonderacion);

  return card;
}

function updatePlanSummary() {
  const container = state.planSummaryElement;
  if (!container) {
    return;
  }

  container.innerHTML = "";
  const entries = Object.values(state.planning.criterios || {});
  container.appendChild(generatePlanSummary(entries));
}

function generatePlanSummary(entries) {
  const fragment = document.createDocumentFragment();

  const title = document.createElement("h3");
  title.className = "plan-summary-title";
  title.textContent = "Resumen de la planificación";
  fragment.appendChild(title);

  const entriesWithIndicators = entries.filter((entry) => entry.indicadores.length);

  if (!entriesWithIndicators.length) {
    const empty = document.createElement("p");
    empty.className = "info-text";
    empty.textContent = "Añade indicadores de logro para que aparezcan resumidos aquí.";
    fragment.appendChild(empty);
    return fragment;
  }

  entriesWithIndicators
    .slice()
    .sort((a, b) => {
      const aLabel = a.codigo || a.descripcion || "";
      const bLabel = b.codigo || b.descripcion || "";
      return aLabel.localeCompare(bLabel, "es", { sensitivity: "base" });
    })
    .forEach((entry) => {
      const block = document.createElement("article");
      block.className = "summary-block";

      const header = document.createElement("header");
      header.className = "summary-header";

      const heading = document.createElement("h4");
      heading.textContent = entry.codigo ? `Criterio ${entry.codigo}` : "Criterio personalizado";
      header.appendChild(heading);

      const total = entry.indicadores.reduce(
        (sum, indicator) => sum + Number(indicator.ponderacion || 0),
        0
      );
      const totalBadge = document.createElement("span");
      totalBadge.className = "summary-total";
      if (total > 100) {
        totalBadge.classList.add("over");
      }
      totalBadge.textContent = `Total ponderación: ${total}%`;
      header.appendChild(totalBadge);

      block.appendChild(header);

      if (entry.descripcion) {
        const description = document.createElement("p");
        description.className = "summary-criterion-desc";
        description.textContent = entry.descripcion;
        block.appendChild(description);
      }

      const list = document.createElement("ul");
      list.className = "summary-indicators";

      entry.indicadores.forEach((indicator) => {
        const listItem = document.createElement("li");

        const indicatorText = document.createElement("p");
        indicatorText.className = "summary-indicator-text";
        indicatorText.textContent = indicator.indicador;
        listItem.appendChild(indicatorText);

        const details = document.createElement("div");
        details.className = "summary-indicator-meta";

        const task = document.createElement("span");
        task.innerHTML = `<strong>Tarea:</strong> ${indicator.tarea}`;
        details.appendChild(task);

        const instrument = document.createElement("span");
        instrument.innerHTML = `<strong>Instrumento:</strong> ${indicator.instrumento}`;
        details.appendChild(instrument);

        const weight = document.createElement("span");
        weight.className = "summary-indicator-weight";
        weight.textContent = `${indicator.ponderacion}%`;
        details.appendChild(weight);

        listItem.appendChild(details);
        list.appendChild(listItem);
      });

      block.appendChild(list);
      fragment.appendChild(block);
    });

  return fragment;
}

function buildPrintablePlan() {
  const competencia = state.selectedCompetencia;
  if (!competencia) {
    return null;
  }

  const entries = Object.values(state.planning.criterios || {});
  const printable = document.createElement("article");
  printable.className = "printable-report";

  const header = document.createElement("header");
  header.className = "printable-header";

  const heading = document.createElement("h2");
  heading.textContent = "Planificación de evaluación competencial";
  header.appendChild(heading);

  const context = document.createElement("p");
  context.className = "printable-context";
  context.textContent = `${state.selectedArea} · Curso ${state.selectedCourse}`;
  header.appendChild(context);

  const meta = document.createElement("ul");
  meta.className = "printable-meta";
  [
    ["Curso", state.selectedCourse || "-"],
    ["Área", state.selectedArea || "-"],
    ["Trimestre", competencia.trimestre || state.selectedTrimester || "-"],
    ["Competencia", `${competencia.codigo} · ${competencia.titulo}`]
  ].forEach(([label, value]) => {
    const item = document.createElement("li");
    item.innerHTML = `<strong>${label}:</strong> ${value}`;
    meta.appendChild(item);
  });
  header.appendChild(meta);

  const timestamp = document.createElement("p");
  timestamp.className = "printable-date";
  timestamp.textContent = `Generado el ${new Date().toLocaleString("es-ES")}`;
  header.appendChild(timestamp);

  printable.appendChild(header);

  if (competencia.descripcion) {
    const description = document.createElement("p");
    description.className = "printable-description";
    description.textContent = competencia.descripcion;
    printable.appendChild(description);
  }

  const criteriaSection = document.createElement("section");
  criteriaSection.className = "printable-criteria";

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "printable-indicators-empty";
    empty.textContent = "No se registraron criterios para esta competencia en la planificación actual.";
    printable.appendChild(empty);
  } else {
    entries.forEach((entry) => {
      const card = document.createElement("article");
      card.className = "printable-criterion";

      const cardHeader = document.createElement("header");
      cardHeader.className = "printable-criterion-header";

      const title = document.createElement("h3");
      title.textContent = entry.codigo ? `Criterio ${entry.codigo}` : "Criterio personalizado";
      cardHeader.appendChild(title);

      const origin = document.createElement("span");
      origin.className = "printable-origin";
      origin.textContent = entry.origen === "personalizado" ? "Personalizado" : "Decreto 107/2022";
      cardHeader.appendChild(origin);

      card.appendChild(cardHeader);

      if (entry.descripcion) {
        const description = document.createElement("p");
        description.className = "printable-criterion-description";
        description.textContent = entry.descripcion;
        card.appendChild(description);
      }

      const saberesBlock = createPrintableTagList(entry.saberesBasicos, "Saberes básicos asociados");
      if (saberesBlock) {
        card.appendChild(saberesBlock);
      }

      const competenciasBlock = createPrintableTagList(entry.competenciasClave, "Competencias clave vinculadas");
      if (competenciasBlock) {
        card.appendChild(competenciasBlock);
      }

      card.appendChild(createPrintableIndicators(entry));
      criteriaSection.appendChild(card);
    });

    printable.appendChild(criteriaSection);
  }

  const summarySection = document.createElement("section");
  summarySection.className = "plan-summary printable-summary";
  summarySection.appendChild(generatePlanSummary(entries));
  printable.appendChild(summarySection);

  return printable;
}

function createPrintableTagList(items, label) {
  if (!Array.isArray(items) || !items.length) {
    return null;
  }
  const block = document.createElement("div");
  block.className = "printable-tags-block";

  const heading = document.createElement("h4");
  heading.textContent = label;
  block.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "printable-tags";
  items.forEach((item) => {
    const tag = document.createElement("li");
    tag.textContent = item;
    list.appendChild(tag);
  });
  block.appendChild(list);
  return block;
}

function createPrintableIndicators(entry) {
  const container = document.createElement("div");
  container.className = "printable-indicators";

  const heading = document.createElement("h4");
  heading.textContent = "Indicadores planificados";
  container.appendChild(heading);

  if (!entry.indicadores.length) {
    const empty = document.createElement("p");
    empty.className = "printable-indicators-empty";
    empty.textContent = "Aún no se han añadido indicadores de logro para este criterio.";
    container.appendChild(empty);
    return container;
  }

  const table = document.createElement("table");
  table.className = "printable-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Indicador</th>
        <th>Tarea</th>
        <th>Instrumento</th>
        <th>Ponderación</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  entry.indicadores.forEach((indicator) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${indicator.indicador}</td>
      <td>${indicator.tarea}</td>
      <td>${indicator.instrumento}</td>
      <td>${indicator.ponderacion}%</td>
    `;
    tbody.appendChild(row);
  });

  container.appendChild(table);

  const total = entry.indicadores.reduce((sum, indicator) => sum + Number(indicator.ponderacion || 0), 0);
  const totalElement = document.createElement("p");
  totalElement.className = "printable-total";
  totalElement.textContent = `Ponderación total: ${total}%`;
  if (total > 100) {
    totalElement.classList.add("over");
  }
  container.appendChild(totalElement);

  return container;
}

function parseList(value) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderTagList(container, items = [], className = "tag") {
  container.innerHTML = "";
  if (!items || !items.length) {
    container.classList.add("info-text");
    container.textContent = "Sin elementos registrados";
    return;
  }
  container.classList.remove("info-text");
  items.forEach((item) => {
    const tag = document.createElement("span");
    tag.className = className;
    tag.textContent = item;
    container.appendChild(tag);
  });
}

function createIndicatorForm(entry, tableWrapper, totalElement) {
  const form = document.createElement("form");
  form.className = "indicator-form";

  const indicadorGroup = document.createElement("div");
  const indicadorLabel = document.createElement("label");
  indicadorLabel.textContent = "Indicador de logro";
  const indicadorInput = document.createElement("textarea");
  indicadorInput.required = true;
  indicadorGroup.appendChild(indicadorLabel);
  indicadorGroup.appendChild(indicadorInput);

  const tareaGroup = document.createElement("div");
  const tareaLabel = document.createElement("label");
  tareaLabel.textContent = "Tarea concreta";
  const tareaInput = document.createElement("textarea");
  tareaInput.required = true;
  tareaGroup.appendChild(tareaLabel);
  tareaGroup.appendChild(tareaInput);

  const instrumentoGroup = document.createElement("div");
  const instrumentoLabel = document.createElement("label");
  instrumentoLabel.textContent = "Instrumento de evaluación";
  const instrumentoInput = document.createElement("input");
  instrumentoInput.type = "text";
  instrumentoInput.required = true;
  instrumentoGroup.appendChild(instrumentoLabel);
  instrumentoGroup.appendChild(instrumentoInput);

  const ponderacionGroup = document.createElement("div");
  const ponderacionLabel = document.createElement("label");
  ponderacionLabel.textContent = "Ponderación (%)";
  const ponderacionInput = document.createElement("input");
  ponderacionInput.type = "number";
  ponderacionInput.min = "0";
  ponderacionInput.max = "100";
  ponderacionInput.step = "1";
  ponderacionInput.required = true;
  ponderacionGroup.appendChild(ponderacionLabel);
  ponderacionGroup.appendChild(ponderacionInput);

  const actions = document.createElement("div");
  actions.className = "form-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "small-btn neutral";
  cancelBtn.textContent = "Cancelar";
  cancelBtn.addEventListener("click", () => form.remove());

  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.className = "small-btn primary";
  submitBtn.textContent = "Añadir";

  actions.append(cancelBtn, submitBtn);

  form.append(indicadorGroup, tareaGroup, instrumentoGroup, ponderacionGroup, actions);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const indicador = indicadorInput.value.trim();
    const tarea = tareaInput.value.trim();
    const instrumento = instrumentoInput.value.trim();
    const ponderacion = Number(ponderacionInput.value);

    if (!indicador || !tarea || !instrumento || Number.isNaN(ponderacion)) {
      return;
    }

    entry.indicadores.push({
      id: `${entry.id}-${Date.now()}`,
      indicador,
      tarea,
      instrumento,
      ponderacion
    });

    renderIndicatorTable(entry, tableWrapper, totalElement);
    form.remove();
    toggleExport(true);
  });

  return form;
}

function renderIndicatorTable(entry, wrapper, totalElement) {
  if (!wrapper) return;
  wrapper.innerHTML = "";
  if (!entry.indicadores.length) {
    const empty = document.createElement("div");
    empty.className = "indicator-empty";
    empty.textContent = "Aún no se han añadido indicadores de logro.";
    wrapper.appendChild(empty);
    if (totalElement) {
      totalElement.textContent = "";
      totalElement.classList.remove("over");
    }
    updatePlanSummary();
    return;
  }

  const table = document.createElement("table");
  table.className = "indicator-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Indicador</th>
        <th>Tarea</th>
        <th>Instrumento</th>
        <th>Ponderación</th>
        <th></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");

  entry.indicadores.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.indicador}</td>
      <td>${item.tarea}</td>
      <td>${item.instrumento}</td>
      <td>${item.ponderacion}%</td>
      <td></td>
    `;
    const actionCell = row.querySelector("td:last-child");
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "small-btn danger";
    deleteBtn.textContent = "Eliminar";
    deleteBtn.addEventListener("click", () => {
      entry.indicadores = entry.indicadores.filter((indicator) => indicator.id !== item.id);
      renderIndicatorTable(entry, wrapper, totalElement);
    });
    actionCell.appendChild(deleteBtn);
    tbody.appendChild(row);
  });

  wrapper.appendChild(table);

  if (totalElement) {
    const total = entry.indicadores.reduce((sum, indicator) => sum + Number(indicator.ponderacion || 0), 0);
    totalElement.textContent = `Ponderación total: ${total}%`;
    if (total > 100) {
      totalElement.classList.add("over");
    } else {
      totalElement.classList.remove("over");
    }
  }

  updatePlanSummary();
}

function addCustomCriterion(container) {
  if (!state.selectedCompetencia) return;
  state.customCounter += 1;
  const id = `custom-${Date.now()}-${state.customCounter}`;
  const customData = {
    codigo: "",
    descripcion: "",
    saberesBasicos: [],
    competenciasClave: []
  };
  const card = createCriterionCard(customData, { id, editable: true });
  container.appendChild(card);
  card.scrollIntoView({ behavior: "smooth", block: "center" });
}

function toggleExport(enable) {
  exportBtn.disabled = !enable;
}

function handleExportToPdf() {
  const printable = buildPrintablePlan();
  if (!printable) {
    return;
  }

  document.body.appendChild(printable);

  const filenameSafeArea = state.selectedArea ? state.selectedArea.replace(/\s+/g, "-") : "plan";
  const filenameSafeCourse = state.selectedCourse ? state.selectedCourse.replace(/\s+/g, "-") : "curso";
  const filenameSafeCompetencia = state.selectedCompetencia
    ? `${state.selectedCompetencia.codigo}`.replace(/\s+/g, "-")
    : "competencia";

  const options = {
    margin: 0.5,
    filename: `planificacion-${filenameSafeArea}-${filenameSafeCourse}-${filenameSafeCompetencia}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
    jsPDF: { unit: "cm", format: "a4", orientation: "portrait" }
  };

  const shouldReenable = Boolean(state.selectedCompetencia);
  exportBtn.disabled = true;

  html2pdf()
    .set(options)
    .from(printable)
    .save()
    .catch((error) => {
      console.error("No se pudo generar el PDF", error);
    })
    .finally(() => {
      printable.remove();
      toggleExport(shouldReenable);
    });
}

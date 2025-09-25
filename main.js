
document.addEventListener("DOMContentLoaded", () => {
  const cursoSelect = document.getElementById("cursoSelect");
  const areaSelect = document.getElementById("areaSelect");
  const output = document.getElementById("output");

  fetch('data.json')
    .then(res => res.json())
    .then(data => {
      const cursos = Object.keys(data);
      cursos.forEach(curso => {
        const option = document.createElement("option");
        option.value = curso;
        option.textContent = curso;
        cursoSelect.appendChild(option);
      });

      cursoSelect.addEventListener("change", () => {
        areaSelect.innerHTML = "";
        const areas = Object.keys(data[cursoSelect.value]);
        areas.forEach(area => {
          const option = document.createElement("option");
          option.value = area;
          option.textContent = area;
          areaSelect.appendChild(option);
        });
      });

      areaSelect.addEventListener("change", () => {
        const selectedData = data[cursoSelect.value][areaSelect.value];
        output.innerHTML = "<pre>" + JSON.stringify(selectedData, null, 2) + "</pre>";
      });
    });

  document.getElementById("exportPdf").addEventListener("click", () => {
    html2pdf().from(output).save("evaluacion_competencial.pdf");
  });
});

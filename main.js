fetch("data.json")
  .then(response => response.json())
  .then(data => {
    const app = document.getElementById("app");
    app.innerHTML = "<pre>" + JSON.stringify(data, null, 2) + "</pre>";
  });
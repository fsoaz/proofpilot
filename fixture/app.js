const seed = await fetch("/seed.json").then((response) => response.json());
const storageKey = "relay-tasks";
let tasks = JSON.parse(localStorage.getItem(storageKey) ?? "null") ?? seed;
const board = document.querySelector("#board");

function save() {
  localStorage.setItem(storageKey, JSON.stringify(tasks));
}

function render() {
  const list = document.createElement("ul");
  for (const task of tasks) {
    const item = document.createElement("li");
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.addEventListener("change", () => {
      task.completed = checkbox.checked;
      save();
      render();
    });
    label.append(checkbox, task.title);
    const status = document.createElement("small");
    status.textContent = task.completed ? "Completed" : "Open";
    item.append(label, status);
    list.append(item);
  }
  board.replaceChildren(list);
}

render();

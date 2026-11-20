const seed = await fetch("/seed.json").then((response) => response.json());
const storageKey = "relay-tasks";
let tasks = JSON.parse(localStorage.getItem(storageKey) ?? "null") ?? seed;
let view = "Active";
const board = document.querySelector("#board");
const actions = document.querySelector("#actions");
const views = document.querySelector("#views");

function save() {
  localStorage.setItem(storageKey, JSON.stringify(tasks));
}

function button(name, activate) {
  const control = document.createElement("button");
  control.type = "button";
  control.textContent = name;
  control.addEventListener("click", activate);
  return control;
}

function render() {
  actions.replaceChildren(button("Archive completed", () => {
    for (const task of tasks) {
      if (task.completed && !task.archived) task.archived = true;
    }
    /* persist archive */
    render();
  }));

  views.replaceChildren(...["Active", "Archive"].map((name) => {
    const control = button(name, () => {
      view = name;
      render();
    });
    control.setAttribute("aria-pressed", String(view === name));
    return control;
  }));

  board.setAttribute("aria-label", view === "Archive" ? "Archived tasks" : "Active tasks");
  const list = document.createElement("ul");
  for (const task of tasks.filter((item) => Boolean(item.archived) === (view === "Archive"))) {
    const item = document.createElement("li");
    const label = document.createElement("label");
    if (view === "Active") {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = task.completed;
      checkbox.addEventListener("change", () => {
        task.completed = checkbox.checked;
        save();
        render();
      });
      label.append(checkbox);
    }
    label.append(task.title);
    const status = document.createElement("small");
    status.textContent = view === "Archive" ? "Archived" : task.completed ? "Completed" : "Open";
    item.append(label, status);
    list.append(item);
  }

  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = view === "Archive" ? "No archived tasks." : "No active tasks.";
  board.replaceChildren(list.children.length ? list : empty);
}

render();

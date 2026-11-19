const STORAGE_KEY = "inno_trade_mobile_notes_v1";

const form = document.getElementById("noteForm");
const input = document.getElementById("noteInput");
const list = document.getElementById("noteList");
const clearAllBtn = document.getElementById("clearAllBtn");
const statusBadge = document.getElementById("statusBadge");

let items = loadItems();
render();

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    statusBadge.textContent = "저장됨";
  } catch {
    statusBadge.textContent = "저장 오류";
  }
}

function render() {
  list.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.style.margin = "8px 0 0";
    empty.textContent = "등록된 항목이 없습니다.";
    list.appendChild(empty);
    return;
  }

  items.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = `note-item ${item.done ? "done" : ""}`;

    const textSpan = document.createElement("span");
    textSpan.textContent = item.text;
    textSpan.style.flex = "1";
    textSpan.style.wordBreak = "break-word";
    textSpan.addEventListener("click", () => {
      items[idx].done = !items[idx].done;
      saveItems();
      render();
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "note-delete";
    delBtn.textContent = "삭제";
    delBtn.addEventListener("click", () => {
      items.splice(idx, 1);
      saveItems();
      render();
    });

    li.appendChild(textSpan);
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = input.value.trim();
  if (!value) return;

  items.unshift({ text: value, done: false });
  saveItems();
  render();
  input.value = "";
  input.focus();
});

clearAllBtn.addEventListener("click", () => {
  if (items.length === 0) return;
  items = [];
  saveItems();
  render();
});

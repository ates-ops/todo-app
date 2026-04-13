'use strict';

const STORAGE_KEY = 'todos_v1';

let todos = load();
let filter = 'all';

const input       = document.getElementById('todo-input');
const addBtn      = document.getElementById('add-btn');
const list        = document.getElementById('todo-list');
const taskCount   = document.getElementById('task-count');
const footer      = document.getElementById('footer');
const doneCount   = document.getElementById('done-count');
const clearBtn    = document.getElementById('clear-done-btn');
const filterBtns  = document.querySelectorAll('.filter-btn');

// ── Persistence ──────────────────────────────────────────────

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

// ── State helpers ─────────────────────────────────────────────

function addTodo(text) {
  text = text.trim();
  if (!text) return;
  todos.unshift({ id: Date.now(), text, done: false });
  save();
  render();
}

function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (todo) { todo.done = !todo.done; save(); render(); }
}

function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  save();
  render();
}

function clearDone() {
  todos = todos.filter(t => !t.done);
  save();
  render();
}

// ── Render ───────────────────────────────────────────────────

function visibleTodos() {
  if (filter === 'open') return todos.filter(t => !t.done);
  if (filter === 'done') return todos.filter(t =>  t.done);
  return todos;
}

function render() {
  const items = visibleTodos();
  const openCount = todos.filter(t => !t.done).length;
  const doneTotal = todos.filter(t =>  t.done).length;

  // Header counter
  taskCount.textContent = openCount === 1 ? '1 offen' : `${openCount} offen`;

  // Footer
  if (todos.length === 0) {
    footer.classList.add('hidden');
  } else {
    footer.classList.remove('hidden');
    doneCount.textContent = `${doneTotal} erledigt`;
  }

  // List
  list.innerHTML = '';

  if (items.length === 0) {
    const msg = filter === 'done'
      ? 'Noch nichts erledigt.'
      : filter === 'open'
      ? 'Alle Aufgaben erledigt!'
      : 'Keine Aufgaben vorhanden.';
    list.innerHTML = `<li class="empty">${msg}</li>`;
    return;
  }

  items.forEach(todo => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.done ? ' done' : '');
    li.dataset.id = todo.id;

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'check-btn';
    check.checked = todo.done;
    check.setAttribute('aria-label', 'Aufgabe abhaken');
    check.addEventListener('change', () => toggleTodo(todo.id));

    const span = document.createElement('span');
    span.className = 'todo-text';
    span.textContent = todo.text;

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '✕';
    del.setAttribute('aria-label', 'Aufgabe löschen');
    del.addEventListener('click', () => deleteTodo(todo.id));

    li.append(check, span, del);
    list.appendChild(li);
  });
}

// ── Events ───────────────────────────────────────────────────

addBtn.addEventListener('click', () => {
  addTodo(input.value);
  input.value = '';
  input.focus();
});

input.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    addTodo(input.value);
    input.value = '';
  }
});

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filter = btn.dataset.filter;
    filterBtns.forEach(b => b.classList.toggle('active', b === btn));
    render();
  });
});

clearBtn.addEventListener('click', clearDone);

// ── Init ─────────────────────────────────────────────────────

render();
input.focus();

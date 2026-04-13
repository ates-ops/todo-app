'use strict';

const STORAGE_KEY = 'todos_v1';

const CATEGORIES = {
  work:     { label: 'Arbeit',   color: '#3b82f6' },
  private:  { label: 'Privat',  color: '#a855f7' },
  shopping: { label: 'Shopping', color: '#10b981' },
};

const PRIORITIES = {
  high:   { label: 'Hoch',     color: '#ef4444', order: 1 },
  medium: { label: 'Mittel',   color: '#eab308', order: 2 },
  low:    { label: 'Niedrig',  color: '#22c55e', order: 3 },
};

let todos = load();
let filter = 'all';
let categoryFilter = 'all';
let sortByPriority = false;

// ── Drag state ────────────────────────────────────────────────
let dragId = null;

const input           = document.getElementById('todo-input');
const categorySelect  = document.getElementById('category-select');
const prioritySelect  = document.getElementById('priority-select');
const dueDateInput    = document.getElementById('due-date-input');
const addBtn          = document.getElementById('add-btn');
const list            = document.getElementById('todo-list');
const taskCount       = document.getElementById('task-count');
const footer          = document.getElementById('footer');
const doneCount       = document.getElementById('done-count');
const clearBtn        = document.getElementById('clear-done-btn');
const filterBtns      = document.querySelectorAll('.filter-btn:not(#sort-priority-btn)');
const catBtns         = document.querySelectorAll('.cat-btn');
const sortPriorityBtn = document.getElementById('sort-priority-btn');

// ── Persistence ──────────────────────────────────────────────

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

// ── State helpers ─────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addTodo(text, category, priority, dueDate) {
  text = text.trim();
  if (!text) return;
  todos.unshift({ id: Date.now(), text, done: false, category: category || null, priority: priority || null, dueDate: dueDate || null });
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

function moveTodo(fromId, toId, insertBefore) {
  const fromIdx = todos.findIndex(t => t.id === fromId);
  const toIdx   = todos.findIndex(t => t.id === toId);
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
  const [item] = todos.splice(fromIdx, 1);
  const newToIdx = todos.findIndex(t => t.id === toId);
  todos.splice(insertBefore ? newToIdx : newToIdx + 1, 0, item);
  save();
  render();
}

function clearDragStyles() {
  list.querySelectorAll('.todo-item').forEach(el =>
    el.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom')
  );
}

// ── Render ───────────────────────────────────────────────────

function visibleTodos() {
  let items = todos;
  if (filter === 'open') items = items.filter(t => !t.done);
  if (filter === 'done') items = items.filter(t =>  t.done);
  if (categoryFilter !== 'all') items = items.filter(t => t.category === categoryFilter);
  if (sortByPriority) {
    items = [...items].sort((a, b) => {
      const oa = a.priority ? PRIORITIES[a.priority].order : 99;
      const ob = b.priority ? PRIORITIES[b.priority].order : 99;
      return oa - ob;
    });
  }
  return items;
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

  // Sort button state
  sortPriorityBtn.classList.toggle('active', sortByPriority);

  // Category filter active states
  catBtns.forEach(btn => {
    const isActive = btn.dataset.cat === categoryFilter;
    btn.classList.toggle('active', isActive);
    const cat = CATEGORIES[btn.dataset.cat];
    if (isActive && cat) {
      btn.style.background = cat.color;
      btn.style.borderColor = cat.color;
      btn.style.color = '#fff';
    } else if (!isActive && cat) {
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
    }
  });

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

    // Drag handle — only enable dragging when grabbed via the handle
    const handle = document.createElement('span');
    handle.className = 'drag-handle' + (sortByPriority ? ' drag-handle-disabled' : '');
    handle.setAttribute('aria-hidden', 'true');
    handle.title = sortByPriority ? 'Sortierung deaktiviert' : 'Ziehen zum Sortieren';
    if (!sortByPriority) {
      handle.addEventListener('mousedown', () => { li.draggable = true; });
      handle.addEventListener('touchstart', () => { li.draggable = true; }, { passive: true });
    }

    li.addEventListener('dragstart', e => {
      dragId = todo.id;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => li.classList.add('dragging'), 0);
    });
    li.addEventListener('dragend', () => {
      li.draggable = false;
      dragId = null;
      clearDragStyles();
    });
    li.addEventListener('dragover', e => {
      if (!dragId || dragId === todo.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      clearDragStyles();
      const mid = li.getBoundingClientRect().top + li.offsetHeight / 2;
      li.classList.add(e.clientY < mid ? 'drag-over-top' : 'drag-over-bottom');
    });
    li.addEventListener('dragleave', e => {
      if (!li.contains(e.relatedTarget)) {
        li.classList.remove('drag-over-top', 'drag-over-bottom');
      }
    });
    li.addEventListener('drop', e => {
      e.preventDefault();
      if (!dragId || dragId === todo.id) return;
      const mid = li.getBoundingClientRect().top + li.offsetHeight / 2;
      moveTodo(dragId, todo.id, e.clientY < mid);
    });

    const dot = document.createElement('span');
    const prio = todo.priority && PRIORITIES[todo.priority];
    dot.className = 'priority-dot' + (todo.priority ? ` priority-${todo.priority}` : ' priority-none');
    dot.title = prio ? `Priorität: ${prio.label}` : 'Keine Priorität';

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

    const children = [handle, dot, check];
    const cat = todo.category && CATEGORIES[todo.category];
    if (cat) {
      const badge = document.createElement('span');
      badge.className = 'category-badge';
      badge.textContent = cat.label;
      badge.style.cssText = `background:${cat.color}28;color:${cat.color};border-color:${cat.color}66`;
      children.push(badge);
    }
    if (todo.dueDate) {
      const today = todayStr();
      const [y, m, d] = todo.dueDate.split('-');
      const dateBadge = document.createElement('span');
      dateBadge.className = 'due-date-badge'
        + (todo.dueDate < today ? ' due-overdue' : todo.dueDate === today ? ' due-today' : '');
      dateBadge.title = 'Fällig: ' + `${d}.${m}.${y}`;
      dateBadge.textContent = `\uD83D\uDCC5 ${d}.${m}.${y}`;
      children.push(dateBadge);
    }
    children.push(span, del);
    li.append(...children);
    list.appendChild(li);
  });
}

// ── Events ───────────────────────────────────────────────────

addBtn.addEventListener('click', () => {
  addTodo(input.value, categorySelect.value, prioritySelect.value, dueDateInput.value);
  input.value = '';
  categorySelect.value = '';
  prioritySelect.value = '';
  dueDateInput.value = '';
  input.focus();
});

input.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    addTodo(input.value, categorySelect.value, prioritySelect.value, dueDateInput.value);
    input.value = '';
    categorySelect.value = '';
    prioritySelect.value = '';
    dueDateInput.value = '';
  }
});

sortPriorityBtn.addEventListener('click', () => {
  sortByPriority = !sortByPriority;
  render();
});

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filter = btn.dataset.filter;
    filterBtns.forEach(b => b.classList.toggle('active', b === btn));
    render();
  });
});

catBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    categoryFilter = btn.dataset.cat;
    render();
  });
});

clearBtn.addEventListener('click', clearDone);

// ── Init ─────────────────────────────────────────────────────

render();
input.focus();

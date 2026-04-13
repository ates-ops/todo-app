'use strict';

const STORAGE_KEY = 'kanban_v1';

const CATEGORIES = {
  work:     { label: 'Arbeit',   color: '#3b82f6' },
  private:  { label: 'Privat',  color: '#a855f7' },
  shopping: { label: 'Shopping', color: '#10b981' },
};

const PRIORITIES = {
  high:   { label: 'Hoch',    color: '#ef4444', order: 1 },
  medium: { label: 'Mittel',  color: '#eab308', order: 2 },
  low:    { label: 'Niedrig', color: '#22c55e', order: 3 },
};

const COLUMNS = [
  { id: 'offen',     label: 'Offen',     color: '#6c63ff' },
  { id: 'inarbeit',  label: 'In Arbeit', color: '#f59e0b' },
  { id: 'blockiert', label: 'Blockiert', color: '#ef4444' },
  { id: 'erledigt',  label: 'Erledigt',  color: '#22c55e' },
];

let todos = load();
let modalTodoId = null;
let dragId = null;

// ── Persistence ──────────────────────────────────────────────

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data) return data;
    // Migrate from old list format
    const old = JSON.parse(localStorage.getItem('todos_v1'));
    if (old && old.length) {
      return old.map(t => ({
        id: t.id,
        text: t.text,
        column: t.done ? 'erledigt' : 'offen',
        done: !!t.done,
        category: t.category || null,
        priority: t.priority || null,
        dueDate: t.dueDate || null,
        description: '',
        checklist: [],
        comments: [],
      }));
    }
    return [];
  } catch { return []; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

// ── Helpers ──────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTimestamp(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// ── Todo operations ──────────────────────────────────────────

function addTodo(text, category, priority, dueDate) {
  text = text.trim();
  if (!text) return false;
  todos.unshift({
    id: Date.now(),
    text,
    column: 'offen',
    done: false,
    category: category || null,
    priority: priority || null,
    dueDate: dueDate || null,
    description: '',
    checklist: [],
    comments: [],
  });
  save();
  renderBoard();
  return true;
}

function moveTodoToColumn(id, column) {
  const todo = todos.find(t => t.id === id);
  if (!todo || todo.column === column) return;
  todo.column = column;
  todo.done = column === 'erledigt';
  save();
  renderBoard();
  // Sync modal column selector if open
  if (modalTodoId === id) {
    document.getElementById('modal-column').value = column;
  }
}

function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  save();
  if (modalTodoId === id) closeModal(false);
  renderBoard();
}

// ── Board render ─────────────────────────────────────────────

function renderBoard() {
  COLUMNS.forEach(col => {
    const body  = document.getElementById(`col-${col.id}`);
    const count = document.getElementById(`count-${col.id}`);
    const colTodos = todos.filter(t => t.column === col.id);

    count.textContent = colTodos.length;
    body.innerHTML = '';

    if (colTodos.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'card-empty';
      empty.textContent = 'Keine Aufgaben';
      body.appendChild(empty);
    } else {
      colTodos.forEach(todo => body.appendChild(createCard(todo)));
    }
  });
}

function createCard(todo) {
  const card = document.createElement('div');
  card.className = 'kanban-card' + (todo.done ? ' card-done' : '');
  card.dataset.id = todo.id;
  card.draggable = true;

  // Priority bar
  if (todo.priority) {
    const bar = document.createElement('div');
    bar.className = `card-priority-bar priority-${todo.priority}`;
    card.appendChild(bar);
  }

  const body = document.createElement('div');
  body.className = 'card-body';

  // Title row
  const titleRow = document.createElement('div');
  titleRow.className = 'card-title-row';

  const titleEl = document.createElement('span');
  titleEl.className = 'card-title';
  titleEl.textContent = todo.text;

  const del = document.createElement('button');
  del.className = 'card-delete';
  del.textContent = '✕';
  del.title = 'Löschen';
  del.addEventListener('click', e => { e.stopPropagation(); deleteTodo(todo.id); });

  titleRow.append(titleEl, del);
  body.appendChild(titleRow);

  // Badges
  const badges = document.createElement('div');
  badges.className = 'card-badges';

  if (todo.priority) {
    const b = document.createElement('span');
    b.className = `badge badge-priority priority-badge-${todo.priority}`;
    b.textContent = PRIORITIES[todo.priority].label;
    badges.appendChild(b);
  }

  if (todo.category && CATEGORIES[todo.category]) {
    const cat = CATEGORIES[todo.category];
    const b = document.createElement('span');
    b.className = 'badge badge-category';
    b.textContent = cat.label;
    b.style.cssText = `background:${cat.color}28;color:${cat.color};border-color:${cat.color}66`;
    badges.appendChild(b);
  }

  if (todo.dueDate) {
    const today = todayStr();
    const [y, m, d] = todo.dueDate.split('-');
    const b = document.createElement('span');
    b.className = 'badge badge-due'
      + (todo.dueDate < today ? ' due-overdue' : todo.dueDate === today ? ' due-today' : '');
    b.textContent = `\uD83D\uDCC5 ${d}.${m}.${y}`;
    badges.appendChild(b);
  }

  body.appendChild(badges);

  // Checklist progress
  if (todo.checklist && todo.checklist.length > 0) {
    const done = todo.checklist.filter(i => i.done).length;
    const progress = document.createElement('div');
    progress.className = 'card-progress';
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.style.width = `${(done / todo.checklist.length) * 100}%`;
    bar.appendChild(fill);
    const label = document.createElement('span');
    label.className = 'progress-label';
    label.textContent = `${done}/${todo.checklist.length}`;
    progress.append(bar, label);
    body.appendChild(progress);
  }

  // Comments indicator
  if (todo.comments && todo.comments.length > 0) {
    const ci = document.createElement('span');
    ci.className = 'card-comment-count';
    ci.textContent = `\uD83D\uDCAC ${todo.comments.length}`;
    body.appendChild(ci);
  }

  card.appendChild(body);

  // Click → modal
  card.addEventListener('click', () => openModal(todo.id));

  // Drag
  card.addEventListener('dragstart', e => {
    dragId = todo.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(todo.id));
    setTimeout(() => card.classList.add('dragging'), 0);
  });
  card.addEventListener('dragend', () => {
    dragId = null;
    card.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  });

  return card;
}

// ── Column drop zones ────────────────────────────────────────

function setupColumnDrop() {
  COLUMNS.forEach(col => {
    const body = document.getElementById(`col-${col.id}`);

    body.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      body.classList.add('drag-over');
    });

    body.addEventListener('dragleave', e => {
      if (!body.contains(e.relatedTarget)) {
        body.classList.remove('drag-over');
      }
    });

    body.addEventListener('drop', e => {
      e.preventDefault();
      body.classList.remove('drag-over');
      if (dragId) moveTodoToColumn(dragId, col.id);
    });
  });
}

// ── Modal ────────────────────────────────────────────────────

function openModal(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  modalTodoId = id;

  document.getElementById('modal-title').value = todo.text;
  document.getElementById('modal-description').value = todo.description || '';
  document.getElementById('modal-column').value = todo.column;

  renderModalMeta(todo);
  renderChecklist(todo);
  renderComments(todo);

  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-title').focus();
}

function closeModal(doSave = true) {
  if (doSave) saveModalData();
  modalTodoId = null;
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('checklist-input').value = '';
  document.getElementById('comment-input').value = '';
}

function saveModalData() {
  if (!modalTodoId) return;
  const todo = todos.find(t => t.id === modalTodoId);
  if (!todo) return;
  const newTitle = document.getElementById('modal-title').value.trim();
  if (newTitle) todo.text = newTitle;
  todo.description = document.getElementById('modal-description').value;
  save();
  renderBoard();
}

function renderModalMeta(todo) {
  const meta = document.getElementById('modal-meta');
  meta.innerHTML = '';

  if (todo.priority) {
    const b = document.createElement('span');
    b.className = `badge badge-priority priority-badge-${todo.priority}`;
    b.textContent = PRIORITIES[todo.priority].label;
    meta.appendChild(b);
  }

  if (todo.category && CATEGORIES[todo.category]) {
    const cat = CATEGORIES[todo.category];
    const b = document.createElement('span');
    b.className = 'badge badge-category';
    b.textContent = cat.label;
    b.style.cssText = `background:${cat.color}28;color:${cat.color};border-color:${cat.color}66`;
    meta.appendChild(b);
  }

  if (todo.dueDate) {
    const today = todayStr();
    const [y, m, d] = todo.dueDate.split('-');
    const b = document.createElement('span');
    b.className = 'badge badge-due'
      + (todo.dueDate < today ? ' due-overdue' : todo.dueDate === today ? ' due-today' : '');
    b.textContent = `\uD83D\uDCC5 ${d}.${m}.${y}`;
    meta.appendChild(b);
  }
}

function renderChecklist(todo) {
  const container = document.getElementById('modal-checklist-items');
  container.innerHTML = '';

  (todo.checklist || []).forEach(item => {
    const row = document.createElement('div');
    row.className = 'checklist-item';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = item.done;
    check.addEventListener('change', () => {
      item.done = check.checked;
      label.classList.toggle('checklist-label-done', item.done);
      save();
      renderBoard();
    });

    const label = document.createElement('span');
    label.className = 'checklist-label' + (item.done ? ' checklist-label-done' : '');
    label.textContent = item.text;

    const del = document.createElement('button');
    del.className = 'checklist-delete';
    del.textContent = '✕';
    del.title = 'Element löschen';
    del.addEventListener('click', () => {
      todo.checklist = todo.checklist.filter(i => i.id !== item.id);
      save();
      renderBoard();
      renderChecklist(todo);
    });

    row.append(check, label, del);
    container.appendChild(row);
  });
}

function renderComments(todo) {
  const container = document.getElementById('modal-comments-list');
  container.innerHTML = '';

  (todo.comments || []).slice().reverse().forEach(comment => {
    const item = document.createElement('div');
    item.className = 'comment-item';

    const ts = document.createElement('span');
    ts.className = 'comment-timestamp';
    ts.textContent = formatTimestamp(comment.timestamp);

    const text = document.createElement('p');
    text.className = 'comment-text';
    text.textContent = comment.text;

    const del = document.createElement('button');
    del.className = 'comment-delete';
    del.textContent = '✕';
    del.title = 'Kommentar löschen';
    del.addEventListener('click', () => {
      todo.comments = todo.comments.filter(c => c.id !== comment.id);
      save();
      renderComments(todo);
    });

    item.append(del, ts, text);
    container.appendChild(item);
  });
}

// ── Event wiring ─────────────────────────────────────────────

// Add task
document.getElementById('add-btn').addEventListener('click', () => {
  const input    = document.getElementById('todo-input');
  const category = document.getElementById('category-select').value;
  const priority = document.getElementById('priority-select').value;
  const dueDate  = document.getElementById('due-date-input').value;
  if (addTodo(input.value, category, priority, dueDate)) {
    input.value = '';
    document.getElementById('category-select').value = '';
    document.getElementById('priority-select').value = '';
    document.getElementById('due-date-input').value = '';
    input.focus();
  }
});

document.getElementById('todo-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('add-btn').click();
});

// Modal close
document.getElementById('modal-close').addEventListener('click', () => closeModal());

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalTodoId !== null) closeModal();
});

// Modal auto-save on blur
document.getElementById('modal-title').addEventListener('blur', saveModalData);
document.getElementById('modal-description').addEventListener('blur', saveModalData);

// Move via modal column selector
document.getElementById('modal-column').addEventListener('change', e => {
  if (!modalTodoId) return;
  const todo = todos.find(t => t.id === modalTodoId);
  if (!todo) return;
  todo.column = e.target.value;
  todo.done = e.target.value === 'erledigt';
  save();
  renderBoard();
});

// Add checklist item
document.getElementById('checklist-add-btn').addEventListener('click', () => {
  const input = document.getElementById('checklist-input');
  const text = input.value.trim();
  if (!text || !modalTodoId) return;
  const todo = todos.find(t => t.id === modalTodoId);
  if (!todo) return;
  todo.checklist.push({ id: Date.now(), text, done: false });
  save();
  renderBoard();
  renderChecklist(todo);
  input.value = '';
  input.focus();
});

document.getElementById('checklist-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('checklist-add-btn').click();
});

// Add comment
document.getElementById('comment-add-btn').addEventListener('click', () => {
  const input = document.getElementById('comment-input');
  const text = input.value.trim();
  if (!text || !modalTodoId) return;
  const todo = todos.find(t => t.id === modalTodoId);
  if (!todo) return;
  todo.comments.push({ id: Date.now(), text, timestamp: new Date().toISOString() });
  save();
  renderComments(todo);
  input.value = '';
  input.focus();
});

document.getElementById('comment-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('comment-add-btn').click();
  }
});

// ── Theme ─────────────────────────────────────────────────────

const THEME_KEY = 'kanban_theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const isDark = theme === 'dark';
  document.getElementById('icon-sun').style.display  = isDark ? '' : 'none';
  document.getElementById('icon-moon').style.display = isDark ? 'none' : '';
}

(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(saved);
})();

document.getElementById('theme-toggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

// ── Init ─────────────────────────────────────────────────────

setupColumnDrop();
renderBoard();
document.getElementById('todo-input').focus();

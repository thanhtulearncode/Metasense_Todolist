let allTasks = [];
let currentFilter = 'all'; // 'all', 'active', 'completed'
let currentSort = 'date-desc'; // 'date-desc', 'alpha', 'status'
let dragSrcId = null;
let isSyncing = false;

const STORAGE_KEY = 'todo_tasks_local_v1';
const QUEUE_KEY = 'todo_sync_queue_v1';
const THEME_KEY = 'todo_theme_v1';

// Dark mode 
(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.body.classList.add('dark');
  }
})();

function updateToggleIcon() {
  const btn = document.getElementById('darkModeToggle');
  if (!btn) return;
  const isDark = document.body.classList.contains('dark');
  btn.textContent = isDark ? '🌙' : '☀️';
  btn.title = isDark ? 'Passer en mode clair' : 'Passer en mode sombre';
}

document.addEventListener('DOMContentLoaded', () => {
  updateToggleIcon();
  document.getElementById('darkModeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    updateToggleIcon();
  });
});

// localStorage helpers 
function saveTasksToLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allTasks));
  } catch (e) {
  }
}

function loadTasksFromLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

// Offline sync queue
function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
  }
}

function enqueue(entry) {
  const queue = loadQueue();
  queue.push(entry);
  saveQueue(queue);
}

function dequeue(index) {
  const queue = loadQueue();
  queue.splice(index, 1);
  saveQueue(queue);
}

async function syncQueue() {
  if (isSyncing) return;
  const queue = loadQueue();
  if (queue.length === 0) return;

  isSyncing = true;
  showNotification(`Synchronisation de ${queue.length} action(s)`);

  const idRemap = new Map();

  let successCount = 0;
  let failCount = 0;

  while (true) {
    const currentQueue = loadQueue();
    if (currentQueue.length === 0) break;

    const entry = currentQueue[0];
    let ok = false;

    try {
      ok = await replayEntry(entry, idRemap);
    } catch (e) {
      console.error('[syncQueue] unexpected error replaying entry:', entry, e);
    }

    if (ok) {
      dequeue(0);
      successCount++;
    } else {
      failCount++;
      break;
    }
  }

  isSyncing = false;

  if (failCount === 0) {
    showNotification(`${successCount} action(s) synchronisée(s)`);
  } else {
    showNotification(`Sync partielle : ${successCount} ok, ${failCount} en échec`);
  }
}

async function replayEntry(entry, idRemap) {
  const { type, payload } = entry;
  const resolvedId = idRemap.has(payload.id) ? idRemap.get(payload.id) : payload.id;

  if (type === 'add') {
    const response = await fetch('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: payload.name })
    });
    if (!response.ok) return false;

    const serverTask = await response.json();
    idRemap.set(payload.localId, serverTask.id);
    const localTask = allTasks.find(t => t.id === payload.localId);
    if (localTask) {
      localTask.id = serverTask.id;
      localTask.completed = serverTask.completed;
      saveTasksToLocal();
      renderTasks();
    }

    patchQueueIds(payload.localId, serverTask.id);

    return true;
  }

  if (type === 'toggle') {
    const task = allTasks.find(t => t.id === resolvedId);
    const completed = task ? task.completed : payload.completed;
    const response = await fetch(`/tasks/${resolvedId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed })
    });
    if (!response.ok) return false;
    const updatedTask = await response.json();
    const localTask = allTasks.find(t => t.id === resolvedId);
    if (localTask) {
      Object.assign(localTask, updatedTask);
      saveTasksToLocal();
      renderTasks();
    }
    return true;
  }

  if (type === 'edit') {
    const task = allTasks.find(t => t.id === resolvedId);
    const name = task ? task.name : payload.name;
    const response = await fetch(`/tasks/${resolvedId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!response.ok) return false;
    const updatedTask = await response.json();
    const localTask = allTasks.find(t => t.id === resolvedId);
    if (localTask) {
      Object.assign(localTask, updatedTask);
      saveTasksToLocal();
      renderTasks();
    }
    return true;
  }

  if (type === 'delete') {
    const response = await fetch(`/tasks/${resolvedId}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 204 && response.status !== 404) return false;
    return true;
  }

  console.warn('[syncQueue] unknown entry type, skipping:', entry);
  return true;
}

function patchQueueIds(oldId, newId) {
  const queue = loadQueue();
  let changed = false;
  queue.forEach(entry => {
    if (entry.payload && entry.payload.id === oldId) {
      entry.payload.id = newId;
      changed = true;
    }
    if (entry.payload && entry.payload.localId === oldId) {
      entry.payload.localId = newId;
      changed = true;
    }
  });
  if (changed) saveQueue(queue);
}

window.addEventListener('online', () => {
  showNotification('Connexion rétablie');
  syncQueue().then(() => {
    return fetch('/tasks');
  }).then(r => r && r.ok ? r.json() : null).then(tasks => {
    if (tasks) {
      allTasks = tasks.map((t, i) => ({ ...t, order: t.order ?? i }));
      saveTasksToLocal();
      renderTasks();
    }
  }).catch(() => {});
});

window.addEventListener('offline', () => {
  showNotification('Hors-ligne — les actions seront synchronisées à la reconnexio');
});

function ensureOrderValues() {
  allTasks.forEach((task, index) => {
    if (task.order === undefined) task.order = index;
  });
}

function compareTasks(a, b) {
  if (a.order !== undefined && b.order !== undefined && a.order !== b.order) {
    return a.order - b.order;
  }

  if (currentSort === 'date-desc') {
    return b.id - a.id;
  } else if (currentSort === 'alpha') {
    return a.name.localeCompare(b.name);
  } else if (currentSort === 'status') {
    if (a.completed === b.completed) return b.id - a.id;
    return a.completed ? 1 : -1;
  }
  return 0;
}

function getVisibleSortedTasks() {
  return allTasks
    .filter(task => {
      if (currentFilter === 'active') return !task.completed;
      if (currentFilter === 'completed') return task.completed;
      return true;
    })
    .sort(compareTasks);
}

function renderTasks() {
  const taskList = document.getElementById('taskList');
  taskList.innerHTML = '';
  const fragment = document.createDocumentFragment();
  const visibleTasks = getVisibleSortedTasks();

  visibleTasks.forEach(task => {
    const li = document.createElement('li');
    li.dataset.id = task.id;
    li.classList.add('task-enter');
    setTimeout(() => li.classList.add('task-enter-active'), 10);

    li.draggable = true;
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('dragleave', handleDragLeave);
    li.addEventListener('drop', handleDrop);
    li.addEventListener('dragend', handleDragEnd);

    const dragHandle = document.createElement('span');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '&#8597;';

    const statusSpan = document.createElement('span');
    statusSpan.textContent = task.completed ? '✓ ' : '✗ ';
    statusSpan.className = 'task-status';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = task.name;
    nameSpan.className = 'task-name';
    if (task.completed) {
      nameSpan.style.textDecoration = 'line-through';
      nameSpan.style.color = 'gray';
    }
    nameSpan.ondblclick = () => editTaskName(task.id, nameSpan);

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = task.completed ? 'Annuler' : 'Terminer';
    toggleBtn.className = 'toggle-btn';
    toggleBtn.onclick = () => toggleTask(task.id);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Supprimer';
    deleteBtn.className = 'delete-btn';
    deleteBtn.onclick = () => deleteTask(task.id);

    li.append(dragHandle, statusSpan, nameSpan, document.createTextNode(' '), toggleBtn, document.createTextNode(' '), deleteBtn);
    fragment.appendChild(li);

    setTimeout(() => li.classList.remove('task-enter', 'task-enter-active'), 350);
  });
  taskList.appendChild(fragment);
}

function handleDragStart(event) {
  dragSrcId = parseInt(this.dataset.id, 10);
  this.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(event) {
  event.preventDefault();
  const targetId = parseInt(this.dataset.id, 10);
  if (targetId !== dragSrcId) {
    const rect = this.getBoundingClientRect();
    const isTopHalf = event.clientY < rect.top + rect.height / 2;
    this.classList.remove('drag-over-top', 'drag-over-bottom');
    this.classList.add(isTopHalf ? 'drag-over-top' : 'drag-over-bottom');
  }
  return false;
}

function handleDragLeave() {
  this.classList.remove('drag-over-top', 'drag-over-bottom');
}

function handleDrop(event) {
  event.stopPropagation();
  event.preventDefault();
  this.classList.remove('drag-over-top', 'drag-over-bottom');

  const targetId = parseInt(this.dataset.id, 10);
  if (dragSrcId === null || dragSrcId === targetId) return;
  ensureOrderValues();

  const rect = this.getBoundingClientRect();
  const isTopHalf = event.clientY < rect.top + rect.height / 2;

  const displayedIds = Array.from(document.querySelectorAll('#taskList li'))
    .map(listItem => parseInt(listItem.dataset.id, 10));

  const srcDisplayedIndex = displayedIds.indexOf(dragSrcId);
  const targetDisplayedIndex = displayedIds.indexOf(targetId);
  if (srcDisplayedIndex === -1 || targetDisplayedIndex === -1) return false;

  const movedDisplayedIds = [...displayedIds];
  movedDisplayedIds.splice(srcDisplayedIndex, 1);

  const targetIndexAfterRemoval = movedDisplayedIds.indexOf(targetId);
  const insertIndex = isTopHalf ? targetIndexAfterRemoval : targetIndexAfterRemoval + 1;
  movedDisplayedIds.splice(insertIndex, 0, dragSrcId);

  const displayedSet = new Set(displayedIds);
  const oldOrderedIds = [...allTasks].sort(compareTasks).map(t => t.id);
  let nextVisibleIndex = 0;
  const mergedIds = oldOrderedIds.map(id => (
    displayedSet.has(id) ? movedDisplayedIds[nextVisibleIndex++] : id
  ));

  const orderById = new Map(mergedIds.map((id, index) => [id, index]));
  allTasks.forEach(task => { task.order = orderById.get(task.id); });
  
  saveTasksToLocal();
  showNotification("Ordre mis à jour");
  renderTasks();
  return false;
}

function handleDragEnd() {
  document.querySelectorAll('#taskList li').forEach(listItem => listItem.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom'));
  dragSrcId = null;
}

function toggleTask(id) {
  const task = allTasks.find(t => t.id === id);
  if (!task) return;
  showLoader();
  task.completed = !task.completed;
  saveTasksToLocal();
  renderTasks();
  hideLoader();

  if (!navigator.onLine) {
    enqueue({ type: 'toggle', payload: { id, completed: task.completed } });
    showNotification('Mise à jour locale (hors-ligne)');
    return;
  }

  fetch(`/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: task.completed })
  })
    .then(response => {
      if (!response.ok) throw new Error("Erreur lors de la modification");
      return response.json();
    })
    .then(updatedTask => {
      Object.assign(task, updatedTask);
      saveTasksToLocal();
      renderTasks();
    })
    .catch(error => {
      console.error("Erreur lors de la modification :", error);
      enqueue({ type: 'toggle', payload: { id, completed: task.completed } });
      showNotification("Mise à jour locale (hors-ligne)");
    });
}

function deleteTask(id) {
  showLoader();

  const li = document.querySelector(`li[data-id='${id}']`);
  const performLocalDelete = () => {
    allTasks = allTasks.filter(t => t.id !== id);
    saveTasksToLocal();
    renderTasks();
    hideLoader();
  };

  const animateAndDelete = (afterFn) => {
    if (li) {
      li.classList.add('task-exit');
      setTimeout(() => li.classList.add('task-exit-active'), 10);
      setTimeout(afterFn, 350);
    } else {
      afterFn();
    }
  };

  if (!navigator.onLine) {
    animateAndDelete(() => {
      performLocalDelete();
      enqueue({ type: 'delete', payload: { id } });
      showNotification('Suppression locale (hors-ligne)');
    });
    return;
  }

  fetch(`/tasks/${id}`, {
    method: 'DELETE'
  })
    .then(response => {
      if (!response.ok && response.status !== 204) {
        throw new Error("Erreur lors de la suppression");
      }
      animateAndDelete(() => {
        performLocalDelete();
        showNotification('Tâche supprimée');
      });
    })
    .catch(error => {
      console.error("Erreur lors de la suppression :", error);
      animateAndDelete(() => {
        performLocalDelete();
        enqueue({ type: 'delete', payload: { id } });
        showNotification("Suppression locale (hors-ligne)");
      });
    });
}

function editTaskName(id, nameSpan) {
  const task = allTasks.find(t => t.id === id);
  if (!task || task.completed) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = task.name;
  input.className = 'edit-task-input';
  nameSpan.replaceWith(input);
  input.focus();

  const saveEdit = () => {
    const newName = input.value.trim();
    if (newName && newName !== task.name) {
      showLoader();
      task.name = newName;
      saveTasksToLocal();
      renderTasks();
      hideLoader();

      if (!navigator.onLine) {
        enqueue({ type: 'edit', payload: { id, name: newName } });
        return;
      }

      fetch(`/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      })
        .then(response => {
        if (!response.ok) throw new Error("Erreur de sauvegarde");
          return response.json();
        })
        .then(updatedTask => {
          Object.assign(task, updatedTask);
          saveTasksToLocal();
          renderTasks();
        })
        .catch(error => {
          console.error("Erreur de modification du nom:", error);
          enqueue({ type: 'edit', payload: { id, name: newName } });
        });
    } else {
      renderTasks(); // Revenir à l'état précédent si vide ou inchangé
    }
  };

  input.onblur = saveEdit;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      input.blur();
    }
    if (e.key === 'Escape') { 
      input.value = task.name; // Annule
      input.blur(); 
    }
  };
}

document.getElementById('addTaskBtn').addEventListener('click', () => {
  const taskInput = document.getElementById('taskInput');
  const name = taskInput.value.trim();
  if (!name) { taskInput.focus(); return; }

  showLoader();
  ensureOrderValues();
  const tempId = Date.now();
  const newTask = { id: tempId, completed: false, name, order: allTasks.length };
  allTasks.push(newTask);
  saveTasksToLocal();
  renderTasks();
  hideLoader();
  taskInput.value = '';

  if (!navigator.onLine) {
    enqueue({ type: 'add', payload: { name, completed: false, order: newTask.order, localId: tempId } });
    showNotification('Tâche ajoutée (hors-ligne)');
    return;
  }

  fetch('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
    .then(response => {
      if (!response.ok) throw new Error("Erreur lors de l'ajout");
      return response.json();
    })
    .then(serverTask => {
      const localTask = allTasks.find(t => t.id === tempId);
      if (localTask) {
        localTask.id = serverTask.id;
        localTask.completed = serverTask.completed;
        saveTasksToLocal();
        renderTasks();
      }
      showNotification('Tâche ajoutée');
    })
    .catch(error => {
      console.error("Erreur lors de l'ajout :", error);
      enqueue({ type: 'add', payload: { name, completed: false, order: newTask.order, localId: tempId } });
      showNotification('Tâche ajoutée (hors-ligne)');
    });
});

// À compléter : Charger les tâches au démarrage
showLoader();
fetch('/tasks')
  .then(response => {
    if (!response.ok) throw new Error("Erreur lors du chargement");
    return response.json();
  })
  .then(tasks => {
    allTasks = tasks.map((t, i) => ({...t, order: t.order ?? i}));
    renderTasks();
    hideLoader();
    saveTasksToLocal();
    if (loadQueue().length > 0) syncQueue();
  })
  .catch(error => {
    hideLoader();
    console.error('Erreur lors du chargement :', error);
    const cachedTasks = loadTasksFromLocal();
    if (cachedTasks) {
      allTasks = cachedTasks.map((t, i) => ({ ...t, order: t.order ?? i }));
      renderTasks();
      showNotification('Tâches chargées depuis la sauvegarde locale');
    }
  });

// Gestionnaires de filtrage
document.getElementById('btnFilterAll').onclick = (e) => setFilter('all', e.target);
document.getElementById('btnFilterActive').onclick = (e) => setFilter('active', e.target);
document.getElementById('btnFilterCompleted').onclick = (e) => setFilter('completed', e.target);

function setFilter(filterType, btnNode) {
  currentFilter = filterType;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  btnNode.classList.add('active');
  renderTasks();
}

// Gestionnaire de tri
document.getElementById('sortSelect').onchange = (e) => {
  currentSort = e.target.value;
  allTasks.forEach(task => delete task.order);
  renderTasks();
  saveTasksToLocal();
};

function showLoader() { document.getElementById('loader').style.display = 'block'; }
function hideLoader() { document.getElementById('loader').style.display = 'none'; }

function showNotification(msg) {
  const container = document.getElementById('notification-container');
  const notif = document.createElement('div');
  notif.className = 'notification';
  notif.textContent = msg;
  container.appendChild(notif);
  setTimeout(() => notif.classList.add('show'), 10);
  setTimeout(() => {
    notif.classList.remove('show');
    setTimeout(() => notif.remove(), 300);
  }, 2000);
}
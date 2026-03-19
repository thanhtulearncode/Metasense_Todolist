let allTasks = [];
let currentFilter = 'all'; // 'all', 'active', 'completed'
let currentSort = 'date-desc'; // 'date-desc', 'alpha', 'status'
let dragSrcId = null; 

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
  fetch(`/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: !task.completed })
  })
    .then(response => {
      if (!response.ok) throw new Error("Erreur lors de la modification");
      return response.json();
    })
    .then(updatedTask => {
      Object.assign(task, updatedTask);
      renderTasks();
      hideLoader();
    })
    .catch(error => {
      hideLoader();
      console.error("Erreur lors de la modification :", error);
    });
}

function deleteTask(id) {
  showLoader();
  fetch(`/tasks/${id}`, { 
    method: 'DELETE' 
    })
    .then(response => {
      if (!response.ok && response.status !== 204) {
        throw new Error("Erreur lors de la suppression");
      }
      const li = document.querySelector(`li[data-id='${id}']`);
      if (li) {
        li.classList.add('task-exit');
        setTimeout(() => li.classList.add('task-exit-active'), 10);
        setTimeout(() => {
          allTasks = allTasks.filter(t => t.id !== id);
          renderTasks();
          hideLoader();
          showNotification('Tâche supprimée');
        }, 350);
      } else {
        allTasks = allTasks.filter(t => t.id !== id);
        renderTasks();
        hideLoader();
        showNotification('Tâche supprimée');
      }
    })
    .catch(error => {
      hideLoader();
      console.error("Erreur lors de la suppression :", error);
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
        renderTasks();
        hideLoader();
      })
      .catch(error => {
        hideLoader();
        console.error("Erreur de modification du nom:", error);
        renderTasks();
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
  if (taskInput.value.trim()) {
    showLoader();
    fetch('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: taskInput.value.trim() })
    })
      .then(response => {
        if (!response.ok) throw new Error("Erreur lors de l'ajout");
        return response.json();
      })
      .then(task => {
        taskInput.value = '';
        // À compléter : Ajouter la tâche à l'interface
        ensureOrderValues();
        task.order = allTasks.length;
        allTasks.push(task);
        renderTasks();
        hideLoader();
        showNotification('Tâche ajoutée');
      })
      .catch(error => {
        hideLoader();
        console.error("Erreur lors de l'ajout :", error);
      });
  } else {
    taskInput.focus();
  }
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
  })
  .catch(error => {
    hideLoader();
    console.error('Erreur lors du chargement :', error);
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
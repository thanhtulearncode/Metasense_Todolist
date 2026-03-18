let allTasks = [];
let currentFilter = 'all'; // 'all', 'active', 'completed'
let currentSort = 'date-desc'; // 'date-desc', 'alpha', 'status'

function renderTasks() {
  const taskList = document.getElementById('taskList');
  taskList.innerHTML = '';

  const filteredTasks = allTasks.filter(task => {
    if (currentFilter === 'active') return !task.completed;
    if (currentFilter === 'completed') return task.completed;
    return true;
  });

  filteredTasks.sort((a, b) => {
    if (currentSort === 'date-desc') {
      return b.id - a.id;
    } else if (currentSort === 'alpha') {
      return a.name.localeCompare(b.name);
    } else if (currentSort === 'status') {
      if (a.completed === b.completed) return b.id - a.id;
      return a.completed ? 1 : -1;
    }
  });

  filteredTasks.forEach(task => {
    const li = document.createElement('li');
    li.dataset.id = task.id;

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

    li.appendChild(statusSpan);
    li.appendChild(nameSpan);
    li.appendChild(document.createTextNode(' '));
    li.appendChild(toggleBtn);
    li.appendChild(document.createTextNode(' '));
    li.appendChild(deleteBtn);

    taskList.appendChild(li);
  });
}

function toggleTask(id) {
  const task = allTasks.find(t => t.id === id);
  if (!task) return;
  fetch(`/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: !task.completed })
  })
    .then(response => response.json())
    .then(updatedTask => {
      Object.assign(task, updatedTask);
      renderTasks();
    })
    .catch(error => console.error("Erreur lors de la modification :", error));
}

function deleteTask(id) {
  fetch(`/tasks/${id}`, {
    method: 'DELETE'
  })
    .then(() => {
      allTasks = allTasks.filter(t => t.id !== id);
      renderTasks();
    })
    .catch(error => console.error("Erreur lors de la suppression :", error));
}

function editTaskName(id, nameSpan) {
  const task = allTasks.find(t => t.id === id);
  if (!task || task.completed) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = task.name;
  input.className = 'edit-task-input';
  input.style.width = '150px';
  nameSpan.replaceWith(input);
  input.focus();

  const saveEdit = () => {
    const newName = input.value.trim();
    if (newName && newName !== task.name) {
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
      })
      .catch(error => {
        console.error("Erreur de modification du nom:", error);
        renderTasks();
      });
    } else {
      renderTasks(); // Revenir à l'état précédent si vide ou inchangé
    }
  };

  input.addEventListener('blur', saveEdit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      input.value = task.name; // Annule
      input.blur();
    }
  });
}

document.getElementById('addTaskBtn').addEventListener('click', () => {
  const taskInput = document.getElementById('taskInput');
  if (taskInput.value.trim()) {
    fetch('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: taskInput.value.trim() })
    })
      .then(response => response.json())
      .then(task => {
        taskInput.value = '';
        // À compléter : Ajouter la tâche à l'interface
        allTasks.push(task);
        renderTasks();
      })
      .catch(error => console.error("Erreur lors de l'ajout :", error));
  } else {
    taskInput.focus();
  }
});

// À compléter : Charger les tâches au démarrage
fetch('/tasks')
  .then(response => response.json())
  .then(tasks => {
    allTasks = tasks;
    renderTasks();
  })
  .catch(error => console.error('Erreur lors du chargement :', error));

// Gestionnaires de filtrage
document.getElementById('btnFilterAll').addEventListener('click', (e) => setFilter('all', e.target));
document.getElementById('btnFilterActive').addEventListener('click', (e) => setFilter('active', e.target));
document.getElementById('btnFilterCompleted').addEventListener('click', (e) => setFilter('completed', e.target));

function setFilter(filterType, btnNode) {
  currentFilter = filterType;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  btnNode.classList.add('active');
  renderTasks();
}

// Gestionnaire de tri
document.getElementById('sortSelect').addEventListener('change', (e) => {
  currentSort = e.target.value;
  renderTasks();
});

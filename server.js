const express = require('express');
const app = express();
const port = 3000;

// Base de données simulée
let tasks = [
  { id: 1, name: "Exemple de tâche", completed: false }
];

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Routes API
app.get('/tasks', (req, res) => res.json(tasks));
app.post('/tasks', (req, res) => {
  if (!req.body.name || req.body.name.trim() === '') {
    return res.status(400).json({ error: "Le texte de la tâche est manquant." });
  }
  const task = { id: Date.now(), completed: false, name: req.body.name.trim() };
  tasks.push(task);
  res.status(201).json(task);
});

app.put('/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const task = tasks.find(t => t.id === id);
  if (task) {
    if (req.body.name !== undefined) {
      if (req.body.name.trim() === '') {
        return res.status(400).json({ error: "Le texte de la tâche est manquant." });
      }
      task.name = req.body.name.trim();
    }
    if (req.body.completed !== undefined) {
      task.completed = req.body.completed;
    }
    res.json(task);
  } else {
    res.status(404).json({ error: "Tâche non trouvée" });
  }
});

app.delete('/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const taskIndex = tasks.findIndex(t => t.id === id);
  if (taskIndex !== -1) {
    tasks.splice(taskIndex, 1);
    res.status(204).send();
  } else {
    res.status(404).json({ error: "Tâche non trouvée" });
  }
});

// Démarrage du serveur
app.listen(port, () => console.log(`Serveur démarré sur http://localhost:${port}`));

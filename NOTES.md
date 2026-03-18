# Notes du Test Technique
## Choix Techniques & Remarques
### Front-end
- **Ajout & Affichage** : L'application est devenue entièrement dynamique et ne recharge jamais la page. L'interface (statuts `✓`/`✗`, boutons Terminer/Supprimer) se met à jour instantanément.
- **Filtrage** : J'ai fait le choix d'un filtrage **côté client**. Les tâches sont stockées en mémoire (`allTasks`), ce qui rend la navigation entre les filtres (Toutes / En cours / Terminées) instantanée et évite de surcharger le serveur avec des requêtes API inutiles.
- **Édition & UX** : Double-cliquer sur le titre d'une tâche le transforme en champ `<input>`. La sauvegarde se fait au clic-extérieur (blur) ou via la touche `Enter`. La modification est annulable via `Escape`.
    - *Choix Qualité* : Une tâche "Terminée" ne peut pas être éditée afin d'encourager la cohérence. De plus, la mise à jour (via `PUT`) vérifie en temps réel que le nouveau nom n'est pas vide avant de déclencher l'API, avec une "fallback" d'annulation en cas d'erreur.
- **Tri** : Ajout d'une liste déroulante (`<select>`) pour trier les tâches affichées. Ce tri est également géré **côté client** sans faire appel au serveur. Les trois méthodes implémentées utilisent les propriétés natives de JS (`sort` et `localeCompare`) :
    - Plus récent (par défaut) : Tri inversé sur la propriété `id` (qui correspond au `Date.now()` de la création).
    - Alphabétique : Utilisation de `localeCompare` sur le texte.
    - Par statut : Regroupe d'abord les tâches "En cours" puis les tâches "Terminées" (avec un sous-tri chronologique pour la stabilité).
### Back-end
- Complétion de l'API avec les méthodes `PUT /tasks/:id` et `DELETE /tasks/:id`.
- **Gestion d'erreurs 400** : Protège la route `POST` contre l'ajout de tâches sans nom ou vides.
- **Gestion d'erreurs 404** : Les routes `PUT` et `DELETE` incluent des vérifications d'existence de l'index des tâches avant d'agir, renvoyant une 404 si la tâche n'est pas trouvée.
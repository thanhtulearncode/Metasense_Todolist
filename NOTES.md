# Notes du Test Technique
## Choix Techniques & Remarques
### Front-end
- **Ajout & Affichage** : L'application est devenue entièrement dynamique et ne recharge jamais la page. L'interface (statuts `✓`/`✗`, boutons Terminer/Supprimer) se met à jour instantanément.
    - *Animation* : L'ajout d'une tâche déclenche une animation d'apparition fluide (transition CSS) pour améliorer l'expérience utilisateur.
    - *Loader* : Lors des opérations asynchrones (ajout, modification, suppression), un loader animé s'affiche pendant la requête API puis est masqué au succès comme en cas d'erreur.
    - *Notification* : Après chaque ajout, suppression et réordonnancement, une notification visuelle (toast) confirme l'action à l'utilisateur et améliore le feedback de l'interface.
    - *Robustesse* : Après validation côté client (nom non vide), la tâche est ajoutée via l'API puis insérée dans la liste locale `allTasks` ; l'affichage est mis à jour sans rechargement, avec repli visuel en cas d'échec API.
- **Filtrage** : J'ai fait le choix d'un filtrage **côté client**. Les tâches sont stockées en mémoire (`allTasks`), ce qui rend la navigation entre les filtres (Toutes / En cours / Terminées) instantanée et évite de surcharger le serveur avec des requêtes API inutiles.
- **Édition & UX** : Double-cliquer sur le titre d'une tâche le transforme en champ `<input>`. La sauvegarde se fait au clic-extérieur (blur) ou via la touche `Enter`. La modification est annulable via `Escape`.
    - Une tâche "Terminée" ne peut pas être éditée afin d'encourager la cohérence. De plus, la mise à jour (via `PUT`) vérifie en temps réel que le nouveau nom n'est pas vide avant de déclencher l'API, avec une "fallback" d'annulation en cas d'erreur.
- **Tri** : Ajout d'une liste déroulante (`<select>`) pour trier les tâches affichées. Ce tri est également géré **côté client** sans faire appel au serveur. Les trois méthodes implémentées utilisent les propriétés natives de JS (`sort` et `localeCompare`) :
    - Plus récent (par défaut) : Tri inversé sur la propriété `id` (qui correspond au `Date.now()` de la création).
    - Alphabétique : Utilisation de `localeCompare` sur le texte.
    - Par statut : Regroupe d'abord les tâches "En cours" puis les tâches "Terminées" (avec un sous-tri chronologique pour la stabilité).
- **Drag-and-drop** : Ajout d'un déplacement manuel des tâches avec poignée de drag (`↕`) et indication visuelle de position d'insertion.
    - *Insertion précise* : Le drop ne fait pas un simple swap ; la position est calculée selon la moitié haute/basse de l'élément survolé (`clientY` vs milieu de la ligne) pour insérer avant/après.
    - *Cohérence avec filtres* : Le réordonnancement s'applique à la liste visible tout en conservant l'ordre relatif des tâches masquées (ex: filtre "En cours" actif).
    - *Persistance locale d'ordre* : Utilisation d'une propriété `order` côté client pour prioriser le tri manuel ; un toast confirme la mise à jour (`Ordre mis à jour`).
### Back-end
- Complétion de l'API avec les méthodes `PUT /tasks/:id` et `DELETE /tasks/:id`.
- **Gestion d'erreurs 400** : Protège la route `POST` contre l'ajout de tâches sans nom ou vides.
- **Gestion d'erreurs 404** : Les routes `PUT` et `DELETE` incluent des vérifications d'existence de l'index des tâches avant d'agir, renvoyant une 404 si la tâche n'est pas trouvée.
# Notes du Test Technique

## Temps de travail

| # | Fonctionnalité | Statut | Durée estimée | Remarques |
|---|---|---|---|---|
| 1 | **Ajout de tâches** | Obligatoire | ~20 min | Validation nom vide, `POST /tasks`, refresh dynamique |
| 2 | **Affichage des tâches** | Obligatoire | ~20 min | Statuts ✓/✗, boutons Terminer (`PUT`) et Supprimer (`DELETE`) |
| 3 | **Filtrage** | Obligatoire | ~20 min | 3 boutons, filtrage côté client sur `allTasks` |
| 4 | **Gestion des erreurs back-end** | Obligatoire | ~20 min | 400 sur nom vide, 404 sur id inexistant |
| 5 | **Édition de tâches** | Facultatif | ~45 min | Double-clic, input inline, blur/Enter/Escape, verrou sur tâche terminée |
| 6 | **Tri des tâches** | Facultatif | ~30 min | 3 critères (date, alpha, statut), `<select>`, tri client |
| 7 | **Animations CSS** | Facultatif | ~30 min | Transitions apparition/disparition, spinner loader |
| 8 | **Notifications** | Facultatif | ~20 min | Toasts pour ajout, suppression, sync, drag & drop |
| 9 | **Drag & Drop** | Facultatif | ~1 h 30 | Poignée ↕, insertion haut/bas, cohérence avec filtres actifs |
| 10 | **Sauvegarde locale** | Facultatif | ~1 h 30 | Cache `localStorage`, queue offline, sync au retour connexion, remapping d'ids |
| 11 | **Dark mode** | Facultatif | ~30 min | Variables CSS, toggle ☀️/🌙, détection `prefers-color-scheme` |
| | **Total** | | **~7 h** | |

---

## Choix Techniques & Remarques

### Qualité du code & bonnes pratiques

- **Séparation des responsabilités** : chaque fonction a un rôle unique et délimité (`renderTasks`, `toggleTask`, `syncQueue`, etc.). Les effets de bord (DOM, `localStorage`, réseau) sont isolés et ne se mélangent pas.
- **Pas de duplication** : les chemins en ligne et hors-ligne partagent les mêmes fonctions locales (`performLocalDelete`, `animateAndDelete`) ; le CSS repose sur des variables plutôt que sur des règles répétées.
- **Robustesse des entrées** : validation côté client (nom non vide) avant tout appel réseau ou écriture locale ; les `try/catch` entourent tous les accès `localStorage` pour absorber les erreurs de quota ou de mode privé.
- **Cohérence de l'état** : `allTasks` est la source de vérité unique en mémoire ; `localStorage` n'est qu'un miroir mis à jour après chaque mutation, jamais consulté en cours d'opération.
- **Lisibilité** : le code est découpé en sections commentées (ordering, rendering, drag & drop, task actions, initial load) pour faciliter la navigation et la maintenance.

### Front-end
- **Ajout & Affichage** : L'application est devenue entièrement dynamique et ne recharge jamais la page. L'interface (statuts `✓`/`✗`, boutons Terminer/Supprimer) se met à jour instantanément.
    - *Animation* : L'ajout d'une tâche déclenche une animation d'apparition fluide (transition CSS) pour améliorer l'expérience utilisateur.
    - *Loader* : Lors des opérations asynchrones (modification du nom, chargement initial), un loader animé s'affiche pendant la requête API puis est masqué au succès comme en cas d'erreur. Pour l'ajout et le toggle, la mise à jour étant optimiste (locale immédiate), le loader s'affiche et se masque avant le fetch — son rôle est donc purement visuel pour ces cas.
    - *Notification* : Après chaque ajout, suppression et réordonnancement, une notification visuelle (toast) confirme l'action à l'utilisateur et améliore le feedback de l'interface.
    - *Robustesse* : Après validation côté client (nom non vide), la tâche est insérée immédiatement dans `allTasks` avec un id temporaire (`Date.now()`), puis confirmée par `POST /tasks` qui remplace cet id par l'id serveur. En cas d'échec réseau, la tâche reste visible et l'action est mise en queue pour synchronisation ultérieure.
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
- **Sauvegarde locale & synchronisation différée** : Les tâches sont persistées dans `localStorage` (`todo_tasks_local_v1`) après chaque opération. Au démarrage, si `GET /tasks` échoue, l'app charge ce cache et reste fonctionnelle hors-ligne.
    - *Queue de synchronisation* : Toute action effectuée hors-ligne (ajout, toggle, édition, suppression) est empilée dans une queue persistante (`todo_sync_queue_v1`). La queue est rejouée automatiquement au retour de la connexion via le listener `window.addEventListener('online', ...)`, puis un `GET /tasks` réconcilie l'état complet depuis le serveur.
    - *Optimistic UI* : Les actions sont appliquées localement en premier (mise à jour immédiate de l'interface), puis envoyées au serveur. En cas d'échec réseau, l'entrée est enqueue pour la prochaine synchronisation — aucune saisie n'est perdue.
    - *Remapping d'id temporaires* : Une tâche ajoutée hors-ligne reçoit un id temporaire (`Date.now()`). Lors de la sync, le `POST` retourne l'id définitif du serveur ; l'id local est remplacé dans `allTasks`, dans le cache et dans les entrées suivantes de la queue (`patchQueueIds`) pour éviter toute désynchronisation.
    - *Robustesse de la queue* : Le replay est séquentiel et s'arrête à la première erreur pour préserver l'ordre causal des opérations. Un flag `isSyncing` empêche les doubles exécutions concurrentes. Les entrées de type inconnu sont ignorées sans bloquer la suite.
    - *Feedback utilisateur* : Les événements `online`/`offline` déclenchent des notifications toast. Le résultat de la synchronisation (succès total ou partiel) est également notifié.
    - *Démarrage avec queue résiduelle* : Si le chargement initial réussit mais qu'une queue existe encore (session précédente interrompue hors-ligne), `syncQueue()` est appelée immédiatement pour vider les actions en attente.

- **Dark mode** : Un bouton toggle (☀️ / 🌙) placé dans l'en-tête bascule le thème clair/sombre. Le choix est persisté dans `localStorage` (`todo_theme_v1`) et restauré immédiatement au chargement via une IIFE, avant tout rendu, pour éviter le flash de thème incorrect.
    - *Détection système* : En l'absence de préférence sauvegardée, le thème initial est déterminé par `window.matchMedia('(prefers-color-scheme: dark)')`, respectant ainsi le réglage OS de l'utilisateur.
    - *Architecture CSS* : Toutes les couleurs sont portées par des variables CSS (`:root` pour le mode clair, `body.dark` pour le mode sombre). Basculer le thème revient uniquement à toggler la classe `dark` sur `<body>` — aucune règle n'est dupliquée. Les transitions `0.3s` sur `background-color` et `color` rendent le changement fluide.
    - *Couverture complète* : Le refactoring CSS a fusionné toutes les règles dupliquées du boilerplate (7 sélecteurs en double) et migré toutes les couleurs fixes vers des variables — `border`, couleurs de drag handle, `loader-track` inclus. Aucune valeur de couleur fixe ne subsiste hors des accents (`#3498db`) et des notifications.

### Back-end
- Complétion de l'API avec les méthodes `PUT /tasks/:id` et `DELETE /tasks/:id`.
- **Gestion d'erreurs 400** : Protège la route `POST` contre l'ajout de tâches sans nom ou vides.
- **Gestion d'erreurs 404** : Les routes `PUT` et `DELETE` incluent des vérifications d'existence de l'index des tâches avant d'agir, renvoyant une 404 si la tâche n'est pas trouvée.
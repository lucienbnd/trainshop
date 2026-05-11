# Stratégie d'observabilité — TrainShop API

## Mission 1 — Analyse de la CI existante

### Ce que la CI GitHub Actions vérifie

| Étape | Ce qui est vérifié |
|-------|-------------------|
| `npm ci` | Les dépendances s'installent proprement et de manière reproductible |
| `npm run lint` | Le code respecte les règles ESLint (qualité et cohérence) |
| `npm test` | Les routes principales fonctionnent selon les tests automatisés |
| `docker build` | L'image Docker se construit sans erreur |
| `docker run` | Le container démarre correctement |
| `curl /health` | L'API répond et le processus est vivant |
| `curl /ready` | L'API est connectée à la base de données et prête à recevoir du trafic |
| `curl /products` | Une route métier répond correctement |

---

## Mission 2 — Limites de la CI

Une CI verte est un bon signal, mais elle ne garantit pas tout.

| Limite | Explication |
|--------|-------------|
| Performances | La CI ne simule pas de charge réelle. Un temps de réponse correct en CI peut se dégrader sous 1 000 utilisateurs simultanés. |
| Volumes réels | Les tests utilisent des données mockées, pas les volumes de production. |
| Routes métier critiques | La CI teste `/products`, mais pas `/orders` ni `/checkout`. Une régression sur le paiement peut passer inaperçue. |
| Stabilité dans le temps | La CI dure quelques minutes. Elle ne détecte pas les fuites mémoire ou la dégradation sur plusieurs heures. |
| Dépendances externes | En CI, les services externes (paiement, email) sont absents ou mockés. Ils peuvent échouer en production. |
| Impact business | La CI ne mesure pas si le nombre de commandes chute après un déploiement. |

---

## Mission 3 — Stratégie d'observabilité minimale

### Logs à produire

| Type | Informations attendues | Pourquoi |
|------|----------------------|----------|
| Démarrage | service, version, port, environnement | Savoir quelle version tourne |
| Requête | méthode, route, statut HTTP, durée | Comprendre le trafic et détecter les lenteurs |
| Erreur | route, message, request ID | Diagnostiquer rapidement |
| Dépendance | base de données OK/KO, timeout externe | Identifier une cause externe |
| Métier | commande créée, paiement refusé | Mesurer l'impact réel sur les utilisateurs |

**Important :** ne jamais logger de secrets, mots de passe, tokens, chaînes de connexion ou données personnelles.

### Métriques techniques à suivre

- Disponibilité de `/health`
- Nombre de requêtes par minute
- Taux d'erreurs 4xx et 5xx (par route)
- Temps de réponse moyen et p95
- CPU et RAM du container
- Nombre de redémarrages du container

### Métriques métier à suivre

- Nombre de produits consultés
- Nombre de commandes créées
- Nombre de checkouts réussis / échoués
- Taux de conversion panier → commande

### Alertes actionnables

| Alerte | Seuil | Durée | Première action |
|--------|-------|-------|----------------|
| `/health` ne répond plus | 0 réponse | 1 min | Vérifier le container (`docker ps`, `docker logs`) |
| Taux 5xx en hausse | > 5 % des requêtes | 5 min | Lire les logs, analyser la route concernée |
| Temps de réponse p95 élevé | > 2 s | 5 min | Vérifier CPU/RAM (`docker stats`) |
| Redémarrages du container | > 3 en 10 min | — | Lire les logs de crash, identifier la cause |
| Chute des commandes | > 30 % de baisse | 10 min | Vérifier `/orders`, envisager rollback |

### Dashboard minimal

| Bloc | Indicateurs |
|------|-------------|
| Santé | `/health` statut, uptime, version déployée |
| Erreurs | Taux 4xx, taux 5xx, erreurs par route |
| Performance | Latence moyenne, p95, p99 |
| Ressources | CPU, RAM, redémarrages container |
| Métier | Commandes créées, checkouts, taux de conversion |

### Checklist post-déploiement

- [ ] La CI GitHub Actions est verte
- [ ] La bonne image Docker est déployée (vérifier le tag / SHA)
- [ ] Le container tourne (`docker ps`)
- [ ] `/health` répond avec status `ok`
- [ ] `/ready` répond avec status `ready`
- [ ] Les derniers logs du container ne contiennent pas d'erreurs (`docker logs --tail 50`)
- [ ] Le taux d'erreurs 5xx est stable
- [ ] Le temps de réponse est normal
- [ ] Les métriques métier (commandes, checkouts) sont stables

---

## Conception des healthchecks

### Consigne 1 — Endpoint `/health`

`/health` vérifie que le **processus applicatif est vivant**. Il doit répondre vite, sans dépendance externe.

```json
{
  "status": "ok",
  "service": "trainshop-api",
  "version": "1.0.0",
  "environment": "production",
  "timestamp": "2026-05-11T10:00:00.000Z",
  "uptime": 3600
}
```

Règles : réponse courte, rapide, sans secret, sans chaîne de connexion.

### Consigne 2 — Endpoint `/ready`

`/ready` vérifie que l'application est **prête à recevoir du trafic**. Il teste les dépendances critiques.

```json
{
  "status": "ready",
  "service": "trainshop-api",
  "version": "1.0.0",
  "timestamp": "2026-05-11T10:00:00.000Z",
  "checks": {
    "database": "ok",
    "env": "ok"
  }
}
```

Si une dépendance est indisponible :

```json
{
  "status": "not ready",
  "service": "trainshop-api",
  "version": "1.0.0",
  "timestamp": "2026-05-11T10:00:00.000Z",
  "checks": {
    "database": "unavailable",
    "env": "ok"
  }
}
```

### Consigne 3 — Comportements attendus en cas d'échec

| Scénario | `/health` | `/ready` | État |
|----------|-----------|----------|------|
| Application ne répond plus | 503 ou pas de réponse | 503 ou pas de réponse | Indisponible |
| Base de données inaccessible | 200 (processus vivant) | 503 | Dégradé — ne pas envoyer de trafic |
| Cache indisponible (non critique) | 200 | 200 avec warning | Dégradé mais fonctionnel |
| Service de paiement en timeout | 200 | 503 | Dégradé — `/checkout` va échouer |
| Variable d'environnement manquante | 200 | 503 | Non prêt |
| Version déployée incorrecte | 200 | 200 | Vérifier `version` dans la réponse |
| Temps de réponse trop long | 200 (lent) | 200 (lent) | Dégradé — surveiller les métriques |

### Consigne 4 — Intégration dans GitHub Actions

Ordre logique des contrôles dans la CI :

1. Construction de l'image Docker
2. Lancement du container
3. Attente courte du démarrage (5 secondes)
4. Appel de `/health` — vérifie que le processus tourne
5. Appel de `/ready` — vérifie que les dépendances sont disponibles
6. Appel d'une route métier (`/products`) — vérifie le fonctionnement réel
7. Affichage des logs en cas d'échec (`if: failure()`)
8. Arrêt et nettoyage du container (`if: always()`)

Si un contrôle échoue : le workflow s'arrête, les logs de diagnostic sont affichés, le container est nettoyé, la version n'est pas validée.

### Consigne 5 — Logs de diagnostic en cas d'échec

En cas d'échec dans la CI, les informations suivantes sont affichées automatiquement :

```bash
docker ps -a                          # containers actifs
docker inspect trainshop-test         # état détaillé du container
docker logs --tail 50 trainshop-test  # derniers logs
curl -s http://localhost:3000/health  # réponse de /health
curl -s http://localhost:3000/ready   # réponse de /ready
```

Ces informations permettent de savoir immédiatement si le container a crashé, si la DB était inaccessible, ou si l'API a renvoyé une erreur.

---

## Améliorations proposées du workflow CI/CD

| Amélioration | Intérêt |
|-------------|---------|
| Tag Docker avec le SHA du commit | Savoir exactement quelle version a été construite et déployée |
| Tester `/ready` en plus de `/health` | Vérifier que les dépendances sont disponibles, pas seulement que le processus tourne |
| Tester une route métier (`/products`) | S'assurer qu'une route réelle fonctionne avec la base de données |
| Afficher les logs de diagnostic en cas d'échec | Permettre au développeur de comprendre l'erreur sans accès au serveur |
| Nettoyer le container avec `if: always()` | Éviter les containers orphelins même si le workflow échoue |

---

## Analyse de l'incident

**Situation :** CI verte, image `trainshop-api:1.3.0` déployée, mais `POST /orders` échoue parfois.

### 1. Pourquoi la CI n'a pas détecté ce problème

La CI testait uniquement `/health` et `/products`. Elle ne testait pas `/orders`. Un bug sur une route non testée en CI peut passer complètement inaperçu.

### 2. Pourquoi `/health` répond OK malgré l'incident

`/health` vérifie uniquement que le **processus est vivant**. Il ne vérifie pas la logique métier des routes. L'application peut répondre 200 sur `/health` et échouer sur `/orders` simultanément.

### 3. Logs à consulter en priorité

```bash
docker logs --tail 100 trainshop-api  # erreurs récentes
docker logs trainshop-api | grep "POST /orders"  # requêtes concernées
```

Chercher : message d'erreur, stack trace, route, timestamp, fréquence.

### 4. Métriques à consulter en priorité

- Taux d'erreurs 5xx sur `/orders`
- Nombre de commandes créées (métrique métier — chute visible)
- Temps de réponse sur `/orders`
- CPU / RAM du container (si ressource insuffisante)

### 5. Hypothèse de cause

Erreur de logique introduite dans la version 1.3.0 sur la route `/orders` : validation incorrecte, requête SQL échouant sur certains cas, ou dépendance externe instable (service de stock ou de paiement).

### 6. Décision : rollback, hotfix ou surveillance

- Si l'erreur touche > 10 % des commandes → **rollback immédiat** vers la version précédente
- Si l'erreur est rare et compréhensible → **hotfix** rapide avec déploiement urgent
- Si l'erreur semble disparaître → **surveillance renforcée** 30 min avant toute décision

### 7. Amélioration de la CI pour éviter ce cas

Ajouter un test automatisé sur `POST /orders` dans la CI (cas valide + cas invalide). Ainsi, toute régression sur cette route serait détectée avant le déploiement.

### 8. Amélioration du monitoring

Ajouter une alerte sur le nombre de commandes créées : si ce nombre chute de plus de 30 % dans les 10 minutes suivant un déploiement, déclencher une alerte immédiate.

# TrainShop Starter

API de gestion de produits fictifs (billets de train, guides DevOps) utilisée comme support pédagogique pour apprendre Docker et GitHub Actions.

## Routes disponibles

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/health` | Vérifie que l'API et la base de données fonctionnent |
| GET | `/products` | Retourne la liste des produits |
| GET | `/products/:id` | Retourne un produit par son identifiant |
| POST | `/products` | Crée un nouveau produit |
| GET | `/about` | Informations sur le projet |

### Exemple — créer un produit

```bash
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Billet test","description":"Description","price_cents":1500,"stock":10}'
```

## Installation

```bash
cd api
npm install
```

## Lancer l'API en local (avec Docker Compose)

```bash
cp .env.example .env
docker compose up -d --build
```

L'API est accessible sur `http://localhost:3000`, le frontend sur `http://localhost:8081`.

## Lancer les tests

```bash
cd api
npm test
```

## Vérifier la qualité du code

```bash
cd api
npm run lint
```

## Docker — construire et lancer l'image de l'API

```bash
docker build -t trainshop-api ./api

docker run -d \
  --name trainshop-api \
  -p 3000:3000 \
  -e DATABASE_URL=postgres://trainshop:trainshop_password@localhost:5432/trainshop \
  trainshop-api
```

Tester depuis le container :

```bash
curl http://localhost:3000/health
```

## CI GitHub Actions

Le workflow `.github/workflows/ci.yml` s'exécute automatiquement à chaque push ou pull request sur `main`.

### Étapes

| Job | Étapes |
|-----|--------|
| **Tester API** | Checkout → Node.js → `npm ci` → lint → tests |
| **Vérifier les builds Docker** | Checkout → build image API → lancer container → attendre → tester `/health` → nettoyage → build image frontend |

### Interpréter le résultat

- **CI verte** : le code est propre, les tests passent, l'image se construit et le container démarre correctement.
- **CI rouge** : une étape a échoué. Consulter les logs dans l'onglet **Actions** de GitHub pour identifier l'étape en cause.

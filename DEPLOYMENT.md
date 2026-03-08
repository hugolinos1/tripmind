# 🚀 Déploiement TripMind

## Problème SQLite en production

SQLite **ne fonctionne pas** sur Vercel/Netlify car le système de fichiers est éphémère. Les données sont perdues à chaque déploiement.

## ✅ Solution : PostgreSQL (Supabase)

### Étape 1 : Créer une base de données Supabase

1. Allez sur [supabase.com](https://supabase.com) et créez un compte gratuit
2. Créez un nouveau projet
3. Allez dans **Settings** → **Database**
4. Copiez l'**URI de connexion** (format `postgresql://postgres:...`)

### Étape 2 : Configurer les variables d'environnement

Sur **Vercel** ou **Netlify**, ajoutez ces variables :

| Variable | Valeur |
|----------|--------|
| `DATABASE_URL` | `postgresql://postgres:PASSWORD@db.XXX.supabase.co:5432/postgres` |
| `DIRECT_DATABASE_URL` | `postgresql://postgres:PASSWORD@db.XXX.supabase.co:5432/postgres` |
| `OPENROUTER_API_KEY` | `sk-or-v1-votre-cle-api` |

### Étape 3 : Initialiser la base de données

Après le premier déploiement, exécutez la migration Prisma :

**Sur Vercel** :
1. Installez Vercel CLI : `npm i -g vercel`
2. Liez le projet : `vercel link`
3. Exécutez : `vercel env pull .env.local`
4. Exécutez : `npx prisma db push`

**Ou via l'interface Supabase** :
1. Allez dans **SQL Editor**
2. Collez le schéma généré par `npx prisma migrate --create-only`

### Étape 4 : Redéployer

Redéployez votre application pour appliquer les changements.

---

## 📝 Variables d'environnement requises

```env
# Base de données PostgreSQL
DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
DIRECT_DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"

# IA OpenRouter
OPENROUTER_API_KEY="sk-or-v1-votre-cle-api"

# URL de l'application (optionnel)
NEXT_PUBLIC_URL="https://votre-app.vercel.app"
```

---

## 🔧 Commandes utiles

```bash
# Générer le client Prisma
npx prisma generate

# Pousser le schéma vers la base
npx prisma db push

# Voir les données
npx prisma studio

# Créer une migration
npx prisma migrate dev --name init
```

---

## ❓ Problèmes courants

### "Can't reach database server"
- Vérifiez que l'URI PostgreSQL est correct
- Vérifiez que l'IP est autorisée dans Supabase (Settings → Database → Connection Pooling)

### "Authentication failed"
- Vérifiez le mot de passe dans l'URI
- Assurez-vous d'utiliser le mot de passe de la base de données, pas celui du compte

### Les données disparaissent
- Vous utilisez probablement SQLite en local
- Utilisez PostgreSQL en production

---

## 🆓 Alternatives gratuites à Supabase

- [Vercel Postgres](https://vercel.com/storage/postgres) (si déployé sur Vercel)
- [Neon](https://neon.tech) - PostgreSQL serverless
- [Railway](https://railway.app) - PostgreSQL gratuit
- [PlanetScale](https://planetscale.com) - MySQL serverless

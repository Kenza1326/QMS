# 📋 Portail de Consultation des Tickets (Achat, Approvisionnement & Facturation)

Application web moderne (Single Page Application - React & TypeScript) dédiée à la **consultation, au filtrage avancé et à l'exportation des dossiers et tickets de processus métier** (Achat, Approvisionnement, Facturation) intégrée avec **Kofax TotalAgility (KTA)** et **Microsoft SQL Server**.

---

## 🎯 Fonctionnalités Clés

- **Tableau de Bord & Métriques en Temps Réel** :
  - Indicateurs de volumétrie par statut et par type de flux (Achat, Approvisionnement, Facturation).
  - Contrôle d'accès basé sur les rôles et groupes utilisateurs (RBAC / `GroupFluxMapping`).
- **Filtrage Multicritère & Recherche Rapide** :
  - Recherche instantanée par N° de ticket, dossier, prestataire, montant, demandeur ou intervenant.
  - Filtres contextuels par plage de dates, départements, devises et statuts.
- **Fiche Détaillée & Fiche de Consultation** :
  - Visualisation des données administratives et comptables (Montant HT/TTC, devise, structure, lignes budgétaires).
  - Fournisseurs & prestataires associés.
  - Historique d'audit et journal des événements d'exécution.
  - **Compléments d'Information** : Suivi des demandes de pièces et d'informations complémentaires (`dbo.DemandesComplement`) avec badges de statut et horodatages.
- **Exportations Multi-formats** :
  - Export Excel (`.xlsx`) structuré multi-onglets (Données générales, Fournisseurs, Compléments, Historique).
  - Export CSV et impression directe.
- **Compatibilité 100% On-Premise & Offline** :
  - Aucune dépendance CDN externe au runtime.
  - Prêt pour un déploiement sous Microsoft IIS en réseau fermé d'entreprise.

---

## 🛠️ Stack Technique

- **Frontend** : React 18, TypeScript, Vite
- **Styling** : Tailwind CSS v4, Lucide React (icônes vectorielles locales)
- **Export & Données** : XLSX (SheetJS), Canvas Confetti
- **Backend & Données d'Entreprise** :
  - Kofax TotalAgility (KTA) SDK / REST & Forms API
  - Microsoft SQL Server (Procédure stockée `sp_GetTicketDetail_Consultation` & `sp_SearchTickets_Consultation`)

---

## 🚀 Installation & Démarrage en Développement

### 1. Cloner ou ouvrir le projet

```bash
cd /chemin/vers/le/projet
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Lancer le serveur de développement

```bash
npm run dev
```

L'application est accessible localement sur `http://localhost:3000`.

---

## 📦 Build & Déploiement en Production (IIS / On-Premise)

### 1. Génération du package de production

```bash
npm run build
```

Les fichiers compilés et minifiés sont générés dans le répertoire `dist/`.

### 2. Configuration d'environnement (`config.json`)

Le fichier `config.json` situé à la racine du dossier déployé permet d'adapter l'environnement sans recompiler :

```json
{
  "ktaBaseUrl": "https://sga/Totalagility",
  "ktaLoginUrl": "https://sga/TotalAgility/Forms/ManualLogon.form",
  "sessionCookie": "session_id",
  "devAllowBypass": false
}
```

> Pour une procédure détaillée de déploiement sous **Microsoft IIS** en environnement fermé, consultez le guide complet : [`DEPLOYMENT_IIS_OFFLINE.md`](./DEPLOYMENT_IIS_OFFLINE.md).

---

## 🗄️ Schéma & Procédure Stockée SQL Server

L'application consomme la procédure stockée `[dbo].[sp_GetTicketDetail_Consultation]`, qui agrège les données des tables :
- `dbo.Tickets`
- `dbo.PurchaseRequests` / `dbo.InvoiceRequests`
- `dbo.PR_Fournisseurs` / `dbo.Suppliers`
- `dbo.Comments`
- `dbo.DemandesComplement`
- `dbo.TicketAudit` / `dbo.TicketEvents`
- `dbo.Consultation_Flux` / `dbo.Consultation_FluxGroupAccess`

---

## 📜 Scripts Disponibles

- `npm run dev` : Démarre le serveur Vite en mode développement.
- `npm run build` : Compile l'application TypeScript en bundles statiques optimisés pour la production.
- `npm run lint` : Vérifie la validité des types TypeScript (`tsc --noEmit`).

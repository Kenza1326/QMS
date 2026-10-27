# 🚀 Guide de Déploiement IIS Offline (On-Premise / Hors-ligne)

Ce guide décrit pas à pas la procédure pour déployer l'application **React SPA** sur un serveur **Microsoft IIS** en environnement fermé / offline (réseau local d'entreprise sans accès Internet).

---

## 📋 1. Prérequis sur le serveur IIS

1. **Serveur Windows** (Windows Server 2016 / 2019 / 2022 ou Windows 10/11 Pro).
2. **Rôle IIS activé** avec :
   - *Common HTTP Features* : Static Content, Default Document, HTTP Errors.
3. **Module IIS URL Rewrite 2.1** :
   - Obligatoire pour router toutes les URLs de la Single Page Application (SPA) vers `index.html`.
   - Si le serveur est offline, téléchargez au préalable l'installeur MSI sur un poste connecté :  
     `rewrite_amd64_fr-FR.msi` ou `rewrite_amd64_en-US.msi` (téléchargeable depuis le site officiel Microsoft IIS URL Rewrite) et transférez-le via clé USB / partage réseau.
4. **MIME Types** standard (déjà présents par défaut dans IIS pour `.js`, `.css`, `.json`, `.woff2`, `.svg`).

---

## 📦 2. Génération du package de Build (sur la machine de dev)

Sur votre machine de développement :

```bash
# 1. Compiler l'application de production
npm run build
```

Cela génère le dossier autonome `/dist` contenant :
- `index.html`
- `assets/` (fichiers JS, CSS et images packagés et minifiés)
- `web.config` (fichier de configuration IIS)

> 💡 **Aucune dépendance externe CDN** n'est requise au runtime : toutes les polices, icônes (`lucide-react`) et styles (`Tailwind`) sont intégrés localement dans le bundle JS/CSS.

---

## 🌐 3. Configuration du Nom d'Hôte / URL KTA (Dev, Recette, Prod)

Le fichier **`config.json`** situé à la racine du dossier déployé (`dist/config.json`) permet de changer le nom d'hôte ou l'URL de TotalAgility **sans avoir à recompiler l'application** :

```json
{
  "ktaBaseUrl": "https://sga/Totalagility",
  "ktaLoginUrl": "https://sga/TotalAgility/Forms/ManualLogon.form",
  "sessionCookie": "session_id",
  "devAllowBypass": false
}
```

### Modes de configuration disponibles :

1. **Mode Automatique (Recommandé - Zéro configuration)** :
   Si vous laissez `"ktaBaseUrl": ""` (vide), l'application détecte automatiquement le domaine de la page courante (`window.location.origin + '/Totalagility'`) :
   * Déployé sur `https://sga/TicketConsultation` ➔ appelle automatiquement `https://sga/Totalagility`
   * Déployé sur `http://192.168.0.45/TicketConsultation` ➔ appelle automatiquement `http://192.168.0.45/Totalagility`
   * Déployé sur `https://kta-recette.local/TicketConsultation` ➔ appelle automatiquement `https://kta-recette.local/Totalagility`

2. **Mode Explicite (Multi-serveurs / Hôtes séparés)** :
   Si l'application web et TotalAgility sont sur des serveurs/ports différents, renseignez simplement l'URL absolue dans `config.json` :
   * **En Dev** : `"ktaBaseUrl": "http://192.168.0.45/Totalagility"`
   * **En Recette** : `"ktaBaseUrl": "https://kta-rec.entreprise.local/Totalagility"`
   * **En Prod** : `"ktaBaseUrl": "https://sga/Totalagility"`

---

## ⚙️ 4. Fichier `web.config` pour IIS

Placez ce fichier `web.config` à la racine du dossier `/dist` (ou vérifiez qu'il y est présent) :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <!-- Compression statique pour des temps de chargement optimaux -->
    <urlCompression doStaticCompression="true" doDynamicCompression="true" />
    
    <!-- Réécriture SPA : renvoie toutes les routes vers index.html -->
    <rewrite>
      <rules>
        <rule name="React SPA Routing" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{REQUEST_URI}" pattern="^/(api)" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>

    <!-- Cache pour les fichiers statiques (assets avec hash) -->
    <staticContent>
      <remove fileExtension=".json" />
      <mimeMap fileExtension=".json" mimeType="application/json" />
      <remove fileExtension=".woff" />
      <mimeMap fileExtension=".woff" mimeType="font/woff" />
      <remove fileExtension=".woff2" />
      <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
      <clientCache cacheControlMode="UseMaxAge" cacheControlMaxAge="30.00:00:00" />
    </staticContent>

    <httpProtocol>
      <customHeaders>
        <!-- En-têtes de sécurité recommandés -->
        <add name="X-Content-Type-Options" value="nosniff" />
        <add name="X-Frame-Options" value="SAMEORIGIN" />
        <add name="X-XSS-Protection" value="1; mode=block" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>
```

---

## 🏢 4. Configuration dans la Console IIS

### Option A : Création d'une Nouvelle Application sous le Site TotalAgility (Recommandé pour SSO/Cookies)
Si l'application est hébergée sur le même serveur que TotalAgility (ex: `http://mon-serveur-kta/TicketConsultation`) :
1. Ouvrez **Gestionnaire des services Internet (IIS)** (`inetmgr`).
2. Dépliez **Sites** > **Default Web Site** (ou votre site TotalAgility).
3. Clic droit > **Ajouter une application...** :
   - **Alias** : `TicketConsultation` (ou le nom de votre choix).
   - **Pool d'applications** : `DefaultAppPool` ou `TotalAgilityAppPool` (No Managed Code / Sans code managé).
   - **Chemin d'accès physique** : `C:\inetpub\wwwroot\TicketConsultation` (où vous copiez le contenu de `dist/`).
4. **Avantage clé** : En étant sur le même domaine/port, les cookies de session KTA (`session_id` ou `ASP.NET_SessionId`) sont partagés automatiquement sans problème de CORS ou SameSite !

---

### Option B : Création d'un Nouveau Site Dédié
1. Dans IIS, clic droit sur **Sites** > **Ajouter un site Web...**.
2. **Nom du site** : `TicketConsultation`.
3. **Chemin d'accès physique** : `C:\inetpub\wwwroot\TicketConsultation`.
4. **Liaison** : Port `8080` (ou port dédié) ou nom d'hôte (`consultation.intra.local`).
5. **Gestion CORS si domaine différent** : Si l'application tourne sur un port ou nom d'hôte différent de TotalAgility, configurez les en-têtes CORS sur IIS TotalAgility pour autoriser les requêtes avec credentials (`Access-Control-Allow-Credentials: true`).

---

## 🔒 5. Permissions de Dossier Windows (NTFS)

Assurez-vous que l'identité du Pool d'applications a les droits de lecture sur le dossier :
1. Clic droit sur `C:\inetpub\wwwroot\TicketConsultation` > **Propriétés** > **Sécurité**.
2. Cliquez sur **Modifier** > **Ajouter**.
3. Ajoutez l'utilisateur :
   - `IIS_IUSRS` (Accès en Lecture et exécution)
   - ou `IUSR`
4. Validez par **OK**.

---

## 🔄 6. Procédure de Mise à Jour Future (Offline)

1. Compiler la nouvelle version : `npm run build`.
2. Archiver le dossier `dist/` en ZIP.
3. Copier le ZIP sur le serveur IIS.
4. Remplacer les fichiers dans `C:\inetpub\wwwroot\TicketConsultation`.
5. *(Optionnel)* Exécuter un `iisreset` ou recycler le Pool d'applications si nécessaire.

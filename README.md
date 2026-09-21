# Institutional Radar V6.0

Version mobile/PWA du radar crypto.

## Déploiement GitHub Pages

Copier le contenu du dossier dans le dépôt `institutional-radar`, puis laisser GitHub Pages publier la branche configurée.

## Données

Le radar utilise les API publiques OKX pour tickers, chandelles, open interest et funding. Les graphiques multi-unités/périodes récupèrent les chandelles historiques à la demande.

La couche Smart Money sépare volontairement les données observées des interprétations : elle ne prétend pas identifier une banque ou un whale sans source indépendante.

## Cache PWA

Le service worker est versionné `institutional-radar-v6.0.1` pour forcer le renouvellement du cache lors du déploiement.

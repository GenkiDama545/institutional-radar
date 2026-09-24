# Service de veille Spot OKX (première étape)

Ce service Node 24 écoute les transactions publiques des paires Spot `*-USDT` d'OKX sans clé API. Il conserve les dernières minutes de transactions agrégées et les 500 dernières poussées observées. Une poussée demande au moins huit minutes précédentes mesurées, un volume minute d'au moins 200 USDT, un ratio de 3 par rapport au volume minute médian, et un mouvement du prix d'au moins 0,5 % dans la même minute. Les événements portent `status: detected` et `execution: unverified` : aucun scénario, aucune profondeur de carnet, aucun ordre ne sont certifiés.

## Lancement

`node server/index.mjs` avec Node 24, ou construire l'image avec `docker build -f server/Dockerfile .`. Configurer `PORT` (défaut 8080), `RADAR_STATE_FILE` (chemin d'un volume persistant ; défaut `./radar-state.json`) et `RADAR_ORIGIN` (origine autorisée pour l'accès navigateur ; défaut `https://genkidama545.github.io`). Le service répond sur `GET /health` et `GET /api/discoveries`. Les réponses portent `fresh`, `lastTradeAt` et `live` par événement : le consommateur doit vérifier ces valeurs avant de montrer des données comme actuelles.

Le fournisseur doit permettre un processus toujours actif, des connexions WebSocket sortantes vers OKX et un volume persistant monté sur `/data` si l'image Docker est utilisée. Ajouter une vérification HTTP `/health` et une politique de redémarrage. Laisser le service sous HTTPS derrière le domaine du fournisseur. Aucun secret OKX n'est nécessaire.

Pour Railway, `railway.json` configure le Dockerfile, le contrôle HTTP et le redémarrage. Depuis un compte appartenant à l'utilisateur, importer ce dépôt en tant que service Railway, monter un volume persistant sur `/data`, activer un domaine public HTTPS, puis vérifier que `/health` retourne `fresh: true` et que `coverage` augmente. Éviter un second exemplaire du service sur le même volume. Après vérification, reporter l'URL HTTPS dans `hosted-config.js` et republier GitHub Pages : la rubrique « Surveillance continue » affichera alors les mouvements récents sans leur donner le statut de scénario.

## Limites à lever avant raccordement à l'application

- La fenêtre de référence nécessite environ neuf minutes de transactions consécutives ; les actifs sans transaction durant une minute ne disposent pas d'une série régulière. Les données perdues lors d'une coupure WebSocket ne sont pas reconstruites. Les événements anciens restent enregistrés mais `live` devient faux.
- Les nouveaux instruments apparus après le démarrage ne sont pas encore ajoutés aux abonnements actifs : redémarrer le service après une nouvelle cotation. Les abonnements refusés par OKX sont seulement journalisés ; la couverture doit être confrontée aux instruments visibles sur OKX.
- `fresh` est global : il ne garantit ni la fraîcheur individuelle de chaque instrument ni l'exécution d'un ordre. La profondeur, l'écart achat/vente, les frais et le slippage restent à vérifier par le moteur avant toute proposition de scénario.
- La mémoire des événements est bornée aux 500 derniers ; le fichier d'état est écrit toutes les minutes, avec une éventuelle perte de la dernière minute en cas d'arrêt brutal. Ce n'est pas encore une base de données pour mesurer les résultats des signaux.
- Seul le marché Spot USDT est suivi ici. Les X-Perp nécessitent une prise en compte correcte de la taille des contrats et une validation séparée.

Tests : `node --test server/monitor.test.mjs`.

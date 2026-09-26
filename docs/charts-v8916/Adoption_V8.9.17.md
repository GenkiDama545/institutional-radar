# Adoption — Institutional Radar V8.9.17

Date : 26 septembre 2026.

## Décision et identité

L’utilisateur déclare la recette native réalisée et satisfaisante et autorise explicitement l’adoption de V8.9.17-rc.1 comme baseline graphique, sa finalisation, la fusion de la PR #25 et le déploiement V8.9.17. Les appareils déclarés sont PC Firefox et Samsung S24+ avec Chrome.

- PR : https://github.com/GenkiDama545/institutional-radar/pull/25
- RC testée : `4545ef4b470d2b4045314b0d2652aad68728853c`.
- Arbre RC : `c8206dcbd3d02ba450ae05a765e53f80c4c7d9e4`.
- CI de clôture : https://github.com/GenkiDama545/institutional-radar/actions/runs/36177630369 (succès, même SHA) ; CI push `36177565710` également verte.
- Ancienne production V8.9.16 : `bd5c19f46eebad03ff8bd1f0d0ca7ef2797fb7c8`, arbre `2a568eafdd38de88572cffc56259f9fb0f3bc8fe`.
- Preview de recette : https://institutional-radar-rc-8917-4545ef4-jyn84rgg3-michaeln-2021.vercel.app/

Avant finalisation, les 111 fichiers de l’archive officielle ont été vérifiés par leurs identifiants de blobs Git contre l’arbre RC, sans différence. La tête de la PR correspond toujours à cette RC. Aucun lot L0–L7 n’est recommencé.

Les documents de clôture et de recette RC sont conservés comme preuves historiques de l’état avant recette. Cette décision remplace leur attente d’adoption. Elle constitue une attestation utilisateur ; elle ne prétend pas fournir des mesures instrumentées de performance, de lecteur d’écran ou une recette iOS Safari, qui n’ont pas été recueillies.

## Différence de finalisation autorisée

Seuls `app.js`, `index.html` et `sw.js` passent du suffixe `8.9.17-rc.1` à `8.9.17`. L’assertion de version de `tests/release-assets.test.cjs` et son libellé suivent cette version, ainsi que les quatre expressions régulières de `engine.test.cjs` concernant market-screen, engine-core, app dans la page et app dans le service worker. Leur portée reste strictement identique. Le README et ce compte rendu documentent l’adoption. Aucun autre changement fonctionnel, aucune dépendance et aucune configuration de déploiement ne sont ajoutés.

Le premier gate de finalisation s’était arrêté sur ces quatre attentes RC oubliées. Après autorisation explicite de les corriger, le gate complet a été repris depuis le début et a réussi. Aucune autre correction n’a été introduite. La recette native Firefox / S24+ Chrome reste celle de la RC ; elle n’est pas présentée comme une nouvelle recette physique de la finale.

Le cache `institutional-radar-v8.9.17`, les URLs des assets et l’enregistrement du service worker sont alignés. La politique réseau/cache et `updateViaCache: 'none'` restent identiques. Le manifeste et les icônes sont inchangés.

## Gate et compatibilité

Le gate complet comprend `node --check app.js`, `node engine.test.cjs`, `node hosted-feed.test.cjs`, puis `node --test experience.test.cjs server/*.test.mjs tests/*.test.cjs`. Ce gate est vert localement sur la RC et sur la finale corrigée (Node 24.19.0 ; syntaxe, moteur, hosted-feed et 110 tests Node, zéro échec), en complément des CI Node 22 de la RC. La CI doit confirmer la finale sur son SHA exact, puis le commit de production avant clôture du déploiement.

La comparaison indépendante des archives RC et V8.9.16 confirme les 44 fonctions métier protégées, les constantes de stockage et les six horizons, ainsi que l’identité octet pour octet de `engine-core.js`, `signal-engine.js`, `market-screen.js`, `candle-store.js` et `trade-sim.js`. Aucun snapshot métier n’est régénéré.

Les clés des scans, favoris, verrous, journal, imports et transactions sont conservées. Le format `IR_BACKUP_V1`, la validation, l’export et la restauration restent identiques. Les tests de compatibilité passent. Les préférences graphiques utilisent la clé séparée `ir_chart_visibility_v1`. Il n’y a aucune migration ni purge de données métier. L’origine GitHub Pages de production reste inchangée ; la preview a un stockage séparé. Les données personnelles des profils Firefox et Chrome du téléphone n’ont pas été inspectées par l’agent.

## Observations de recette conservées

- R01 : des cartes du Top sont apparues puis ont disparu autour des rafraîchissements. L’observation a été signalée avant l’autorisation d’adoption ; elle n’est pas déclarée corrigée. Les fonctions de scan, fraîcheur et admission sont identiques à V8.9.16. Cette identité ne prouve pas à elle seule la cause du comportement observé.
- La précision décimale de la lecture EMA peut être excessive ; aucun changement cosmétique supplémentaire n’est introduit.
- Les restrictions réseau du navigateur Work sont distinctes d’une régression applicative. Un blocage OKX identique au blocage déjà diagnostiqué doit être consigné, sans transformer un scan incomplet en validation complète.

## Publication et rollback

La publication utilise GitHub Pages depuis `main`, à https://genkidama545.github.io/institutional-radar/ ; le projet Vercel de preview n’est pas la production. La PR est fusionnée avec un commit de merge, sans réécriture d’historique ni force-push. Le rapport de déploiement doit relever le SHA de fusion, son arbre, la CI push et le run Pages du même SHA, puis vérifier les fichiers réellement servis.

Le point de retour reste le commit V8.9.16 ci-dessus. Si un rollback est autorisé, préparer un **revert Git du commit de fusion avec parent principal 1**, vérifier le diff et le gate, puis publier par le même workflow Pages. Cela restaure l’ensemble cohérent des assets V8.9.16 ; une release de rollback peut aussi employer une nouvelle clé de cache explicitement cohérente. Aucun reset ni force-push. Ne pas supprimer le stockage local : l’ancienne application ignore la nouvelle préférence graphique. Conserver/exporter les sauvegardes locales avant toute intervention sur les données. Aucun rollback n’est exécuté par cette adoption.

La mission s’arrête après le déploiement vérifié. Signal Audit, instrumentation Learning et modification du Learning Engine ne sont pas engagés.

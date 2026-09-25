# Institutional Radar — Traitement contrôlé de l’étape 1

**Rapport intermédiaire — corrections A et décisions B · 25 septembre 2026**

## 1. État de la mission

**L’étape 1 n’est pas clôturée.** Les corrections certaines A ont été traitées en lots testés, sur une branche isolée. Les points B restent en attente de décision explicite ; ils ne sont ni masqués ni considérés comme résolus parce qu’ils sont documentés.

Référence : `Audit_Institutional_Radar_V8.9.15.md`, relu dans sa version enregistrée. Baseline : commit `0eee851e22e2be3651fd6e8b9291b55fe3eda077`, arbre `36f5a92d8c560bab604686ff31e296bfb6ab3ab4`. Branche : `audit/v8915-controlled-fixes`. Code corrigé au commit `45976e3` ; les commits de rapport complètent la traçabilité.

Aucune refonte globale, aucun Signal Audit, aucun nouveau Learning Engine, aucune pondération changée. Aucune publication ou fusion vers la production. Le numéro affiché reste V8.9.15 dans cette branche de travail ; un numéro de release distinct et ses caches seront préparés après les arbitrages et avant un éventuel déploiement approuvé.

Les instantanés de six cas de référence gardent les mêmes scores, niveaux, régimes, horizons d’ancrage/déclenchement et booléens de setup. Cela ne signifie pas que tous les comportements restent identiques : les cas erronés visés changent volontairement, par exemple un TP négatif désormais refusé ou un trou désormais non vérifiable.

### Lots réalisés et rollback

| Commit | Objet | Revenir en arrière |
|---|---|---|
| `e319916` | Baseline, snapshots, CI et classification A/B | Révocation des seuls tests/docs |
| `f855b54` | P1 certains : historique, statistiques, trous, niveaux, REST/WS | `git revert f855b54` avec résolution des dépendances ultérieures |
| `1313503` | P2 certains : navigation, stockage, favoris, volume, dérivés | `git revert 1313503` avec ses tests |
| `1472593` | UI : faux contrôles et formulations | `git revert 1472593` avec `c6f64b6` associé |
| `c6f64b6` | Garde de rendu des extrema après contrôle du lot UI | Inclus dans tout maintien du lot UI |
| `0289b5e` | Dette orpheline prouvée, documentation, tests navigateur | `git revert 0289b5e` |
| `45976e3` | Distinction prix bougie / ticker et fraîcheur de légende | `git revert 45976e3` |

Le rollback global le plus simple est de ne pas merger la branche : la production n’a pas été touchée. Après intégration, les reverts se font dans l’ordre inverse des dépendances, avec la suite complète. Aucun rollback ne doit supprimer le stockage utilisateur. Pas de renommage des clés existantes ni de migration destructive.

## 2. Résultats de vérification

- Syntaxe `app.js` : valide.
- `node engine.test.cjs` : succès, y compris scan complet/partiel, tous les 170 Spot, six horizons et contrat X-Perp exact.
- `node hosted-feed.test.cjs` : succès.
- `node --test experience.test.cjs server/*.test.mjs tests/*.test.cjs` : **43 tests, 43 succès, 0 échec**.
- Chromium : accueil aux largeurs 360/390/768/1440, vrai rafraîchissement graphique 100 → 101, sélection de bougie avec repères High/Low, simulation sous graphique conservée après refresh, paramètres/leçons et effacement du stockage ; aucune exception JavaScript non capturée dans ces parcours.
- Comparaison des captures d’accueil : identité conservée ; captures 390 et 768 identiques pixel par pixel, différences d’horloge à 360/1440 et un pixel de rendu à 1440. Ce sont des accueils avec réseau simulé et univers vide, pas une validation visuelle de tous les marchés live.
- Le gate a détecté une régression de libellé pendant le travail ; elle a été corrigée avant livraison avec un test supplémentaire. Les défauts préexistants B sont toujours signalés comme ouverts.

Les corrections comportementales ont des essais qui échouent avant et passent après, consignés dans `CONTROL.md` et les suites `audit-p1`, `audit-p2`, `audit-storage`, `audit-ui`. Les fonctions retirées ont une preuve de recherche de références et des snapshots moteur inchangés. Les tests ne prétendent vérifier ni la rentabilité, ni le téléphone réel, ni les données personnelles, ni le disque Railway.

## 3. Matrice F01–F32

États demandés utilisés : **CORRIGÉ**, **DOCUMENTÉ**, **NON APPLICABLE**, **DÉCISION VALIDÉE**. Aucun B n’est marqué DÉCISION VALIDÉE sans ton accord. **DOCUMENTÉ + Dxx signifie encore ouvert** lorsque l’arbitrage est requis. Les états intermédiaires ne satisfont donc pas encore ton critère de sortie.

| ID | État initial | Action | Fichiers modifiés | Tests ajoutés / mobilisés | Résultat | État final de ce passage |
|---|---|---|---|---|---|---|
| F01 · A | Le backtest passe des tableaux OKX au moteur d’objets : niveaux `NaN`, zéro scénario possible sans erreur explicite. | Décodage API → OHLCV objets sur le chemin complet du laboratoire. | app.js | audit-p1: adaptateur réel + UI historique | Niveaux finis ; plus de zéro setup dû au format. | CORRIGÉ |
| F02 · A | `btSlice` filtre sur ouverture ≤ date, pas clôture ≤ date. Une bougie 1D future peut être connue trop tôt après réparation F01. Évaluation à +18 barres traverse aussi la fin d’une partition. | Clôture avant décision ; horizon 18 contenu dans sa partition. | app.js; engine.test.cjs | audit-p1: clôture 1D et frontières | Lecture du futur exclue ; protocole exploratoire toujours limité. | CORRIGÉ — D09 pour le protocole global |
| F03 · A | `learningStats` exclut les anciens résultats ; `learningProposal` les réinclut. Sonde : 0 résultat vérifié mais 1 LONG affichable à +3R. | learningProposal réutilise verifiedObservation. | app.js | audit-p1: legacy/null R | Mêmes populations dans toutes les synthèses. | CORRIGÉ |
| F04 · B | En FORMING, seule la dernière bougie est examinée : une invalidation sur une bougie antérieure peut être oubliée après interruption, puis le scénario activé. | Aucun changement de cycle FORMING. | Aucun | Caractérisation existante ; futur replay FORMING | Le problème demeure ; choix reconstruction/UNVERIFIED nécessaire. | DOCUMENTÉ — D04 — non clôturé |
| F05 · A | Le contrôle de trous ne vérifie pas chaque intervalle. Sonde : trois bougies manquantes au milieu, pourtant sortie TP1 comptée CLOSED. | Vérifier chaque intervalle ; ignorer les barres non closes à now. | app.js | audit-p1: trou interne/futur | Trou interne → UNVERIFIED, pas de résultat fabriqué. | CORRIGÉ |
| F06 · A | Le rafraîchissement REST du graphique peut être écrasé par l’ancienne bougie de même timestamp. Sonde : réponse à 101, affichage conservé à 100 sans WebSocket. | REST remplace l’ancien cache ; WS arrivé pendant la requête préservé. | app.js | audit-p1: REST/WS ; navigateur | 100 → réponse 101 → affichage 101. | CORRIGÉ |
| F07 · B | ADX est stocké dans `feature.t.adx`, mais des branches du moteur lisent `trigger.adx`/`f.adx`. ADX réel 100, valeur lue `undefined` : bonus, choix du déclencheur et signal ADX non appliqués. | Contrat ADX conservé jusqu’à arbitrage. | Aucun | baseline: scores/niveaux ; sonde audit ADX | Chemin erroné identifié ; correction changerait les scores. | DOCUMENTÉ — D01 — non clôturé |
| F08 · B | Mélange clôturé/en formation : prix clôturé inchangé, RSI et volume modifiés par la bougie ouverte. Sonde RSI 100 → 1,097 sans nouvelle clôture. | Mélange bougie clôturée/en formation caractérisé. | Aucun | baseline: RSI change sans nouvelle clôture | Politique de données non choisie arbitrairement. | DOCUMENTÉ — D02 — non clôturé |
| F09 · B | La projection exige `e.biasBear` pour tous les SHORT, alors que le moteur autorise des rejets/reversals sans ancrage baissier. Scénario admis mais activation pouvant rester bloquée. | Conserver le gate biasBear actuel en attendant décision. | Aucun | Tests futurs admission/activation par kind | Rejet SHORT encore susceptible de rester bloqué. | DOCUMENTÉ — D03 — non clôturé |
| F10 · B | Texte cassure + retest / défense du support, mais activation générique clôture + volume + biais : aucun automate de retest/défense propre au kind. | Conserver les règles de confirmation ; arbitrage texte vs automate. | Aucun | Tests futurs breakout/pullback/rejection | Aucun retest fictif ajouté. | DOCUMENTÉ — D03 — non clôturé |
| F11 · B | Invalidation annoncée « clôture confirmée » dans la carte, live immédiat dans le moniteur, high/low de bougie clôturée dans le journal. Trois sémantiques. | Décrire séparément live, wick clôturée, clôture de prix. | README.md | Tests actuels SL prioritaire ; futurs trois conventions | Sémantiques non unifiées. | DOCUMENTÉ — D04 — non clôturé |
| F12 · A | `scenarioValid` vérifie surtout entrée/stop/TP1 relatifs ; accepte TP1 négatif SHORT et ignore TP2/TP3 incohérents. Le simulateur est plus strict. | Prix strictement positifs finis ; TP fournis ordonnés ; TP3 sans TP2 refusé. | app.js | audit-p1: niveaux LONG/SHORT | Cas négatifs rejetés ; niveaux valides inchangés. | CORRIGÉ — Les anciennes structures TP1 seul restent compatibles |
| F13 · B | La fraîcheur technique n’expire pas globalement. Prix/carnets peuvent être rafraîchis longtemps sur un setup non recalculé ; profondeur/niveaux ne partagent pas un timestamp de décision. | Documenter âge technique distinct de ticker/carnet. | README.md | Tests futurs TTL par horizon | Aucune durée de validité inventée. | DOCUMENTÉ — D05 — non clôturé |
| F14 · B | La page scénario écrase `e.directional` par un nouvel appel sans boost SHORT, sans recalculer les booléens de setup associés. Les scores affichés peuvent contredire l’admission. | Écrasement directionnel conservé et identifié. | Aucun | baseline: moteur ; futur scénario UI | Sa suppression peut changer le scénario principal choisi. | DOCUMENTÉ — D06 — non clôturé |
| F15 · B | Les cartes de scénarios ne sont pas toutes conditionnées par `execution.ok` ; la page peut annoncer aucune proposition principale et afficher des niveaux/projections malgré échec du carnet. | Gate de cartes/projection non modifié. | Aucun | Tests futurs carnet insuffisant sur toutes les entrées | Politique uniforme d’admission à valider. | DOCUMENTÉ — D06 — non clôturé |
| F16 · B | Scan exige six horizons complets ; page/projection peuvent continuer à partir de deux horizons. Les profondeurs et dates de recalcul changent aussi. | Couvertures/depths distinctes conservées. | README.md | engine.test: univers et six horizons ; futurs pages | Aucun affaiblissement du scan ; divergences de pages restent. | DOCUMENTÉ — D06 — non clôturé |
| F17 · B | La direction passée par une carte à `openDetail` n’est pas utilisée ; l’ouverture peut proposer un autre sens/kind. | Conserver le choix actuel du moteur ; proposer verrouillage du sens/kind. | Aucun | Tests futurs clic → même contrat/sens/kind | Pas de nouvelle sélection automatique. | DOCUMENTÉ — D06 — non clôturé |
| F18 · A | Volume déjà en cotation multiplié par `c` dans la page métrique. Exemple : 10 000 USDT à prix 100 affichables comme 1 000 000. | Utiliser directement v en unité de cotation. | app.js | audit-p2: page Volume | 10 000 de volume restent 10 000, pas 1 000 000. | CORRIGÉ |
| F19 · A+B | `oiRatio` jamais alimenté dans le scan : famille positioning neutre et tri correspondant sans valeur ; fixtures de lab pourtant renseignées. | Retirer le tri sans données ; conserver famille neutre/poids. | app.js; index.html; README.md | audit-ui: absence faux tri ; baseline scores | Aucune formule OI/Volume inventée. | DOCUMENTÉ — D10 : conservation explicite de la famille avant Signal Audit |
| F20 · A | Jauges OI avec bornes 0,65×/1,35×, Volume 0,35×/1,8×, Funding 0/2× : positions quasi constantes et « MIN/MAX » non historiques. | Nommer bornes indicatives et préciser leur origine. | app.js | audit-ui: jauges vs extrema de prix | Ne prétend plus mesurer des MIN/MAX historiques. | CORRIGÉ — Le choix d’une jauge utile relève ensuite de l’UX |
| F21 · B | Fenêtre d’indicateurs varie : fiche 180 puis 120 barres, projection calcule sur le nombre visible. Zoom/changement de page peut modifier EMA/RSI au même point. | Conserver warmup/zoom actuel ; définir politique avant harmonisation. | README.md | baseline ; experience cache ; futurs indicateurs/viewport | Pas de refonte graphique anticipée. | DOCUMENTÉ — D06/D10 — non clôturé |
| F22 · A | Gardes asynchrones incomplètes : scénario peut écraser une autre sous-page du même actif ; timer de projection créé après attente même si on a quitté ; timer de fiche pas toujours arrêté au retour accueil/outils. | Révision de page, gardes après await, annulation des timers. | app.js | audit-p2: quatre navigations retardées | Aucune réponse obsolète ni timer zombie dans ces cas. | CORRIGÉ |
| F23 · B | Absence d’expiration ; TP1 termine le suivi ; entrer dans le simulateur dédié l’arrête. Limites incompatibles avec un futur Learning complet. | Limites TP1 terminal/suivi visible/absence expiration explicites. | app.js; README.md | baseline: TP1 terminal/sans expiration ; audit-ui | Aucun nouveau suivi automatique ajouté. | DOCUMENTÉ — D07 — conservation étape 1 à valider |
| F24 · A+B | Import peu validé, clés locales non toutes typées, sauvegardes non transactionnelles. Quota/migration peuvent interrompre l’UI ou laisser verrou sans journal. Export incomplet pour reprise. | Typage défensif, import mal formé refusé, quotas signalés, favori ancien corrigé. | app.js | audit-storage (4) ; audit-p2 favori ancien | Portion A corrigée ; multi-clés, rétention, provenance/conflits et export complet ouverts. | DOCUMENTÉ — D07/D08 — partiellement corrigé, non clôturé |
| F25 · A+B | « LIVE » de projection affiché même si ticker échoue et ancien prix est réutilisé ; ligne de prix du graphique = dernière clôture de sa bougie, distincte du ticker. | Prix bougie distinct du ticker ; fraîcheur vraie dans bandeau/légende. | app.js | audit-p2 ticker offline ; audit-ui légende | Échec API n’est plus présenté comme un ticker LIVE. | CORRIGÉ — D05 réserve le gate d’activation sur fraîcheur |
| F26 · A | Sélection de contrat sauvegardé validée par motif du nom, pas par l’état live réel du listing au moment de reprise. | Vérifier instrument exact, ruleType et state live avant reprise favori. | app.js | audit-p2: contrat suspendu ; engine.test univers | Un nom syntaxiquement valide ne suffit plus. | CORRIGÉ |
| F27 · A | Familles déclarées « sans double comptage » alors que plusieurs signaux corrélés restent additionnés ; nombre de signaux présenté comme nombre de familles. | Retirer promesse de déduplication ; compter des signaux, pas des familles fictives. | app.js; README.md | audit-ui libellés ; baseline | Pondérations inchangées. | CORRIGÉ — Déduplication réelle réservée Signal Audit D10 |
| F28 · A+B | « Confirmé », « valide », « prêt », « activé » sont employés pour des étapes différentes. Biais baissier peut être étiqueté DÉFAVORABLE même pour un SHORT. | Familles directionnelles HAUSSIER/BAISSIER ; lexique des scores/états. | app.js; README.md | audit-ui: SHORT ; baseline | Confusion négatif=défavorable corrigée pour familles ; états moteur réservés. | DOCUMENTÉ — D03/D04/D06 pour l’unification restante |
| F29 · A | Mode compact sans effet CSS ; leçon en cartes sans action ; deux accès contexte répétitifs ; comparateur peu distinctif entre Spot/X-Perp. | Retirer mode compact fictif, leçons statiques, comparer contrats uniques. | app.js; index.html | audit-ui ; navigateur | Pas de faux bouton ; identité Spot/X-Perp et timestamp visibles. | CORRIGÉ — Deux accès Contexte conservés comme raccourcis, pas deux calculs |
| F30 · A | Effacer l’historique retire le localStorage sans vider `history`. La prochaine sauvegarde peut remettre les données effacées. | Vider history et supprimer ses clés ; signaler échec du stockage. | app.js | audit-p2 mémoire/disque ; navigateur | Les anciens échantillons ne reviennent pas à la sauvegarde suivante. | CORRIGÉ |
| F31 · A+B | Le laboratoire historique accède à `e[kind]` : rejet stocké dans `e.shortRejection`, donc branche rejet non évaluée. Les règles d’entrée historiques ne correspondent pas à la confirmation live. | Passer par scenarioLevelsFromEngine pour rejection ; décrire limites du replay. | app.js | audit-p1: vrai chemin UI rejet | Rejet évalué ; toucher d’entrée reste différent de confirmation live. | DOCUMENTÉ — D09 — non clôturé |
| F32 · A | Après boost SHORT, `spread` et `strongest` de `directional` ne sont pas recalculés. Le détail peut exposer des champs issus de deux étapes du score. | Recalculer spread/strongest après boost SHORT. | engine-core.js | audit-p2 dérivés ; baseline scores/niveaux | Champs cohérents ; score et éligibilité inchangés. | CORRIGÉ |

## 4. Décisions B à prendre avant application

Ces recommandations sont des propositions techniques. Elles ne sont pas appliquées et ne sont pas présentées comme des règles validées. Tu peux valider les recommandations par identifiant ou choisir les alternatives.

### D01 — ADX effectivement consommé (F07)

- **Actuel :** le calcul existe dans `feature.t.adx`, plusieurs lectures adaptatives utilisent `feature.adx` et obtiennent `undefined`.
- **Problème :** bonus/choix du déclencheur et signal ADX ne fonctionnent pas comme le suggère le code.
- **Option 1 :** corriger les accès vers la valeur déjà calculée, sans toucher coefficients/seuils. Conséquence : des scores, déclencheurs et scénarios changeront réellement.
- **Option 2 :** conserver temporairement le comportement et déclarer ADX inactif dans ces branches jusqu’au Signal Audit. Conséquence : compatibilité stricte, défaut connu maintenu explicitement.
- **Recommandation :** option 1, dans un commit dédié, avec comparaison détaillée des fixtures avant/après. Ne pas compenser en modifiant les pondérations.
- **Tests affectés :** snapshots `v8915-models.json`, sélection du déclencheur, signaux/confluences, éligibilité LONG/SHORT. Les nouveaux attendus doivent être expliqués, jamais régénérés sans examiner les écarts.

### D02 — Bougies et intégrité des séries (F08 et risques de données)

- **Actuel :** prix courant issu d’une clôture, mais indicateurs pouvant intégrer la bougie ouverte ; le décodage ne valide pas toutes les relations OHLC ni toutes les discontinuités.
- **Option 1 :** décision/scoring sur bougies clôturées seulement, bougie en cours réservée à l’affichage. Conséquence : signaux plus stables mais plus tardifs ; résultats parfois différents de V8.9.15.
- **Option 2 :** utiliser aussi la bougie ouverte, avec état explicitement provisoire, et faire confirmer ensuite. Conséquence : sensibilité conservée, mais deux états à définir et davantage de changements intrabougie.
- **Recommandation :** option 1. Refuser explicitement une série invalide plutôt que la corriger silencieusement ; exposer les données manquantes. Définir dans le même contrat les timestamps futurs, doublons, trous et OHLC impossibles. Le cas d’un trou doit bloquer la vérification de la portion concernée, pas inventer des bougies.
- **Tests affectés :** RSI/EMA/ADX/volume/régime/niveaux, cache à la frontière de clôture, univers gardé mais actifs temporairement incomplets, historique normalisé et suivi. Le test de caractérisation « bougie ouverte influence RSI » changera volontairement d’attendu.

### D03 — Confirmation des différents scénarios et SHORT de rejet (F09/F10/F28)

- **Actuel :** plusieurs noms de scénario, mais activation commune prix + clôture + ratio volume ≥ 1,15 + biais. Un rejet SHORT peut être admis sans ancrage baissier, puis bloqué par `biasBear` dans la projection.
- **Option 1 :** conserver cette règle commune et renommer/documenter les cartes pour décrire exactement ce qu’elle contrôle. Alignement du biais d’activation sur les conditions du kind déjà admis. Conséquence : pas de nouvel automate de retest ; certains SHORT de rejet actuellement bloqués pourraient s’activer.
- **Option 2 :** définir un véritable automate par kind (cassure, retest, défense, rejet), avec distance/tolérance/durée/volume précis. Conséquence : comportement plus riche, mais règles nouvelles à spécifier, tester et évaluer ; pas un simple correctif.
- **Recommandation étape 1 :** option 1, en conservant le seuil 1,15 et en remplaçant le gate global contradictoire par une condition cohérente avec le motif admis. Ne pas prétendre qu’un retest est détecté. L’option 2 doit recevoir une spécification séparée ; aucun seuil nouveau n’est proposé comme acquis ici.
- **Tests affectés :** rejet contre tendance 1D, continuation baissière, prix franchi sans clôture, manque de volume, pullback et aucune activation Spot SHORT.

### D04 — Invalidation et interruptions FORMING (F04/F11)

- **Actuel :** texte de carte « clôture au-delà du stop », moniteur sur prix live, journal sur high/low d’une bougie clôturée ; FORMING ne vérifie que la dernière bougie.
- **Option 1 :** conserver la convention du journal : touche du niveau par high/low d’une bougie clôturée. Le live devient une alerte provisoire ; le journal décide de l’issue. Conséquence : une mèche invalidante suffit après clôture de la bougie.
- **Option 2 :** clôture de prix au-delà du stop uniquement. Conséquence : davantage de scénarios survivent aux mèches ; ce n’est plus le même risque théorique.
- **Option 3 :** invalidation au premier prix live observé. Conséquence : données tick nécessaires et résultats dépendants de la présence/connexion du navigateur ; impossible de reconstruire fidèlement avec OHLC seul.
- **Recommandation :** option 1 pour rester proche du journal existant. En cas d’interruption FORMING, ne pas conclure « annulé avant entrée » si l’historique ne permet pas d’exclure une activation antérieure : classer `UNVERIFIED`. Ne pas rejouer une activation ancienne avec le biais actuel. Une reconstruction complète exige les données historiques de confirmation et relève de l’instrumentation ultérieure.
- **Tests affectés :** invalidation avant entrée, mèche vs close, même bougie entrée/SL/TP, interruption avec activation possible, reprise sans trou, idempotence et statistiques excluant UNVERIFIED.

### D05 — Durée de validité technique et données live (F13 et portion stratégique F25)

- **Actuel :** ticker/carnet rafraîchis, analyse technique du scan potentiellement ancienne ; le bandeau de fraîcheur est corrigé, mais l’activation n’a pas de nouvelle règle de péremption.
- **Option 1 :** conserver la décision manuelle de rescan, avec âge visible. Conséquence : pas de changement de sélection, mais setups anciens encore consultables/activables.
- **Option 2 :** imposer une durée technique explicite et un ticker frais à toute admission/activation. Conséquence : davantage de suspensions/recalculs ; les seuils font partie des règles.
- **Recommandation proposée :** option 2, avec un TTL lié à **deux intervalles du déclencheur** et contrôle séparé de la fraîcheur de chacun des six horizons ; ticker selon la limite existante de 120 s. Une expiration de fraîcheur suspend la décision et demande un recalcul, elle ne déplace pas les niveaux d’un verrou existant et ne devient pas un SL. Ce chiffre est une proposition à valider, pas une conclusion de l’audit.
- **Tests affectés :** seuils juste avant/après TTL, futures dates, API absente, clôtures par horizon, prix récent/analyse ancienne et scénario déjà activé.

### D06 — Cohérence admission → carte → projection (F14–F17/F21)

- **Actuel :** second calcul directionnel dans la page, cartes moins filtrées, couverture parfois réduite, profondeurs différentes et sens du clic ignoré. Le nombre de bougies affiché change certains indicateurs de graphique.
- **Option 1 :** conserver ces parcours comme lectures indépendantes, avec différences explicitement annoncées. Conséquence : pas de régression stratégique, mais écarts persistants pour l’utilisateur.
- **Option 2 :** correctifs limités : utiliser le score directionnel déjà retourné par le moteur ; mêmes gates d’admission sur chaque entrée ; six horizons et profondeurs du scan pour évaluer un candidat ; préserver le contrat/sens/kind choisi ou expliquer son indisponibilité, sans le remplacer silencieusement.
- **Recommandation :** option 2 pour les parcours de décision. Afficher qu’un recalcul est effectué et ses nouvelles données avant de verrouiller ; ne pas créer un modèle canonique complet par refactor massif. Pour les graphiques, **conserver temporairement le warmup actuel avec limite documentée**, et approuver son unification fonctionnelle seulement dans l’étape 2. Aucun zoom/pan/nouveau moteur de graphique ici.
- **Tests affectés :** clic SHORT/Spot/X-Perp exact jusqu’aux niveaux, mêmes données → même sélection, couverture partielle, carnet absent, refus plutôt que substitution, écarts expliqués après nouveau marché. Les tests de rendu graphique restent ceux de V8.9.15 jusqu’à l’étape 2 autorisée.

### D07 — Portée du suivi, persistance et rétention (F23/F24)

- **Actuel :** suivi projection ouverte, TP1 terminal, aucune expiration ; dernier verrou par instrument/kind ; journal limité aux 1 500 dernières entrées ; écritures multi-clés non atomiques ; export journal seul.
- **Option 1 :** conserver explicitement ces limites jusqu’à l’étape 4, avec avertissements désormais présents. Conséquence : le corpus actuel reste descriptif/incomplet, mais pas de nouveau Learning prématuré.
- **Option 2 :** construire maintenant suivi automatique, résolution TP multiples et expiration. Conséquence : empiète sur l’étape 4 et nécessite des règles nouvelles ; non recommandé dans le périmètre actuel.
- **Recommandation :** option 1 pour le suivi. Pour la sécurité des données, autoriser séparément un petit lot de sauvegarde/restauration complète versionnée et une stratégie de transaction/reprise ; ne jamais purger une observation ouverte pour atteindre 1 500 (conserver les ouvertes, limiter les terminées). Cela augmente potentiellement la taille du stockage et nécessite de traiter les quotas explicitement. Pas de backend ou d’instrumentation automatique.
- **Tests affectés :** maintien TP1 terminal, état après fermeture, 1 501 observations dont ouvertes, quota entre écritures, interruption/reprise, export/import complet et compatibilité des clés V8.9.15.

### D08 — Confiance et conflits d’import Learning (F24)

- **Actuel :** format désormais vérifié ; un même ID importé remplace encore la version locale ; un JSON prétendant être V3 peut satisfaire le filtre de résultats sans preuve de provenance.
- **Option 1 :** faire confiance au fichier choisi, tout en documentant cette limite. Conséquence : compatibilité totale, possibilité d’écrasement et de statistiques importées invérifiables.
- **Option 2 :** conserver local et import séparés lors d’un conflit ; identifier la provenance importée ; statistiques importées présentées séparément des observations locales, sans suppression.
- **Recommandation :** option 2. Une validation de schéma n’est pas une preuve de marché ; aucun import ne doit devenir une observation vérifiée par simple renommage de champ. Ne pas fabriquer de signature rétroactive.
- **Tests affectés :** export/reimport idempotent, deux versions d’un même ID, provenance, legacy, import valide mais falsifiable, statistiques locales vs importées.

### D09 — Portée du laboratoire historique (reste F31 + dette de validation)

- **Actuel corrigé :** objets normalisés, bougies connues à la clôture, pas de sortie hors partition, rejet accessible. Restent : entrée par toucher au lieu de confirmation live, observations chevauchantes, profondeur courte insuffisante, pas de rolling training ni de dérivés historiques.
- **Option 1 :** conserver un diagnostic exploratoire explicitement limité, sans l’utiliser comme preuve de performance ni pour décider des poids. Conséquence : outil conservé, aucun prétendu Learning validé.
- **Option 2 :** refaire dès maintenant le protocole de validation et le replay fidèle. Conséquence : élargissement au-delà des correctifs certains, dépendant du Signal Audit et des données qui seront collectées.
- **Recommandation étape 1 :** option 1. Les textes ont déjà été rendus prudents. La conservation du protocole restant doit être approuvée explicitement ; ne pas traiter zéro résultat comme une preuve d’absence de setup lorsque la couverture est insuffisante. La future validation devra vérifier couverture complète, purge/embargo, causalité et confirmation identique au live.
- **Tests affectés ensuite :** historique API réel archivé, six horizons sur chaque date, limites des partitions, motifs de confirmation et indépendance des observations. Les correctifs causaux actuels restent protégés par `audit-p1`.

### D10 — Fusions et dette conservées sans empiéter sur la roadmap

- **Actuel :** coexistence des modèles 1H/MTF, formules corrélées, métadonnées non actives, UI de lecture générique, service minute autonome.
- **Option 1 :** conserver explicitement les structures encore actives ou utiles, avec documentation, puis harmoniser au bon jalon : graphiques étape 2, familles/pondérations étape 3, collecte/stockage historique étape 4.
- **Option 2 :** fusionner/supprimer/activer ces composants maintenant. Conséquence : changement stratégique et refactor plus large, contraire au périmètre demandé.
- **Recommandation :** option 1. Conserver `positioning` neutre tant qu’un ratio OI pertinent n’est pas défini ; les métadonnées de régime n’activent aucune pondération ; conserver les outils historiques testés et le serveur Railway tant que leur usage opérationnel n’est pas vérifié. Les doublons de tests synthétiques restent utiles comme diagnostics jusqu’à leur consolidation lors de la validation future. Les raccourcis Contexte ont un usage de navigation, pas un coût de moteur dupliqué.
- **Tests affectés :** aucun score nouveau en étape 1 ; snapshots et univers inchangés. Les fusions futures nécessiteront leurs tests avant/après dédiés. La suppression prouvée des neuf helpers, de l’état de survol et de la branche morte est déjà effectuée.

**Dépendances des arbitrages :** D01/D02 avant recalibration des attendus ; D03/D04 avant fiabilisation des résultats ; D05/D06 avant uniformisation du parcours ; D07/D08 avant collecte massive ; D09/D10 empêchent de présenter les futurs chantiers comme déjà réalisés. Aucune de ces décisions n’autorise automatiquement l’étape 2.


## 5. Matrice des 46 recommandations fonctionnelles/UI

Les identifiants U01–U46 suivent exactement l’ordre du rapport d’origine. L’état initial rappelle sa recommandation ; aucune ligne n’est omise. Une conservation proposée sous Dxx attend encore ton arbitrage.

| ID / bloc | État initial | Action | Fichiers modifiés | Tests / preuve | Résultat | État final de ce passage |
|---|---|---|---|---|---|---|
| U01 · Identité visuelle V8.9.15 et grand titre | KEEP — Baseline demandée ; aucun remplacement global | Conserver titre, palette, dispositions. | Aucun CSS modifié | Captures 4 largeurs | Identité préservée | DOCUMENTÉ — KEEP demandé |
| U02 · Univers Spot USDT + X-Perp séparé | KEEP — Bon découplage d’instruments ; pas de favoritisme de ticker | Conserver IDs et univers. | Aucun | engine.test: contrats exacts et tous Spot | Aucune préférence ticker ajoutée | DOCUMENTÉ — KEEP demandé |
| U03 · Analyse identique des six horizons | KEEP — Protège la confluence et l’accès des petits marchés | Conserver six horizons du scan. | Aucun | engine.test + baseline | Aucun horizon supprimé | DOCUMENTÉ — KEEP demandé |
| U04 · Acquisition OI/funding | DOCUMENT — Couverture réelle, unités, erreurs et durée entre scans à expliciter | Documenter unités/couverture ; pas de nouvelle source. | README.md | Lecture des appels, absence non inventée | Couverture réelle par contrat à compléter avec fixtures API | DOCUMENTÉ — conservation D10 à valider |
| U05 · Normalisation de bougies/cache | IMPROVE — Continuité/fraîcheur/corrections historiques à contrôler ; préserver avantage des lectures récentes | Fusion REST/WS corrigée ; causalité historique ; contrats données restants réservés. | app.js | experience + audit-p1 | Cache inchangé ; validation globale à décider | DOCUMENTÉ — A corrigé, D02/D05 ouverts |
| U06 · Contrôles prix/spread/carnet | KEEP — Séparation pertinente entre signal et exécution ; étendre les preuves de fraîcheur plus tard | Conserver seuils actuels. | Aucun | engine.test: spread/carnet | Pas de filtre ajouté pour favoriser gros marchés | DOCUMENTÉ — KEEP, uniformisation D06 ouverte |
| U07 · « Taille » des cryptos | DOCUMENT — C’est le percentile de volume 24h, pas la capitalisation | Préciser percentile de volume. | README.md | Code tier vérifié | Pas de market cap prétendue | DOCUMENTÉ |
| U08 · Calcul des indicateurs | IMPROVE — Corriger le contrat ADX et décider une convention de bougies clôturées | Nettoyer calculs inutiles ADX sans activer sa lecture manquante. | engine-core.js | baseline | Formule identique ; choix de bougie et accès ADX réservés | DOCUMENTÉ — D01/D02 ouverts |
| U09 · Familles / régime 1H et régime multi-horizon | MERGE — Harmoniser le modèle de lecture ; pas simplement supprimer un moteur sans tests | Conserver modèles actifs ; aucune fusion stratégique. | README.md | baseline | Refactor évité | DOCUMENTÉ — D10 ouvert |
| U10 · Scores Radar / direction / scénario | DOCUMENT — Rôles distincts à rendre lisibles avant harmonisation ; préserver valeurs de référence | Expliquer rôles et préserver valeurs. | app.js; README.md | baseline + audit-ui | Confiance/biais/score distingués | DOCUMENTÉ |
| U11 · Top 5 | KEEP — Résumé utile ; préciser qu’il est global malgré les filtres d’une autre section | Conserver Top 5 global. | Aucun | Lecture renderRank + documentation initiale | Le filtre de la section suivante ne pilote pas ce Top | DOCUMENTÉ — KEEP |
| U12 · « Explorer les scénarios » / catégories | KEEP — Filtres utiles ; labels « confirmé » à distinguer d’« activé » | Conserver filtres ; lexique admission/activation. | README.md | engine.test | Qualification reste distincte du suivi | DOCUMENTÉ — état moteur D03/D06 ouvert |
| U13 · Surveillance multi-horizon | IMPROVE — Motifs LONG moins précis, double affichage de certaines listes SHORT | Conserver motifs/listes pour éviter de redéfinir les signaux maintenant. | README.md | Lecture code + baseline | Amélioration d’explication réservée | DOCUMENTÉ — D10 ouvert |
| U14 · Tableau de tout le marché | KEEP — Utile pour retrouver tous les actifs, y compris sans scénario | Conserver accès à tous les actifs. | Aucun | engine.test: tous 170 Spot | Marchés sans scénario visibles | DOCUMENTÉ — KEEP |
| U15 · Tri « OI / Volume » | REMOVE — `oiRatio` n’est pas alimenté en production ; action actuellement sans signification | Retirer option/branche de tri ratio sans donnée. | index.html; app.js | audit-ui | Faux tri absent | CORRIGÉ |
| U16 · Fiche Résumé | KEEP — Information centrale ; nommer le score et l’âge de son calcul | Conserver résumé ; documenter âge technique distinct de marché. | README.md | baseline ; audit-p2 navigation | TTL/âge par modèle à préciser | DOCUMENTÉ — D05 ouvert |
| U17 · Lecture trader générique | IMPROVE — Beaucoup de texte constant ; relier chaque conclusion aux données de l’actif | Conserver contenu générique en l’identifiant comme lecture, pas nouveau signal. | README.md | Lecture du code initial | Rendre les raisons plus spécifiques nécessite cohérence des modèles | DOCUMENTÉ — D06/D10 ouverts |
| U18 · Radars Prix/Score | KEEP — Valeurs et accès historique utiles | Conserver bornes réelles Prix et score 0–100. | app.js | audit-ui: scope des bornes | Pas de fausse borne indicative pour Prix | DOCUMENTÉ — KEEP vérifié |
| U19 · Radars OI/Volume/Funding/Momentum | IMPROVE — Plusieurs bornes MIN/MAX sont fabriquées à partir du courant ; leur jauge est presque constante | Nommer échelles indicatives. | app.js | audit-ui | Origine des bornes visible | CORRIGÉ |
| U20 · Page Volume approfondie | IMPROVE — Double conversion du volume de cotation par le prix | Utiliser v sans multiplier par c. | app.js | audit-p2 Volume | Unité exacte conservée | CORRIGÉ |
| U21 · Confluence MTF de la fiche | MERGE — Réutiliser une lecture cohérente des six horizons ; actuellement 30m omis | Fusion six horizons de fiche réservée au contrat commun. | Aucun | engine.test protège scan six TF | Fiche conserve son affichage actuel | DOCUMENTÉ — D06 ouvert |
| U22 · Lecture Doji/HH-HL par horizon | DOCUMENT — Présentation simplifiée, distincte du moteur de structure et sensible à la dernière bougie | Documenter représentation simplifiée et distinction du moteur. | README.md | Lecture fonctions struct/pattern | Pas de prétendue batterie de patterns complète | DOCUMENTÉ |
| U23 · Graphique de fiche / Prix / approfondi | MERGE — Partager contrôles, données et politique de calcul ; garder les emplacements utiles | Conserver emplacements ; fusion de composants réservée graphiques. | README.md | audit-p1/UI + navigateur | Pas d’étape 2 lancée | DOCUMENTÉ — conservation D10 à valider |
| U24 · Graphique approfondi / sélection de bougie | IMPROVE — Conserver style ; correction du refresh, puis zoom/pan/indicateurs en étape 2 seulement | Corriger refresh et prix bougie ; conserver contrôles existants. | app.js | audit-p1/UI + navigateur | Interactions V8.9.15 conservées | DOCUMENTÉ — A corrigé, suite étape 2 D10 |
| U25 · Projection de scénario | IMPROVE — Source canonique, état de fraîcheur, confirmation spécifique au kind et suivi cohérent | Gardes navigation/fraîcheur ; stratégie et modèle commun réservés. | app.js | audit-p2 ; baseline | Corrections certaines prouvées | DOCUMENTÉ — D03–D06 ouverts |
| U26 · Badges d’indicateurs | DOCUMENT — Affichages informatifs, pas des boutons d’activation/désactivation | Documenter badges informatifs. | README.md | Lecture proChart | Aucun faux toggle ajouté | DOCUMENTÉ |
| U27 · Simulateur sous graphique approfondi | KEEP — Répond au besoin de projection libre ; indépendant du suivi | Conserver simulation libre. | Aucun calcul modifié | experience + navigateur | Saisie préservée pendant refresh | DOCUMENTÉ — KEEP |
| U28 · Simulateur de scénario et indépendant | KEEP — Même calcul pur, gains par allocation ; préciser séparation des hypothèses et observations | Conserver calcul pur partagé et hypothèses indépendantes. | README.md | experience: 47,92/50,11, FX, coûts | P&L inchangé | DOCUMENTÉ — KEEP |
| U29 · Scénarios chiffrés | IMPROVE — Éligibilité identique partout, niveaux valides pour tous les TP, conservation du choix utilisateur | Valider géométrie ; réserver gates/choix/snapshot. | app.js | audit-p1 ; baseline | TP absurdes refusés | DOCUMENTÉ — A corrigé, D06 ouvert |
| U30 · Favoris | IMPROVE — Références stables et export complet ; ne pas suggérer un suivi permanent | Listing et ancien verrou corrigés ; export/reprise réservés. | app.js | audit-p2/storage | Pas de suivi permanent prétendu | DOCUMENTÉ — D07/D08 ouverts |
| U31 · Journal utilisateur | IMPROVE — L’écran actuel agrège surtout ; il ne liste pas chaque observation avec sa chronologie | Décrire portée réelle ; chronologie complète future. | app.js; README.md | audit-ui + baseline | Pas de nouvelle collecte | DOCUMENTÉ — D07 ouvert |
| U32 · Statistiques Learning | IMPROVE — Même filtre de validité partout ; quarantaine des imports/legacy | Filtre vérifié unique ; confiance import séparée à décider. | app.js | audit-p1/storage | Legacy/null exclus des synthèses | DOCUMENTÉ — A corrigé, D08 ouvert |
| U33 · Proposition d’apprentissage | DOCUMENT — Rapport descriptif, pas entraînement ni nouveaux poids issus des observations | Décrire rapport descriptif sans entraînement. | app.js; README.md | baseline: poids inchangés | Pas de sufficiency statistique promise | DOCUMENTÉ |
| U34 · Tests synthétiques visibles | MERGE — Centraliser les jeux de tests et distinguer diagnostic technique de performance | Conserver tests synthétiques ; préciser leurs 11 cas fixes. | app.js; README.md | engine.test + baseline | Pas de fusion risquée d’oracles | DOCUMENTÉ — D10 ouvert |
| U35 · Laboratoire historique | IMPROVE — Format, temporalité, partitions et règles de sortie avant toute confiance | Adapter format/temps/rejet ; annoncer limites restantes. | app.js; engine.test.cjs | audit-p1 | Outil exploitable techniquement, pas validation statistique | DOCUMENTÉ — D09 ouvert |
| U36 · Contexte & acteurs | DOCUMENT — BTC/ETH simplifiés et pédagogie ; aucun suivi réel de banques/fonds/baleines | Conserver limites institutionnelles et contexte simple. | README.md | Lecture contextHtml | Aucune banque/baleine réellement identifiée | DOCUMENTÉ |
| U37 · Blocs pédagogiques « Apprendre » | IMPROVE — Cartes d’aspect cliquable sans action ; leur donner une fonction ou un aspect statique | Rendre les cartes statiques. | app.js | audit-ui + navigateur | Pas d’action inexistante suggérée | CORRIGÉ |
| U38 · Glossaire | KEEP — Utile ; préciser CVD/liquidations comme notions non collectées ici | Préciser CVD/liquidations non collectés. | app.js | audit-ui | Glossaire conservé comme pédagogie | DOCUMENTÉ — KEEP |
| U39 · Comparateur | IMPROVE — Marché/contrat exact et fraîcheur absents du résultat ; doublons autorisés | Afficher produit/ID/timestamp ; dédupliquer sélection. | app.js | audit-ui | Contrats homonymes distingués | CORRIGÉ |
| U40 · Navigation basse | KEEP — Accès aux sections de l’accueil ; masquée dans le graphique approfondi, confirmé en navigateur | Conserver navigation basse masquée en sous-page. | Aucun | Navigateur audit initial/actuel | Hypothèse de bug réfutée | DOCUMENTÉ — KEEP, anomalie réfutée |
| U41 · Mode compact | REMOVE — Toggle de classe sans règle `.compact` correspondante ; faux réglage actuellement | Retirer réglage sans effet. | app.js | audit-ui + navigateur | Aucune option fictive | CORRIGÉ |
| U42 · Effacer l’historique des scans | IMPROVE — Effacement du disque sans vider l’objet mémoire ; historique peut revenir au scan suivant | Effacer mémoire et disque. | app.js | audit-p2 + navigateur | Données anciennes ne reviennent pas | CORRIGÉ |
| U43 · Service worker / versionnage | KEEP — Utile pour PWA ; ne pas confondre shell hors ligne et données live | Conserver SW et numéros de release sur branche de travail. | Aucun | Lecture des assets et index | Nouvelle version/cache requis avant release approuvée | DOCUMENTÉ — KEEP |
| U44 · Fonctions mortes et variables orphelines | REMOVE — Après contrôle d’usage, voir section dette technique | Supprimer seulement après recherche de références. | app.js; engine-core.js; signal-engine.js | orphan-reference-proof + baseline | Neuf helpers, état de survol, branche morte et calculs locaux retirés | CORRIGÉ |
| U45 · Connecteur frontend de veille minute inutilisé | REMOVE — `hosted-config.js`/`hosted-feed.js` débranchés ; conserver archive si utile | Conserver en archive active du dépôt : modules testés séparément. | README.md; server/README.md | hosted-feed.test + index sans script | Pas une dépendance frontend ; suppression intégrale non justifiée | DOCUMENTÉ — D10 conservation proposée |
| U46 · Ancien service Railway | DOCUMENT — Isolé de la baseline ; décider séparément maintien/coût/archivage | Corriger documentation de connexion obsolète, conserver service. | server/README.md | server tests ; configuration lue | Usage/coût déployé non vérifié, aucune extinction | DOCUMENTÉ — D10 conservation proposée |


## 6. Matrice de dette technique

| ID / état initial | Action | Fichiers modifiés | Tests / preuve | Résultat | État final de ce passage |
|---|---|---|---|---|---|
| T01 · app.js monolithique | Conserver maintenant ; pas de refactor massif. | README.md | Suites intégration et navigateur | Lisibilité future reste une dette justifiée | DOCUMENTÉ — D10 |
| T02 · Dépendances globales/circulaires | Harnais de tests partagé ; modules runtime conservés. | tests/harness.cjs; README.md | Tests du même code réel | Pas de réécriture du chargement | DOCUMENTÉ — D10 |
| T03 · État mutable/timers | Ajouter révision de page et annuler requêtes rendues obsolètes. | app.js | audit-p2 quatre courses | Portion navigation corrigée ; état canonique réservé | DOCUMENTÉ — A corrigé, D06/D07 |
| T04 · Schémas partagés absents | Normaliser historique, défendre stockage/import ; schéma commun réservé. | app.js | audit-p1/storage | Casse du format corrigée, architecture complète non engagée | DOCUMENTÉ — D02/D07/D08 |
| T05 · Cascade CSS index + experience | Conserver sans suppression spéculative. | Aucun | Captures quatre largeurs | Baseline visuelle protégée | DOCUMENTÉ — D10 |
| T06 · Pas de workflow de tests | Ajouter gate CI Node indépendant du déploiement. | .github/workflows/test.yml | Mêmes commandes localement au vert | Workflow fourni ; exécution distante non encore attestée | CORRIGÉ |
| T07 · Oracles synthétiques insuffisants | Ajouter tests sur vrais chemins, événements retardés et erreurs. | tests/*.test.cjs; browser-audit.cjs | 43 tests + engine/hosted + navigateur | Jeux synthétiques conservés comme diagnostics, pas preuve de profit | DOCUMENTÉ — A traité, D09/D10 |
| T08 · shortDiagnostics/obv/lineChart/backtestFmt | Supprimer définitions sans appels après recherche intégrale. | app.js | orphan-reference-proof.json + suites | Aucun chemin applicatif supprimé | CORRIGÉ |
| T09 · trValue/nearestLevels/pctMove/clampPrice + clamp01 | Supprimer helpers sans appels, dont nearestLevels cassé. | engine-core.js; signal-engine.js | Références et snapshots identiques | Pas de réactivation fictive OBV ou helper | CORRIGÉ |
| T10 · csForHover | Retirer écritures et global remplacé par données SVG. | app.js | Rendu graphique + navigateur | Sélection V8.9.15 conservée | CORRIGÉ |
| T11 · REGIME_PROFILES.tf/priority/avoid | Conserver comme métadonnées explicitement non actives. | engine-core.js; README.md | Aucune consommation/pondération ajoutée ; baseline | Pas d’activation silencieuse | DOCUMENTÉ — D10 |
| T12 · ADX imbriqué | Réserver réparation stratégique F07. | Aucun | Sonde audit ; baseline | Défaut identifié mais non appliqué | DOCUMENTÉ — D01 |
| T13 · oiRatio | Retirer faux tri ; conserver valeur neutre dans moteur. | app.js; index.html; README.md | audit-ui + baseline | Définition/unités à décider au Signal Audit | DOCUMENTÉ — D10 |
| T14 · ap/smaVals et trs locaux dans ADX | Supprimer calculs dont le résultat n’est jamais lu. | engine-core.js | Snapshots scores/niveaux identiques | Moins de calcul sans nouvelle formule | CORRIGÉ |
| T15 · baseVol/quoteVol | Conserver pour traçabilité des unités du décodeur. | README.md | experience: normalisation/cache | Faible coût ; pas de suppression de données utiles | DOCUMENTÉ — conservation justifiée |
| T16 · signalModel vs adaptive.shared/signals | Expliquer modèles distincts, ne pas les fusionner sans décision. | app.js; README.md | baseline + audit-ui | Promesse de source unique corrigée, objectif encore futur | DOCUMENTÉ — D06/D10 |
| T17 · sdR/Wilson/proposal.configs | Conserver diagnostics purs de dispersion/incertitude. | README.md | learningStats et labs inchangés hors filtre F03 | Aucun pilotage des poids ; futur usage à arbitrer | DOCUMENTÉ — D10 |
| T18 · lastScanPerformance | Conserver diagnostic coût réseau/durée. | README.md | experience: lectures/cache | Mesure utile, pas de nouvelle collecte persistante | DOCUMENTÉ — conservation justifiée |
| T19 · TP2/TP3 dans statistiques | Conserver compatibilité historique ; dire que live finit TP1. | app.js; README.md | baseline TP1 + audit-ui | Aucun suivi TP multiple inventé | DOCUMENTÉ — D07 |
| T20 · Branche openDeep simScenario | Retirer entrée sans aucun appel UI ; simulateurs actifs préservés. | app.js | Recherche toutes références ; experience + navigateur | Pas de simulateur utile supprimé | CORRIGÉ |
| T21 · hosted-config/hosted-feed | Conserver modules testés, documenter déconnexion réelle. | README.md; server/README.md | hosted-feed.test, index | Le service n’est pas le stockage du Learning | DOCUMENTÉ — D10 |
| T22 · Sélecteurs CSS historiques (analysisTabs etc.) | Ne pas supprimer sans inventaire CSS complet. | Aucun | Cascade/captures | Dette conservée pour refonte fonctionnelle autorisée | DOCUMENTÉ — D10 |


## 7. Comparaison à la baseline et critère de sortie

| Axe | V8.9.15 | Branche après corrections A |
|---|---|---|
| Identité visuelle | Beige/bleu sombre/vert, grand titre et couches existantes | Conservée ; seuls contrôles inactifs/libellés ciblés changent |
| Univers / profondeur du scan | Spot USDT et X-Perp ; six horizons | Conservés et testés ; pas de préférence petites/grandes cryptos |
| Scores / pondérations | Plusieurs modèles et poids fixes | Inchangés sur snapshots ; données aberrantes désormais refusées dans les cas visés |
| REST graphique | Réponse parfois écrasée par ancien raw | Réponse récente conservée ; WS concurrent protégé |
| Statistiques | Populations différentes selon synthèse | Même filtre vérifié pour toutes les synthèses |
| Journal | Trous internes non détectés, résultats possibles sur futur marqué clos | Trous internes non vérifiables, barres futures non utilisées ; règles B restantes préservées |
| Sauvegarde | Types invalides et quotas pouvant interrompre sans indication fiable | Validation défensive et erreur explicite ; sécurité multi-clés/export reste à décider |
| Learning | Statistiques et laboratoires, pas d’apprentissage en production | Même portée, présentée plus honnêtement ; aucun entraînement ajouté |
| Tests | Suites de base sans gate CI | Suites de base + caractérisation/régressions ciblées + workflow + parcours navigateur |

**Critère de sortie non atteint à ce passage :** aucun constat n’a disparu, mais plusieurs P1/P2/P3 ont une décision B en attente. Les tests actuels sont au vert ; il n’existe pas de régression fonctionnelle introduite connue dans les parcours contrôlés, mais les défauts préexistants explicitement laissés sous D01–D10 restent des limites réelles. Un audit final de clôture devra être réexécuté après tes décisions et leur éventuelle mise en œuvre.

Prochaine action autorisable : trancher D01–D10, réaliser uniquement les correctifs correspondants approuvés, mettre à jour chaque état en DÉCISION VALIDÉE puis CORRIGÉ ou conservation explicite, retester et comparer la candidate finale à V8.9.15. **L’étape 2 ne démarrera pas automatiquement.**

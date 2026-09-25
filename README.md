# Institutional Radar V8.9.15

## V8.9.15 — lecture, simulation et rapidité

- Simulateur libre sous le graphique approfondi ; gains par sortie pondérés par l'allocation (0 % = 0), frais et conversion EUR explicites, quantité et contrats distingués.
- Sélection de bougie visible, repères High/Low et valeurs hors du tracé ; titre mobile agrandi.
- Seuil franchi distingué d'une confirmation complète ; motifs de blocage SHORT affichés.
- Historique en mémoire pendant la session, dernière bougie toujours rafraîchie, requêtes identiques mutualisées et file de travail sans attente de fin de lot. Le premier scan reste dépendant du réseau et des limites OKX.
- Aucun changement des scores, des six horizons ou de l'univers analysé. Le cache est comparé au chargement complet dans les tests, y compris pour le résultat du moteur.

Vérifications : `node engine.test.cjs`, `node hosted-feed.test.cjs`, `node --test experience.test.cjs server/*.test.mjs` et `node --check app.js`.

## Moteur de confluence multi-horizons

Le scan et le classement utilisent les bougies 5 min, 15 min, 30 min, 1 h, 4 h et 1 jour. Le scan et le classement ne collectent ni n’utilisent de volume sur une minute. Un graphique 1 min peut encore être consulté manuellement dans une fiche, sans influer sur le classement. L’ancien service de veille minute peut rester hébergé séparément sur Railway ; l’application ne le consulte plus.

Radar d'observation crypto sur les marchés publics OKX, publié par GitHub Pages. Aucun ordre n'est envoyé. Le score classe des configurations observées, sans représenter une probabilité de gain.

## Parcours du scan

1. Récupérer les tickers Spot USDT et les contrats FUTURES X-Perp actifs publiés par OKX, sans liste de bases imposée. Les swaps USDT publics ne sont pas traités comme disponibles sur ce compte.
2. Démarrer l’analyse multi-horizon de tous les marchés admissibles, sans requête ni seuil sur une minute.
3. Ajouter chaque Spot disposant d’un prix et d’un volume dans une file unique d’analyse approfondie, quelle que soit sa taille. L’ordre de traitement privilégie les variations sur 24 heures, sans jamais exclure les autres. Les configurations multi-horizons qui ne satisfont pas encore un scénario restent dans « Configurations à surveiller ». Les références de volume sont distinctes pour Spot et X-Perp.
4. Pour tous les marchés de la file, analyser les unités de temps, l'OI et le funding uniquement pour les X-Perps publics. Rafraîchir les tickers à la fin du scan : une cotation absente, vieille de plus de deux minutes ou décalée de plus de 1 % par rapport au prix analysé bloque le classement d'un scénario.
5. Un scénario chiffré requiert des niveaux cohérents, un prix récent, un écart achat/vente disponible et inférieur ou égal à 1 %, ainsi que des contrôles de liquidité adaptés au marché : sur X-Perp, au moins 100 000 $ de volume 24 h faute de carnet vérifié ; sur Spot, les vingt premiers niveaux du carnet doivent en outre montrer au moins 500 $ de chaque côté à moins de 1 % du prix. Ces seuils sont des filtres exploratoires, non une garantie de liquidité. Les autres configurations multi-horizons restent visibles en surveillance.

Les scénarios indiquent un déclencheur futur et une invalidation. Ils ne sont ni des ordres exécutés, ni une preuve que la profondeur du carnet suffit pour obtenir un prix donné. Avant tout ordre, il faut vérifier dans OKX le contrat, la profondeur, les frais, le glissement et le financement.

## Structure

- `market-screen.js` : ordre de traitement sans exclusion et contrôles de prix, carnet et liquidité ; chargés avant `app.js`.
- `engine-core.js` : indicateurs, régime, moteur de scénarios et scores directionnels. La suite de tests charge le même code que la page.
- `app.js` : récupération de données, affichage et suivi. Son découpage restant et un service de collecte continu seront des chantiers distincts.
- `index.html`, `sw.js`, `manifest.json`, icônes : interface et installation mobile. Le numéro de cache et les URLs des scripts changent à chaque version.
- `engine.test.cjs` : tests de règles, scénarios, couverture, exclusion des swaps non pris en charge et couverture de tous les Spot, sans filtre de taille ou de volume minute. Lancer `node engine.test.cjs` et `node --check app.js`.

Le journal conserve des scénarios `FORMING`, `ACTIVATED`, `CLOSED`, `CANCELLED` et `UNVERIFIED` dans le stockage local du navigateur. Ses résultats sont des observations de bougies, pas un relevé d'ordres. Le laboratoire historique sépare DEV, VALIDATION et HOLDOUT ; il affiche la moyenne en unités de risque parmi les scénarios TP1/SL, ainsi que deux hypothèses de coûts aller-retour (0,2 % et 0,5 %). Ce ne sont pas les frais réels ; les scénarios sans entrée et les timeouts restent distincts. Il n'intègre pas encore le funding historique ni l'OI historique. Un échantillon de moins de 30 décisions est signalé comme insuffisant. Une bonne performance historique ne suffit donc pas à prouver la rentabilité. Ne pas effacer les données du navigateur sans avoir exporté les scénarios conservés.

## Limites à résoudre ensuite

La profondeur du carnet Spot est un instantané limité à vingt niveaux et ne garantit pas le prix d'exécution. La profondeur des X-Perps n'est pas encore convertie en dollars faute de validation de la taille des contrats ; seul l'écart et l'activité sont contrôlés pour eux. Les marchés hors du périmètre Spot USDT / X-Perp ne sont pas couverts. La disponibilité de chaque X-Perp dans le compte doit être vérifiée sur OKX. Le scan complet demande plusieurs séries de bougies pour chaque marché ; il peut durer plusieurs minutes sur mobile ou être interrompu si le navigateur se met en veille ; il faut tester le parcours sur le téléphone réel et les données live OKX. Une future collecte persistante et des mesures d'exécution issues du carnet permettraient une meilleure surveillance continue.

## Branche de traitement contrôlé de l’audit V8.9.15

Le registre d’origine est dans `docs/audit-v8915/Audit_Institutional_Radar_V8.9.15.md` ; le périmètre A/B et le rollback dans `docs/audit-v8915/CONTROL.md`. Cette branche n’est pas une nouvelle version de production. Les décisions B restent réservées à l’utilisateur et les étapes Graphiques / Signal Audit / nouveau Learning ne sont pas engagées.

Tests complets : `node engine.test.cjs`, `node hosted-feed.test.cjs`, `node --test experience.test.cjs server/*.test.mjs tests/*.test.cjs`, `node --check app.js`. Les tests Node n’utilisent pas le réseau. Le contrôle optionnel `tests/browser-audit.cjs` requiert Playwright/Chromium ; il reçoit le répertoire de baseline, le binaire Chromium et un répertoire de captures. Les endpoints OKX y sont simulés.

### Contrats et limites à conserver explicitement

- Le score Radar, la confiance des familles, le biais directionnel et le score adaptatif ont des rôles distincts. Les coefficients sont inchangés ; les fixtures de la baseline protègent leurs résultats.
- Les catégories « petites / grosses » désignent le rang de volume 24 h du marché, pas une capitalisation. `medVol` est une moyenne transversale, `marketMedianVol` une médiane transversale. Le volume `c.v` est déjà en cotation.
- Le prix du tracé est celui de sa dernière bougie ; le ticker de la projection est une autre observation. Les instantanés n’ont pas encore une source temporelle unique.
- Une configuration admissible dans le Radar n’est pas une entrée activée. L’état activé et l’issue du journal sont des observations théoriques, sans ordre d’exchange. Les règles de retest et d’invalidation restent sous arbitrage B.
- Le suivi actuel s’exécute uniquement dans la projection ouverte ; TP1 ou SL termine une observation. Ni suivi complet des favoris, ni expiration automatique, ni répartition du simulateur ne sont exécutés en arrière-plan. Le simulateur reste une hypothèse indépendante.
- Le journal enregistre la projection ouverte, pas tous les scans. Les statistiques descriptives n’entraînent pas les poids. Le laboratoire synthétique comporte 11 cas fixes ; le laboratoire historique n’est pas encore une validation statistique ou une reproduction fidèle du live.
- La limite de 1 500 observations, les conflits d’import et la transaction multi-clés restent documentés pour décision ; l’export du journal n’exporte pas tous les favoris/verrous. Les écritures impossibles sont maintenant signalées, les imports mal formés refusés et les anciens résultats exclus uniformément des statistiques.
- `REGIME_PROFILES.tf/priority/avoid` est de la métadonnée non active. `baseVol/quoteVol` est conservé pour tracer les unités. Wilson, `sdR`, `proposal.configs` et `lastScanPerformance` restent disponibles pour diagnostic ; ils n’alimentent aucune adaptation automatique.
- `hosted-config.js` et `hosted-feed.js` sont des modules historiques testés mais non chargés par l’index. Le service `server/` reste autonome. Sa suppression ou reconnexion n’est pas impliquée par le nettoyage du frontend.

Le monolithe `app.js`, les dépendances globales et la cascade CSS sont conservés pour éviter un refactor massif. Le nettoyage supprime uniquement les définitions dont toutes les références ont été vérifiées ; la preuve est enregistrée dans `orphan-reference-proof.json`. Les fusions de moteurs et de graphiques restent des décisions B et des chantiers ultérieurs.

### Décision de fraîcheur (D05 validée)

La configuration est centralisée dans `RadarMarket.policy` (`market-screen.js`) : âge technique maximal = `analysisIntervals` (2) × intervalle du déclencheur ; ticker <= `tickerMaxAgeMs` (120 000 ms) ; dernière clôture de chacun des six horizons âgée d'au plus `horizonIntervals` (2) × son propre intervalle. Les bornes sont inclusives ; timestamps futurs et absents sont refusés. Ces paramètres sont réévaluables à cet endroit, pas appris automatiquement. Le seuil par horizon évite de considérer un 1D périmé comme frais parce que le ticker l'est.

Une analyse périmée suspend l'admission/l'activation. Le bouton d'actualisation recharge les six horizons et conserve les niveaux du verrou. Une entrée déjà observée reste une observation activée : l'issue TP1/SL peut encore être établie par les bougies clôturées disponibles. La péremption n'est ni une invalidation, ni une expiration du scénario. Le graphique et son warmup restent ceux de la baseline, en attente de l'étape 2.

### Admission cohérente (D06 validée)

`candidateModel` applique les profondeurs DECISION_SPECS du scan. `admitScenario` est appelé par classement, cartes et première création de verrou : six horizons, fraîcheur, contrôles d'exécution, instrument exact, sens/kind admissible et niveaux valides. Les scores directionnels sont ceux renvoyés par le moteur, bonus SHORT inclus. `chooseFreshScenario` ne remplace jamais un kind explicitement demandé ; le clic de classement conserve ID/marché/sens/kind. La page annonce le recalcul avant de proposer les niveaux. Une configuration disparue produit un refus explicite.

La projection d'un verrou existant conserve son instrument, son sens et ses niveaux. L'admission d'un nouveau verrou ne contourne pas le carnet Spot ou le listing X-Perp. Les six horizons de décision sont séparés du nombre de bougies visibles ; le warmup des indicateurs de graphique reste une dette approuvée pour l'étape 2.

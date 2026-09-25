# Étape 2 Graphiques — registre d'exécution

Autorisation utilisateur : L0 à L7, 25 septembre 2026. Baseline de production :
`bd5c19f46eebad03ff8bd1f0d0ca7ef2797fb7c8`, arbre `2a568eafdd38de88572cffc56259f9fb0f3bc8fe`.
Branche distincte : `charts/v8.9.17-rc.1`. Aucun merge ni déploiement autorisé par cette exécution.

Garde-fous : six horizons, univers, helpers mathématiques, admission, scores, pondérations,
verrous et suivi inchangés. Les interactions graphiques ne deviennent jamais des événements métier.
Les données locales existantes ne sont pas migrées. Une clé de préférences graphiques indépendante est permise.

## L0 — Caractérisation

- Tests des références de calcul, défauts G01/G04/G06/G07, inventaire des usages et isolation de la lecture.
- Reproductions connues : les tests nomment le défaut historique ; leur modification ultérieure devra expliciter
  le résultat avant/après. Aucun snapshot métier ne sera remplacé.
- Suites existantes conservées pour le suivi, le stockage et les calculs du simulateur.
- Aucun code applicatif modifié dans ce lot.

## Validation du renderer

Lightweight Charts reste un prototype isolé tant que l'ensemble des critères n'est pas démontré.
Une recette tactile simulée ne sera pas présentée comme un essai physique Android/iOS.
Le renderer SVG demeure le choix de repli autorisé.

## Rollback

Chaque lot est un commit autonome. Revenir au commit du lot précédent ou inverser le lot ;
ne jamais réécrire la branche de production. La baseline ci-dessus reste le point de retour complet.

## L1 — Contrats et séparation

- `chart-core.js` fournit des modèles copiés/immuables et un état visuel sans réseau ni stockage.
- Les contrôles de projection relisent un snapshot ; ils n'appellent plus le moniteur, l'admission ou le journal.
- Le rafraîchissement métier reste à 15m + horizon déclencheur verrouillé (comportement par défaut V8.9.16).
  Le timeframe consulté ne choisit plus les données rafraîchies du moteur. Ce découplage est celui autorisé ;
  les règles de confirmation et de résolution ne changent pas. Une série 1m consultée reste hors `scenarioMonitorFrames`.
- Validation : 50 tests ciblés passent, dont toutes les décisions D01–D10 et les verrous/suivi existants.
- Rendu SVG historique maintenu à ce stade. Aucune formule ni pondération modifiée.

## L2 — Références de calcul

- Provider `chart-series.js` : mathématiques injectées depuis les helpers existants, aucune nouvelle formule.
- Référence moteur : séries calculées sur les exactes `e.F[tf].cs`, donc mêmes bougies confirmées et amorçage.
- Consultation : origine de calcul stable pendant la session. Un préchargement antérieur ajoute les bougies,
  pas un nouvel amorçage ; les indicateurs sont indisponibles avant l'origine existante. Un renouvellement
  explicite de la référence permet un calcul sur l'historique élargi (version de données distincte).
- Les séries sont indexées par timestamp. Les tableaux visibles ne changent pas le provider.
- 25 tests ciblés passent : invariance de toutes les séries, parité avec le RSI/EMA du modèle, six horizons,
  route classement → fiche → verrou identique, conservation des corrections REST/WS.
- Migration de la fiche/Prix vers ces contrats prévue en L5, sans anticiper le remplacement du renderer.

## L3 — Prototype isolé, pas de généralisation

- Lightweight Charts 5.2.1 fourni dans `prototypes/` uniquement, avec bundle figé, licence, NOTICE et fixture.
- Critères de fluidité/pinch/accessibilité non démontrables dans le navigateur Work qui refuse la recette locale.
- Décision appliquée : SVG conservé pour l'application. Voir `L3-renderer-decision.md`.
- Aucun script ni cache de production ne charge le prototype ou sa bibliothèque.

## L4 — Interactions et lisibilité

- Nouveau renderer SVG `chart-panel.js` derrière le ViewModel ; aucune dépendance au moteur.
- Densité : pas préféré 9 px, pas minimal 4 px, corps 68 % du pas (plafond 14 px).
  Tests sur 3 000 bougies et conteneurs 240/288/318/360/390/768/1440 px : ouverture avec corps >5,5 px.
- Auto-fit des seuls High/Low visibles ; niveaux distants signalés hors champ ; fit de niveaux explicite.
- Pan, zoom ancré, suivi du dernier cours, inspection par timestamp, repères H/L, clavier, boutons 44 px,
  gestion de deux pointeurs, scroll vertical laissé au navigateur, panneaux optionnels et trois prix distincts.
- Préférences exclusivement graphiques ; styles dans `chart.css`, sans changement des styles globaux.
- 7 tests de géométrie/DOM passent. Ils simulent les événements et ne prouvent pas les gestes natifs physiques.
- Dépendance de test uniquement : jsdom 26.1.0, lockfile ; `npm ci --ignore-scripts` ajouté au gate CI.
- Intégration aux quatre usages réservée au lot suivant ; aucun remplacement global prématuré.

## L5 — Migration des quatre usages

- Fiche, Prix (route commune avec approfondi), approfondi et projection utilisent `chart-host.js` + SVG commun.
- Consultation : minimum 300 bougies, réserve 100, charge max 3 000, session bornée 6 000 ; paramètres centralisés,
  uniquement pour les graphiques. Les six `DECISION_SPECS` sont inchangés. Les anciens indicateurs de fiche
  hors graphique gardent leur fenêtre de 180 pour ne pas changer leur signification indirectement.
- 30m disponible dans la toolbar. Le polling REST reste actif et son texte l'indique correctement.
- Validation OHLC commune pour l'affichage WS ; réponse REST et message concurrent ordonnés comme F06.
- Projection : référence moteur par défaut quand vérifiable, overlays du verrou exacts, structure actuelle nommée
  et datée, événements observés seulement. La consultation recharge ses propres séries sans modifier les frames métier.
- Les nœuds du graphique et du simulateur sont conservés au refresh du moniteur ; saisie conservée même hors focus.
- Tests F06 adaptés aux nouveaux libellés et au ViewModel réel ; fixture corrigée pour que High ≥ close (avant : OHLC
  impossible, accepté par le vieux rendu). Sens du test REST/WS inchangé. Aucun snapshot métier régénéré.
- Harnais Node enrichi de nœuds DOM réels ; tests des champs et contrôles réels, distincts d'une recette navigateur.
- Validation : 99 tests de la suite Node passent, dont 3 nouvelles intégrations. Mathématiques/engine-core,
  signal-engine, market-screen, candle-store et trade-sim non modifiés.

## L6 — Métriques et nettoyage ciblé

- `chart-metrics.js` : observations placées au timestamp, zéros conservés, lacunes non reliées ; OI/Score en
  points observés, Funding/Volume en histogrammes, Momentum signé avec axe zéro. Sélection date/valeur.
- OI/Funding/Score n'affichent plus les boutons de timeframe sans effet. Couverture réellement disponible
  et limite de 100 événements Funding explicites. Funding manquant reste absent, jamais remplacé par zéro.
- Sparklines/jauges Funding et Momentum signées ; source et intervalle des aperçus précisés. Aucun signal changé.
- Après recherche des appels JS, handlers et tests : retrait de `proChart`, `projectionChart`, `lineSvg`,
  `svgPath`, `chartHover`, `chartReadout`, `chartSelectionMarkup`, `chartSelections`, `axisTime` et du zoom ancien.
  Les sélecteurs CSS associés sont retirés ; dans les règles mixtes, les autres sélecteurs sont conservés.
- Caractérisations L0 G04/G06/G07 converties en tests de correction : positions temporelles au lieu de 78/480/882,
  niveau absent au lieu de « Missing TP 0 », extrema des bougies au lieu de TP3=150. Les preuves initiales restent
  dans le commit L0 et l'audit. Aucun snapshot de score, scénario, admission ou déclencheur n'a été régénéré.
- F18 teste le même volume de cotation via le nouveau composant ; F25 teste les trois prix du composant commun.
- Retour vers la fiche : son propriétaire recharge et réattache les contrôles après disposition du graphique.
  Un même host changeant d'instrument ne réutilise pas le provider de l'ancien contrat.
- Validation : 104 tests Node passent ; cinq nouvelles vérifications métriques/navigation.

# Institutional Radar — candidate Graphiques V8.9.17-rc.1

Date : 25 septembre 2026. Baseline : V8.9.16, commit `bd5c19f46eebad03ff8bd1f0d0ca7ef2797fb7c8`.
Branche séparée : `charts/v8.9.17-rc.1`. **Aucune fusion, aucun déploiement.**

**Décision de clôture : validation technique préparée ; adoption bloquée par la recette native restante.**
L0–L6 sont implémentés. L7 fournit le gate automatisé, les preuves statiques et la candidate ; la fluidité
réelle, le pinch physique, le rendu responsive natif, le lecteur d'écran et le service worker en navigateur
ne sont pas déclarés validés. Le navigateur Work a refusé la navigation locale (`ERR_BLOCKED_BY_CLIENT`)
puis le protocole de fichier partagé (politique de sécurité). Aucun contournement n'a été entrepris.

Le SHA final et la CI correspondante doivent être lus dans la PR en brouillon et dans le rapport de livraison.
Une réussite CI ne lève pas le gate navigateur. La production V8.9.16 reste la référence déployée.

## Architecture livrée

| Propriétaire | Responsabilité | Interdiction protégée |
|---|---|---|
| `candle-store.js`, propriétaires de page | REST, erreurs, ordre REST/WS, instrument exact | Aucun endpoint inventé par le renderer |
| `app.js` helpers existants | EMA, RSI, StochRSI, Supertrend | Formules identiques à V8.9.16 |
| `chart-series.js` | Séries par timestamp, référence/version/origine de calcul | Le viewport ne réamorce pas les indicateurs |
| `chart-host.js` | Adaptation des entrées, références, préférences, historique borné | Aucun appel au score/admission/journal |
| `chart-core.js` | ViewModel immutable et ViewState de consultation | Aucune dépendance réseau, stockage ou analyse |
| `chart-panel.js`, `chart.css` | SVG, viewport, sélection, gestes, lecture, overlays | Aucun calcul de niveau/scénario/signal |
| `chart-metrics.js` | Observations datées, points/histogrammes, petites séries SVG | Pas d'interpolation ni de zéro fictif |
| Moniteur, verrou, journal existants | Confirmation, invalidation, résolution, événements observés | Aucun geste graphique ne les déclenche |
| `trade-sim.js`, état du formulaire | Calcul et hypothèses des simulateurs | Aucun effet sur verrou/journal |

Lightweight Charts 5.2.1 reste un prototype isolé sous `prototypes/`, avec licence/NOTICE/attribution.
Il n'a pas été promu faute de preuves des critères natifs. Le SVG utilise les mêmes contrats ; aucune
bibliothèque graphique ne s'ajoute au cache de production. Voir `L3-renderer-decision.md`.

## Références, fenêtres et historique

- **Référence moteur** : indicateurs calculés sur les exactes bougies confirmées `e.F[tf].cs` de l'analyse
  actuellement disponible. Défaut de la projection lorsqu'elle existe. La date affichée est la clôture
  de cette référence. Ce n'est jamais une prétendue reconstruction de la création historique du verrou.
- **Consultation historique** : origine fixée au premier chargement de la session. Un prepend antérieur
  ajoute des bougies consultables, mais laisse les indicateurs antérieurs indisponibles et préserve les
  valeurs existantes. L'action explicite « Renouveler la référence historique » change cette référence/version.
- Politique graphique centralisée : minimum 300 bougies, réserve 100, chargement jusqu'à 3 000, pas de 600,
  session bornée à 6 000. Au dépassement, un avertissement demande un renouvellement explicite ; aucune
  réinitialisation silencieuse de l'origine. Les plafonds et la couverture réelle sont affichés.
- Six horizons moteur inchangés : 1D/120, 4H/100, 1H/140, 30m/140, 15m/180, 5m/180.
  Le 1m reste seulement consultable. Les pages fiche/Prix/profondeur/projection partagent le provider.
- Le moniteur rafraîchit le 15m par défaut et le timeframe du verrou ; la consultation charge son propre
  timeframe. L'ancien lien « changer de TF → repasser dans candidateModel/journalAdvance » est supprimé.
  Les règles métier et la cadence du moniteur demeurent celles de la baseline.

## Inventaire des usages C01–C12

| ID | Décision | Livraison et preuve |
|---|---|---|
| C01 Fiche | MERGE / KEEP | Host commun, 300 bougies au chargement et refresh, erreur explicite ; retour fiche réattache son propriétaire |
| C02 Approfondi | IMPROVE | Viewport lisible, 30m, historique, références, simulateur immédiatement dessous ; tests DOM/intégration |
| C03 Prix | MERGE | Route approfondie commune, contexte initial 1 jour ; aucun accès retiré |
| C04 Projection | MERGE / KEEP | Rendu read-only, verrou exact, source moteur explicite, événements observés ; état/simulateur conservés |
| C05 Volume | IMPROVE | Histogramme volume de cotation, unité et intervalle ; F18 + tests métriques |
| C06 Momentum | KEEP / IMPROVE | Variations signées, axe zéro, lacunes visibles |
| C07 OI | KEEP / IMPROVE | Points de scans aux vrais timestamps, aucune continuité inventée ; contrôles TF retirés |
| C08 Funding | KEEP / IMPROVE | Événements signés, limite 100 et couverture réelle, absence explicite ; contrat exact |
| C09 Score | KEEP / IMPROVE | Points réellement observés, score 0 valide, pas de contrôle TF sans effet |
| C10 Sparklines | KEEP / IMPROVE | SVG léger par timestamp ; signe et trous préservés, période/source indiquées |
| C11 Jauges | IMPROVE | Bornes indicatives conservées, Funding/Momentum signés ; pas de nouvelle pondération |
| C12 Barres/MTF | KEEP | Affichage et sorties métier conservés ; pas de nouveau calcul dans les graphiques |

## Matrice des constats G01–G19

« Implémenté/testé » désigne les tests automatisés, pas une certification tactile native.

| ID | Action et fichiers principaux | Preuves | État |
|---|---|---|---|
| G01 | `chart-series`, `chart-host` : références/viewport séparés | `charts-series`, parité RSI/EMA, origine prepend stable | Implémenté/testé |
| G02 | `app` : rendu projection séparé du suivi | `charts-contracts`, `charts-integration`, hash métier | Implémenté/testé |
| G03 | `chart-core/panel` : zoom/pan/pinch/historique | `charts-render`, `charts-dom` | Implémenté ; gestes natifs à valider |
| G04 | `chart-core/metrics` : espacement temporel réel | Ratio 1/61 au lieu de trois index équidistants, lacunes | Implémenté/testé |
| G05 | `chart-panel/host` : ticker/open/close distincts, expiration | F25, test deadline live avant/après | Implémenté/testé |
| G06 | `chart-core` : validation stricte des overlays | null ne devient plus 0 ; L0→L6 | Corrigé/testé |
| G07 | `chart-core` : extrema limités aux bougies visibles | TP3=150 n'est plus MAX du cours ; L0→L6 | Corrigé/testé |
| G08 | `chart-panel/core` : hors champ exact, fit explicite | TP1=1000/TP3=5000, SVG mobile statique | Implémenté ; recette responsive restante |
| G09 | Adaptateurs : cotation USDT pour Spot USDT, USD pour X-Perp de l'univers | F18 + fixtures contrats exacts + labels | Implémenté/testé dans cet univers |
| G10 | `chart-panel/host/css` : toggles et préférences locales | DOM, aucune mutation modèle ; RSI/Stoch repliés par défaut | Implémenté/testé |
| G11 | `app` : 30m + retrait TF métriques sans effet | `charts-metrics`, contrôles selon source | Corrigé/testé |
| G12 | `app/host/panel` : couverture réelle et limites explicites | Tests de sources, intervalle de dernière bougie inclus | Implémenté/testé |
| G13 | `app/metrics` : signes des aperçus et contexte volume | Tests signe, absence d'abs dans les aperçus | Corrigé/testé |
| G14 | `chart-panel` : timestamp/OHLCV précis, fuseau, état/H-L | Tests sélection append/prepend/resize/clavier | Implémenté ; doigt/lecteur d'écran à valider |
| G15 | `chart-panel/host/app` : ResizeObserver, hosts stables, rAF | Même champ simulateur et sélection après refresh | Implémenté ; layout/performance native à mesurer |
| G16 | `app/core` : validation OHLC du WS, rendu rAF et texte polling réel | F06, engine MockSocket, dernier modèle actualisé | Implémenté/testé ; reconnexion native à valider |
| G17 | `chart-host/app` : structure actuelle datée, aucun faux historique/zone | Structure exacte, six références, ancien verrou conservé | DOCUMENT / KEEP appliqués |
| G18 | `app/host` : âge/erreurs visibles, données conservées quand possible | Tests de store et erreurs, libellés selon source | Implémenté/testé |
| G19 | `chart-metrics` : zéro distinct de null, gaps non reliés | Score zéro, funding absent, timestamps absents | Corrigé/testé |

## Comparaison avec V8.9.16 et preuves

- `tests/fixtures/charts-business-v8916.json` a été extrait du **commit de production V8.9.16**, pas de la
  candidate. Il protège par SHA-256 44 fonctions : scan, candidats, admission, fraîcheur, niveaux, biais,
  confirmation, journal, Learning actuel, sauvegarde/restauration et simulateur. Elles sont inchangées.
- `engine-core.js`, `signal-engine.js`, `market-screen.js`, `candle-store.js`, `trade-sim.js` : identiques octet
  pour octet. Aucun snapshot de score/admission/niveau/scénario régénéré. Les tests D01–D10 restent présents.
- Les assertions de rendu L0 G04/G06/G07 ont été remplacées par leurs assertions de correction documentées
  dans `CONTROL.md`. F06 utilise maintenant un OHLC cohérent (High ≥ Close) et lit le nouveau ViewModel.
- Le gate historique `engine.test.cjs` attendait exactement six scripts et V8.9.16. Il vérifie désormais
  les onze scripts attendus et la RC, avec les stubs DOM requis. Ses assertions métier sont inchangées.
- Préférences sous `ir_chart_visibility_v1`, séparées des clés de données existantes. Aucune migration
  des favoris/verrous/journal. Les tests de restauration versionnée et rétention de l'étape 1 restent actifs.
- `evidence/style-comparison.json` prouve l'identité des styles hors sélecteurs graphiques orphelins.
  Couleurs, cartes, typographie, dégradés et navigation ne sont pas redessinés.
- `evidence/candidate-*.png` et `baseline-*.png` sont des **rendus SVG statiques de fixtures synthétiques**
  exportés par Inkscape, pas des captures de navigateur ni du marché. Vérification visuelle faite à 318
  et 1368 px ; génération aussi à 288 et 696 px. Exemple extrême volontaire : TP1=5000, cours ~120.
- Sur 3 000 bougies chargées : 22/26/68/142 visibles pour conteneurs 288/318/696/1368 px ; corps ~6,1–6,3 px.
  Le p95 de génération SVG Node mesuré est inférieur à 3,1 ms dans ce run. **Ce chiffre n'inclut ni DOM,
  layout, paint, appareils mobiles ni latence tactile** ; il ne valide pas la fluidité réelle.

## Validation automatisée et limites

Gate local vert : `npm ci --ignore-scripts`, `npm test` (syntaxe app, engine, hosted-feed, experience, serveur et
110 tests Node réussis). Les modules graphiques ont aussi été contrôlés syntaxiquement.
La CI GitHub utilise Node 22 et le même gate. Les logs locaux sont conservés dans `evidence/L7-gate.log`.
L'étiquette de version, les assets et le cache sont tous `8.9.17-rc.1` ; le prototype n'est pas pré-caché.
La réussite CI doit correspondre au SHA exact de la branche candidate ; le rapport de livraison l'indique.

Complément de recette : une référence moteur n'est proposée que si son `instrumentId` correspond au contrat
exact consulté. Le test reproduit l'ancien mélange de références puis vérifie l'indisponibilité des séries
moteur/structures dans ce cas ; le modèle métier n'est pas corrigé ni réécrit par le graphique.

Le push Git local étant indisponible faute d'authentification, les lots ont été transférés par le connecteur
GitHub. Leurs arbres de fichiers ont été comparés et sont identiques ; les métadonnées de commit donnent de
nouveaux SHA distants. `evidence/github-transfer.json` conserve la correspondance des huit lots initiaux.
Les commits locaux ne sont pas annulés. Un complément L7 répare une image statique vide et ajoute la garde de
contrat ci-dessus ; cette révision repasse le gate complet et doit recevoir sa propre CI.

Limites restantes, à ne pas masquer :

1. Recette native non exécutée : voir `Recette_Native_RC.md`. Ce gate bloque l'adoption, pas la préparation
   de la branche. Les PointerEvents synthétiques ne prouvent pas un pinch utilisable sur iOS/Android.
2. Le SVG est reconstruit une fois par frame programmée ; les hosts et contrôles restent stables. La
   performance DOM réelle et la consommation mémoire en navigation prolongée restent à mesurer. Une
   optimisation incrémentale du tracé pourra être nécessaire sur un appareil lent, sans modifier les contrats.
3. Les erreurs API externes restent possibles. Aucun contournement réseau ni changement de backend n'a été ajouté.
4. Le verrou V8.9.16 ne contient pas toute la série d'origine : aucune interface ne peut prouver ce qui n'a
   pas été conservé. La référence moteur affichée est celle de l'analyse disponible, clairement nommée.
5. L'historique Funding reste plafonné aux 100 événements reçus ; OI/Score aux observations locales disponibles.
6. Les niveaux structurels sont ponctuels et actuels, pas des zones. TP2/TP3 sont optionnels et non suivis
   par le journal terminal à TP1. Aucun ordre réel n'est prétendu exécuté.

## Continuité de la dette étape 1

| Référence | Traitement étape 2 |
|---|---|
| F21 / U23 / D06–D10 | Warmups graphiques unifiés par contrat et référence ; les fenêtres décisionnelles restent intactes |
| U24 | Sélection timestamp, viewport, gestes ; acceptation native ouverte |
| U25 | Rendu isolé du cycle de suivi, snapshots read-only et verrous exacts |
| U26 | Badges remplacés par vrais toggles ; préférences purement graphiques |
| U27 / U28 | Deux simulateurs conservés ; DOM et saisie stables au refresh |
| F06 / F18 / F22 / F25 | Ordre REST/WS, volume de cotation, résultats tardifs, fraîcheur/prix toujours testés |
| T05 / T22 | Suppression limitée aux renderers/sélecteurs sans appel après migration, preuve CSS conservée |
| Autres structures métier | Conservées ; aucune fusion stratégique, aucun Signal Audit ni Learning supplémentaire |

## Rollback et adoption

La candidate n'étant pas publiée, le rollback actuel est simplement de garder V8.9.16.
Les commits L0–L7 sont séparés et aucun commit existant n'a été annulé ou réécrit.
Après une éventuelle adoption autorisée : utiliser un **revert Git** des commits/fusion concernés, sans reset
ni force-push. Revenir aux assets cohérents du commit V8.9.16 ou préparer une release de rollback avec une clé
de cache neuve, puis revérifier la version servie. Ne pas effacer le stockage métier ; seule la préférence
`ir_chart_visibility_v1` est nouvelle et l'ancienne application l'ignore. Exporter la sauvegarde complète avant
tout essai de migration/déploiement. L'exécution de ce rollback ou d'un déploiement nécessite une autorisation.

L'adoption reste soumise à la recette native et à l'accord utilisateur. Aucun travail Signal Audit,
instrumentation Learning, nouveau Learning Engine ou évolution stratégique n'a été engagé.

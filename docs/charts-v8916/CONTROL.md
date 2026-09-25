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

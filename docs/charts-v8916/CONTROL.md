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

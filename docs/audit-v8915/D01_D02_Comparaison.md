# Comparaison explicite des corrections ADX / bougies clôturées

Les snapshots V8.9.15 restent intacts dans `tests/fixtures/v8915-models.json`. Ils ne sont pas régénérés. Les différences autorisées sont exprimées séparément dans les assertions et ce registre.

## D01 : ADX

Le champ réellement calculé est `feature.t.adx`. Les anciennes lectures `feature.adx` donnaient `undefined` dans le choix du déclencheur, les confluences, le signal ADX et le bonus de confiance. Aucun coefficient n'a changé.

| Cas (pente ; échelle) | ADX | Confluence avant → après | Direction LONG/SHORT, niveaux, régime, ancrage, déclencheur, éligibilité |
|---|---:|---|---|
| −0,1 ; 1 | 100 | 89 → 100 | Identiques |
| −0,1 ; 10⁻⁷ | 100 | 89 → 100 | Identiques |
| 0 ; 1 | 68,3720 | 69 → 81 | Identiques |
| 0 ; 10⁻⁷ | 68,3720 | 69 → 81 | Identiques |
| +0,1 ; 1 | 100 | 89 → 100 | Identiques |
| +0,1 ; 10⁻⁷ | 100 | 89 → 100 | Identiques |

Chaque cas gagne une confluence ADX (+6) et retrouve le bonus ADX >25 (+6), plafonné à 100. Le cas oscillant de pente nulle n'est pas une preuve d'ADX correct pour tout marché : c'est une série synthétique dont la formule actuelle donne 68,37. La correction d'accès ne redéfinit pas la formule. Le label de décision de ce cas passe WATCH → SETUP, mais ne crée pas de scénario admissible à lui seul ; l'éligibilité reste contrôlée séparément.

Le test de départ constate ADX « neutral » au lieu de « positive ». Le test de départage force deux horizons identiques, sauf ADX : le déclencheur passe de 5m à 15m grâce au bonus +1 déjà présent. C'est une conséquence attendue autorisée, pas une pondération nouvelle.

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

## D02 : exclusion de la dernière bougie en formation

La dernière barre (indice 179, confirm=0) est désormais exclue **avant tous les indicateurs et niveaux de décision**. Les graphiques gardent leur barre ouverte. Le prix de décision de ces fixtures était déjà l'indice 178 : il reste identique. Le fichier `tests/fixtures/d02-reviewed-deltas.json` contient chaque champ avant/après, appliqué comme delta vérifié à la référence immuable, pas comme nouvel oracle généré.

- Cas baissiers (0/1) : fenêtres de 80 barres déplacées d'une barre ; résistance 90,973471 → 91,023918 (+0,050447), support 80,950202 → 81,097612 (+0,147410), à échelle 1. Les entrées/SL/TP cassure/rejet suivent la résistance ; celles de breakdown suivent le support ; le pullback prend le nouveau support et la nouvelle résistance. Son R/R TP1 passe 7,502477 → 7,429020, TP2/3 gardant les incréments 0,65. Risques par unité inchangés.
- Cas haussiers (4/5) : résistance 118,750202 → 118,697612 (−0,052590), support 108,973471 → 108,823918 (−0,149553). Même propagation selon le type de scénario ; R/R pullback TP1 7,315705 → 7,389162. Les cas d'échelle 10⁻⁷ ont les mêmes différences proportionnelles ; de minuscules écarts d'arrondi flottant sont consignés individuellement.
- Cas oscillants (2/3) : niveaux inchangés ; sur chacun des six horizons, ADX 68,372022 → 68,086714 et force 42,179920 → 42,240474, car EMA/ROC/efficacité/ADX s'arrêtent une barre plus tôt. Aucun changement de biais, qualité, régime ou décision n'en résulte.
- Pour les six cas : **aucun changement supplémentaire de score, ancrage, timeframe déclencheur, direction ou éligibilité LONG/SHORT** après D01. Sur d'autres données, D02 peut légitimement changer ces éléments : la garantie est l'insensibilité à toute mutation valide de la barre ouverte, testée explicitement.

Les anciennes fixtures attribuaient artificiellement 5 minutes à tous les horizons (et d'autres tests 1 minute). Leurs timestamps sont remis à l'intervalle déclaré sans changer les OHLCV. Les snapshots de référence ne contiennent pas ces timestamps et restent intacts. Les tests de cache utilisent désormais des dates passées et l'intervalle réel : une date future n'est plus acceptée comme historique.

Le contrat refuse OHLC incohérents, prix non positifs, volume négatif, timestamps dupliqués/désordonnés, trous, date future et flag fermé avant la fin du timeframe. Un horizon invalide reste vide et son motif est conservé ; aucune bougie synthétique n'est ajoutée. La liste des marchés n'est pas réduite : leur couverture devient incomplète et ils ne peuvent être admis sans les six horizons.

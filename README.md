# Institutional Radar V8.7.3

Radar de marché Spot OKX avec Perp associé, classements LONG/SHORT, scénarios conditionnels et mémoire locale. Le score classe les configurations ; il ne mesure pas une probabilité de gain.

## Installation GitHub Pages

Publier les fichiers de ce dossier à la racine du dépôt. `index.html` charge `app.js` : ce dernier est la seule copie du moteur. `sw.js`, `manifest.json` et les deux icônes servent à l'installation PWA. Les fichiers historiques `_script.js` et `check.js` ne sont pas utilisés. Ne pas effacer les données du navigateur : l'historique et le journal restent dans le stockage local de l'origine actuelle.

## Ce qui change

- Le journal distingue `FORMING`, `ACTIVATED`, `CLOSED`, `CANCELLED` et `UNVERIFIED`. Une entrée doit être confirmée par une bougie clôturée ; une bougie ultérieure doit toucher TP1 ou SL. Si TP et SL sont touchés dans la même bougie, le SL est retenu. Une lacune de bougies rend le suivi non vérifiable.
- Les anciens résultats `IR_LEARNING_V2` sont préservés et exportables, mais exclus des statistiques. Les nouvelles observations sont `IR_LEARNING_V3`. Elles décrivent des niveaux de marché observés, **pas des ordres réellement exécutés**. Le suivi fonctionne quand la projection est ouverte ; à la réouverture, le verrou est conservé et les bougies disponibles sont examinées.
- Le laboratoire historique utilise les dernières bougies disponibles à chaque date, construit les données historiques sans réutiliser les métriques du scan actuel, attend que l'entrée soit touchée et traite rejet/cassure SHORT dans le bon sens. Sans entrée, `NO_ENTRY` est distinct de TP, SL et timeout. Un objectif touché sur la bougie d'entrée ne compte pas comme victoire faute d'ordre intrabougie connu.
- OI et funding indisponibles s'affichent `N/D` ; l'heure de consultation apparaît lorsqu'une valeur est disponible. Les échecs de séries de bougies sont isolés. Une analyse partielle est visible dans le marché mais ne certifie pas un scénario.
- Les niveaux et bougies d'un SHORT sont vérifiés sur le Perp associé. Un signal baissier repéré sur Spot n'est pas suffisant pour créer une carte SHORT.
- Le scan affiche sa progression et évite les scans simultanés. Les erreurs API transitoires sont réessayées dans une limite de trois tentatives.

## Vérification

`node tests/engine.test.cjs` vérifie les transitions du journal, les issues LONG/SHORT du laboratoire, le traitement des données absentes, la résistance d'un scan partiel, la confirmation des SHORT sur Perp et le chargement d'un seul script. `node --check app.js` vérifie sa syntaxe.

## Limites

Les taux historiques ne représentent pas la performance d'un compte de trading. Le laboratoire ne dispose pas de séries historiques d'OI, de funding, de frais, de slippage ou d'ordres exécutés. Une analyse dont les bougies manquent ne reçoit pas de scénario certifié. Les observations du journal ne peuvent pas remplacer un relevé d'ordres OKX.

## V8.7.3 — couverture et lisibilité
Tous les 150 actifs Spot retenus par volume sont analysés, et tous leurs Perps associés peuvent entrer dans la sélection SHORT. Le scan peut durer plus longtemps. Une carte « scénario conditionnel » indique que les niveaux existent, sans déclarer que l’entrée s’est produite.

Le classement affiche l'heure de fin de scan et son âge ; il ne se recalcule qu'à la demande ou au chargement. Les graphiques indiquent l'heure de consultation et la dernière bougie. Le graphique approfondi et celui de la fiche ouverte interrogent les bougies toutes les 10 secondes tant qu'ils sont ouverts ; les autres pages graphiques disposent d'un bouton d'actualisation. L'historique du funding demande l'identifiant Perp, et indique clairement l'absence de Perp le cas échéant. Les petites étiquettes mobiles, les commandes au clavier et la lecture de la fiche ont été améliorées.

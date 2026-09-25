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

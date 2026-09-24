# Institutional Radar V8.9.4

## Surveillance continue (service déployé)

La rubrique « Surveillance continue » est prévue pour les mouvements Spot USDT d'un service hébergé indépendant. `hosted-config.js` indique désormais le service Railway testé le 24 septembre 2026 (`/health` : `fresh: true`, 9 connexions actives, 262 marchés observés). En cas d’indisponibilité, le scan dans le navigateur reste utilisable. Seuls les mouvements très récents avec un flux en état sont affichés. Ils ne deviennent jamais des scénarios automatiquement. Le service, ses limites et sa procédure d'installation figurent dans `server/README.md`.

Radar d'observation crypto sur les marchés publics OKX, publié par GitHub Pages. Aucun ordre n'est envoyé. Le score classe des configurations observées, sans représenter une probabilité de gain.

## Parcours du scan

1. Récupérer les tickers Spot USDT et les contrats FUTURES X-Perp actifs correspondant aux bases observées dans le compte (ALLO, FIL, SOL). Les swaps USDT publics ne sont pas traités comme disponibles sur ce compte.
2. Comparer les bougies 1 minute de chaque marché accessible au volume habituel du même marché. Une hausse simultanée du volume et du prix peut aussi être une chute du prix : elle reste une découverte, pas un trade.
3. Conserver **toutes** ces découvertes dans l'explorateur, y compris celles hors de la présélection des 150 Spot pour l'analyse approfondie. Les favoris restent analysés. L'ouverture d'une découverte non encore analysée lance son analyse technique à la demande.
4. Pour les marchés présélectionnés, analyser les unités de temps, l'OI et le funding uniquement pour les X-Perps reconnus. Rafraîchir les tickers à la fin du scan : une cotation absente, vieille de plus de deux minutes ou décalée de plus de 1 % par rapport au prix analysé bloque le classement d'un scénario.
5. Un scénario chiffré requiert des niveaux cohérents, un prix récent, un écart achat/vente disponible et inférieur ou égal à 1 %, ainsi qu'un volume 24 h d'au moins 100 000 $ **ou** 5 000 $ sur la minute observée. Pour les Spot, les vingt premiers niveaux du carnet doivent en outre montrer au moins 500 $ de chaque côté à moins de 1 % du prix. Ces seuils sont des filtres exploratoires, non une garantie de liquidité. Les autres mouvements restent visibles dans « Cryptos qui sortent du lot ».

Les scénarios indiquent un déclencheur futur et une invalidation. Ils ne sont ni des ordres exécutés, ni une preuve que la profondeur du carnet suffit pour obtenir un prix donné. Avant tout ordre, il faut vérifier dans OKX le contrat, la profondeur, les frais, le glissement et le financement.

## Structure

- `market-screen.js` : calculs purs de volume minute, présélection, découvertes et premiers contrôles d'exécution ; chargés avant `app.js`.
- `engine-core.js` : indicateurs, régime, moteur de scénarios et scores directionnels. La suite de tests charge le même code que la page.
- `app.js` : récupération de données, affichage et suivi. Son découpage restant et un service de collecte continu seront des chantiers distincts.
- `index.html`, `sw.js`, `manifest.json`, icônes : interface et installation mobile. Le numéro de cache et les URLs des scripts changent à chaque version.
- `engine.test.cjs` : tests de règles, scénarios, couverture, exclusion des swaps non vérifiés et conservation des découvertes au-delà de 150 analyses approfondies. Lancer `node engine.test.cjs` et `node --check app.js`.

Le journal conserve des scénarios `FORMING`, `ACTIVATED`, `CLOSED`, `CANCELLED` et `UNVERIFIED` dans le stockage local du navigateur. Ses résultats sont des observations de bougies, pas un relevé d'ordres. Le laboratoire historique sépare DEV, VALIDATION et HOLDOUT ; il affiche la moyenne en unités de risque parmi les scénarios TP1/SL, ainsi que deux hypothèses de coûts aller-retour (0,2 % et 0,5 %). Ce ne sont pas les frais réels ; les scénarios sans entrée et les timeouts restent distincts. Il n'intègre pas encore le funding historique ni l'OI historique. Un échantillon de moins de 30 décisions est signalé comme insuffisant. Une bonne performance historique ne suffit donc pas à prouver la rentabilité. Ne pas effacer les données du navigateur sans avoir exporté les scénarios conservés.

## Limites à résoudre ensuite

La profondeur du carnet Spot est un instantané limité à vingt niveaux et ne garantit pas le prix d'exécution. La profondeur des X-Perps n'est pas encore convertie en dollars faute de validation de la taille des contrats ; seul l'écart et l'activité sont contrôlés pour eux. Les marchés hors périmètre OKX Spot USDT et les autres X-Perps du compte ne sont pas encore couverts. Le scan large demande une requête de bougies minute par marché et peut durer longtemps ; il faut tester le parcours sur le téléphone réel et les données live OKX. Une future collecte persistante et des mesures d'exécution issues du carnet permettraient une meilleure surveillance continue.

# Profils de mouvement — méthode RC8

État au 8 octobre 2026. Cette comparaison décrit la ressemblance avec NEAR ; elle ne mesure ni probabilité de gain ni aptitude à un trade x10. Elle ne modifie pas les scores, seuils ou niveaux du moteur. Les paramètres de risque restent ceux du module séparé RC4.

## Données comparables

Quatre fenêtres arrêtées à la dernière heure UTC pleine : 15 min sur 24 h et 7 jours, 1 h sur 7 et 30 jours. Elles se recouvrent et ne constituent pas quatre validations indépendantes. Chaque fenêtre exige toutes ses bougies clôturées et une clôture précédente : respectivement 97, 673, 169 et 721 observations. Un doublon, un trou, une bougie hors grille, des valeurs OHLCV invalides ou une bougie non confirmée empêchent la comparaison de cette fenêtre. La couverture et N/D restent visibles.

Les contrats viennent du catalogue public FUTURES OKX, via le résolveur X-Perp existant. Aucun identifiant d’échéance n’est fabriqué. Contrat absent ou ambigu : aucun choix silencieux. La présence publique ne prouve pas la disponibilité sur le compte.

## Mesures

| Mesure | Définition et portée |
|---|---|
| Amplitude | Médiane de `100 × max(high-low, abs(high-close précédent), abs(low-close précédent)) / close précédent`. Comparaison indépendante de l’unité de prix. |
| Mèches | Moyenne de `(high-low-abs(close-open))/(high-low)` ; les bougies sans étendue sont exclues de cette moyenne. |
| Directionnalité | Valeur absolue du déplacement net des clôtures divisée par leur chemin absolu total. Zéro si le chemin est nul. Ce n’est pas une prédiction de direction. |
| Régime descriptif | Directionnalité ≥ 0,35 : direction haussière ou baissière selon le déplacement net ; sinon allers-retours. Chemin nul : immobile. Pas de classification HH/HL. |
| Swings | Extrêmes de clôture confirmés par un retournement d’au moins 1 %. Première jambe coupée par la fenêtre et dernière jambe non confirmée exclues. Le seuil est descriptif, sans relation avec le stop ou le levier. |
| Fréquence | Nombre de jambes complètes divisé par le nombre de jours. Zéro peut signifier absence de retournement confirmé, pas absence de mouvement. |
| Amplitude/durée des swings | Médianes des amplitudes relatives et durées entre extrêmes confirmés. |
| Régularité | `max(0, min(1, 1-MAD(amplitudes)/médiane(amplitudes)))`, à partir de quatre jambes. Mesure descriptive, pas critère de rentabilité. |
| Volume | Somme du volume en devise de cotation des bougies divisée par les jours de la fenêtre. |
| Spread | `100 × (ask-bid)/((ask+bid)/2)` ; cotation finale datée, positive, non croisée, non future et âgée d’au plus 120 s au calcul. Ce relevé ne s’actualise pas tout seul. |

## Indice de ressemblance

Chaque fenêtre compare candidat et NEAR avec quatre composantes à poids égal :

- Amplitude : plus petite amplitude médiane / plus grande.
- Fréquence : `1-abs(fréquence candidat-fréquence NEAR)/max(fréquence candidat, fréquence NEAR, 1)`.
- Mèches : `1-abs(part candidat-part NEAR)`.
- Directionnalité : `1-abs(efficacité candidat-efficacité NEAR)`.

L’indice par fenêtre vaut 25 fois la somme de ces composantes. L’indice global est leur moyenne sur les quatre fenêtres, uniquement si toutes sont comparables. « Proximité sur les 4 fenêtres » exige au moins 80/100 globalement et au moins 70/100 dans chaque fenêtre. Ces poids et seuils sont une première heuristique explicite, sans calibration historique de performance. Le sens haussier/baissier n’entre pas dans l’indice. La durée, l’amplitude et la régularité des swings restent inspectables mais ne sont pas pondérées dans celui-ci. NEAR est la référence, sans note artificielle de 100 dans le classement.

Un rapprochement est « retrouvé à deux dates » après deux observations positives séparées d’au moins 24 h, sans échec observé entre elles ni intervalle supérieur à sept jours entre lectures. Un changement du contrat candidat ou de la référence NEAR recommence cette séquence. Répéter la même heure ne suffit pas. Ce constat dépend des lectures manuelles, pas d’une surveillance continue.

## Exploration et coût de collecte

Le bouton d’exploration lit au plus cinq nouveaux contrats par lot, en plus de NEAR. Le préfiltre trie les contrats non suivis, non déjà vus dans la session, uniques par symbole et avec cotation récente, par volume 24 h indicatif décroissant (volume de base × dernier prix). Ce tri ne constitue pas une recherche exhaustive de ressemblance. Relancer explore le lot suivant ; réinitialiser l’exploration remet seulement la liste des candidats vus à zéro.

Deux séries historiques par actif : 15 min sur 7 jours et 1 h sur 30 jours. Pagination séquentielle de 300 observations, au plus huit pages par série. Le cache en mémoire conserve uniquement les séries complètes, indexées par contrat exact, période et heure de fin, avec au plus 64 entrées. Les cotations sont relues à la fin ; une panne masque les spreads sans effacer les mesures historiques.

Budget maximal par parcours : trois lectures catalogue/cotations plus seize pages par actif. Soit 83 lectures logiques pour cinq actifs suivis, 99 pour une exploration de cinq candidats avec NEAR, 243 pour une sélection de quinze actifs. La file API existante peut faire jusqu’à trois tentatives réseau par lecture. Un arrêt attend la réponse courante puis empêche les suivantes. Quitter la page demande aussi cet arrêt. Aucun minuteur ne lance l’exploration et aucun scan profond concurrent n’est autorisé.

« Ajouter au Radar » est une action explicite, disponible si les quatre fenêtres sont comparables et si la limite de quinze actifs le permet. Un score élevé n’est pas obligatoire : l’utilisateur garde le choix. Le scan existant revalide ensuite les données et les scénarios. Le registre compact `ir_movement_checks_v1` conserve au plus 100 contrats, séparément du journal métier ; il n’est pas inclus dans `IR_BACKUP_V1`.

Source primaire vérifiée : [API publique OKX — historique des bougies](https://www.okx.com/docs-v5/en/#order-book-trading-market-data-get-candlesticks-history). Format OHLCV avec volume en cotation à l’index 7 et `confirm=1` pour une bougie clôturée ; pagination `after`, maximum 300 observations par page. Les données sont décodées par le module existant `RadarCandles`.

## Relevé de validation ponctuel

Lecture publique du 8 octobre 2026 à 05:45 Paris ; fenêtres arrêtées à 05:00 Paris. L’amplitude ci-dessous est celle des bougies 15 min sur 24 h ; la ressemblance porte sur les quatre fenêtres. Ces valeurs datées ne sont pas un conseil de sélection.

| Actif | Ressemblance | Amplitude médiane | Swings complets ≥ 1 % / jour |
|---|---:|---:|---:|
| NEAR | Référence | 1,19 % | 16 |
| SUI | 76/100 | 0,47 % | 2 |
| AVAX | 74/100 | 0,64 % | 7 |
| HYPE | 67/100 | 0,39 % | 2 |
| SOL | 62/100 | 0,28 % | 0 |

Les quatre candidats initiaux restent « différents ou variables » selon cette règle. Le premier lot d’exploration a lu BTC, ETH, XRP, ZEC et PUMP ; PUMP (93) et ZEC (82) ont franchi les seuils à cette seule date. Leur persistance n’est pas confirmée ; ils n’ont pas été ajoutés. Les deux parcours ont nécessité 33 lectures chacun, avec deux séries NEAR réutilisées pendant l’exploration. Les chiffres ne préjugent ni de l’exécution ni de gains futurs.

## Validation et limites

136 tests Node réussis ; parcours mobile et ordinateur avec données simulées, cas incomplet, interruption et ajout après clic ; contrôle avec données OKX publiques sans erreur JavaScript ni débordement de page. La conservation des cinq modules métier, des fonctions protégées, modèles, niveaux, favoris et journal est vérifiée. Les fichiers du graphique RC7 sont inchangés.

La comparaison ne mesure pas la profondeur du carnet, les frais du compte, le glissement ou le financement. Les volumes ne prouvent pas une liquidité exécutable pour un ordre donné. Le score reste exploratoire, les fenêtres se recouvrent, le filtre initial privilégie les gros volumes et les régimes sont décrits sommairement. La persistance réelle sur 24 h, la recette native sur le téléphone et toute promotion en production restent à confirmer séparément.

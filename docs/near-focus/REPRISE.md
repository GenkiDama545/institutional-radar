# Reprise du Radar — périmètre NEAR

Date : 8 octobre 2026. Baseline GitHub : V8.9.17, commit `645bf78f4f622c3923eee809b29f3bbd169e53f8`.
Candidate : V8.9.18-rc.7, branche `feature/near-focused-radar`.

## Décision de produit

L’utilisateur souhaite reprendre les chantiers ouverts avec un univers considérablement réduit : NEAR comme référence, puis quelques X-Perps dont l’amplitude, la régularité des swings et la lisibilité conviennent à son usage. Le levier du simulateur reste distinct de la sélection et du score. Aucun ordre d’exchange n’est envoyé.

La version de production confirmée est V8.9.17. L’étape Graphiques L0–L7 et l’audit précédent sont déjà intégrés. Les décisions historiques concernant des essais Scan/Confluence et la pause du Learning ont été retrouvées, mais aucun code postérieur à V8.9.17 n’a pu être récupéré dans les branches GitHub ou fichiers recherchés. Les anciens chiffres de tests/pilotes ne valident donc pas cette candidate.

## Lot 1 réalisé — sélection et scan ciblé

Le mode ciblé est le défaut. La sélection initiale est NEAR, SUI, HYPE, AVAX, SOL ; seuls NEAR et les critères de comparaison constituent des références. Les quatre autres restent des candidats provisoires, sans similarité mesurée ni classement de gain attendu. L’utilisateur peut modifier la liste, jusqu’à 15 symboles uniques, avec NEAR toujours inclus.

Le catalogue FUTURES et ses tickers servent à résoudre les contrats exacts. Aucun identifiant d’expiration n’est construit à partir du symbole. Un actif absent, sans cotation exploitable ou associé à plusieurs contrats reste visible et n’est pas analysé comme un contrat sélectionné. La résolution d’un choix entre plusieurs contrats reste un futur raffinement ; aucun choix silencieux d’échéance n’est fait. La présence publique ne prouve pas la disponibilité sur le compte.

Le filtrage intervient avant les appels OI/funding et les six séries de bougies. Le mode ciblé ne dépend pas de l’endpoint Spot. Les références transversales de volume et le rang de taille utilisent toujours tout le catalogue X-Perp exploitable, ce qui évite de changer les scores par simple réduction du groupe de comparaison.

Le même moteur calcule les scénarios des deux modes. Les cartes de sélection sont indépendantes du classement : elles affichent LONG et SHORT, analyse en cours/incomplète, attente, analyse périmée, exécution à vérifier ou scénario chiffré. Un scénario chiffré reste conditionnel, ce n’est pas une entrée activée. En cas de péremption, d’erreur de cotation ou de disparition du contrat, l’admission échoue et l’actif reste visible avec sa raison.

Le recalcul ciblé reprend toute la sélection, y compris les actifs sans scénario existant, via le cache de bougies déjà présent. Le minuteur vérifie toutes les 15 secondes si au moins 60 secondes se sont écoulées depuis le début du précédent scan. Aucun chevauchement : un scan lent décale donc la cadence effective. Il est suspendu lorsque l’onglet est caché ou lorsqu’une fiche, un graphique ou un outil est ouvert. La page doit rester ouverte ; il ne s’agit pas d’un service serveur permanent. Le scan large est mis en pause : aucune commande ne permet de l’activer dans l’interface. Une ancienne préférence de mode large est ignorée au chargement. Le chemin historique reste dans le code pour les tests de comparaison, mais aucun parcours utilisateur ne le déclenche.

Ce lot traite la visibilité et le renouvellement des analyses dans le mode ciblé. Il ne prétend pas corriger toutes les causes historiques de disparition du Top dans le mode large.

## Invariants et stockage

Les cinq modules métier `engine-core.js`, `signal-engine.js`, `market-screen.js`, `candle-store.js` et `trade-sim.js` sont identiques à la baseline. Les six horizons, seuils d’admission, fraîcheur D05, décisions sur clôtures, formules et pondérations restent protégés.

Jusqu’en RC3, `scan` était la seule exception aux 44 empreintes de fonctions gelées. La RC4 ajoute les trois exceptions de présentation du simulateur décrites ci-dessous : les 40 autres fonctions et les cinq modules métier restent vérifiés ; les anciennes fixtures ne sont pas régénérées. La couverture du scan large (170 Spot) reste testée, et un nouveau test compare intégralement les modèles, scores, niveaux, références et tiers des actifs communs aux deux modes à données identiques.

Les clés et données existantes de favoris, journal, verrous, scans et imports restent compatibles. La sélection utilise une préférence séparée `ir_focus_universe_v1` ; elle n’est pas exportée par la sauvegarde métier `IR_BACKUP_V1`. Les scans n’écrivent pas de nouveaux scénarios dans le journal. Les scénarios déjà verrouillés restent liés à leur contrat et à leurs niveaux.

## Validation

- Baseline avant modification : syntaxe, moteur, hosted-feed et 110 tests Node réussis.
- Candidate : mêmes suites et 12 tests additionnels sur sélection, contrats exacts, périmètre des requêtes, équivalence avec le scan large, péremption/recalcul, données partielles, pannes et reprise, retrait de contrat, cotation finale, minuteur et stockage.
- Parcours Chromium avec endpoints OKX simulés : démarrage, sélection persistante, contrat manquant, fiche NEAR avec graphique commun, état périmé, panne/reprise et rejet d’une ancienne préférence de scan large. Aucune erreur JavaScript ; aucun débordement horizontal à 390 et 1440 pixels.
- Preuves : [résultats navigateur](evidence/browser-results.json), [capture mobile RC1](evidence/focus-mobile.png), [capture ordinateur RC1](evidence/focus-desktop.png). Ces captures historiques précèdent le retrait du sélecteur de scan large en RC2 ; le parcours navigateur a été revérifié après ce retrait. Les prix et marchés des captures sont des fixtures, pas des données live.
- La disponibilité des contrats, les performances réseau OKX et la recette sur le téléphone réel ne sont pas validées par ces simulations. Aucun temps de scan réel n’est promis.

Commandes : `npm test` ; test navigateur optionnel `node tests/browser-focus.cjs <chromium-executable> <artifacts-directory>` (Playwright requis pour ce contrôle optionnel).

## Suite de la reprise

| Lot | Travail | Critère de sortie |
|---|---|---|
| 1 — Scan ciblé | Présente candidate | CI du commit, revue et recette avec données OKX puis autorisation de promotion |
| 2 — Profil de mouvement | Mesurer amplitude en %, fréquence et régularité des swings, mèches/bruit, liquidité/coûts sur plusieurs fenêtres et régimes | Données comparables, méthode explicite, données manquantes visibles ; NEAR comme référence sans bonus automatique |
| 3 — Signal Audit / Confluence | Auditer les familles existantes, redondance tendance/Price Action, RSI/StochRSI, contexte OI/funding et stabilité selon le régime | Comparaison baseline/candidate, coût mesuré, validation hors échantillon avant toute nouvelle pondération |
| 4 — Suivi des scénarios | États figés, IDs uniques, suivi jusqu’à résolution, TP partiels, expiration, MFE/MAE et interruptions | Cas ambigus explicitement non vérifiés, aucune assimilation à des ordres réels |
| 5 — Learning | Reste en pause ; à reprendre seulement après audit et collecte validés | Données traçables et protocole Production/Challenger avec promotion contrôlée |

Les cryptos hors sélection sont en pause ; aucune analyse de bougies, OI ou funding ne leur est demandée. Les réponses groupées du catalogue et des cotations sont conservées uniquement pour résoudre les contrats exacts et maintenir les références transversales du moteur. La découverte automatique des « semblables de NEAR » n’est pas encore implémentée : elle dépend du lot 2. Le suivi actuel conserve TP1 comme état terminal et n’est pas une veille serveur de tous les favoris.

## Exigence du lot 2 — sélection évolutive

Décision utilisateur du 8 octobre 2026 : pouvoir élargir la sélection si d’autres cryptos commencent à présenter les qualités recherchées chez NEAR. Les actifs hors sélection sont en pause, pas exclus définitivement. NEAR reste la référence initiale ; la liste des candidats ne doit pas être figée.

La première candidate permet déjà l’ajout/retrait manuel de symboles dans la limite de 15 actifs. La découverte des nouveaux candidats reste à construire dans le lot 2, après définition et validation du profil de mouvement.

- Distinguer le scan fréquent des actifs suivis d’une recherche de candidats moins fréquente, déclenchable à la demande puis éventuellement périodique selon un budget de requêtes explicite. Une future exploration peut lire des données hors sélection sans réactiver leur analyse approfondie à chaque scan courant.
- Comparer amplitude en pourcentage, régularité et fréquence des swings, structure, bruit/mèches et conditions d’exécution sur plusieurs fenêtres et régimes. Une seule hausse journalière ou une corrélation de prix avec NEAR ne suffit pas à établir la ressemblance recherchée.
- Présenter les nouveaux candidats avec les mesures, leur date, la couverture disponible et les raisons de leur rapprochement avec le profil recherché. Permettre leur ajout à la sélection et leur retrait ultérieur ; ne pas remplacer silencieusement la sélection de l’utilisateur.
- Vérifier le contrat X-Perp exact et les données disponibles avant admission. Une similarité de mouvement ne constitue pas une validation de scénario LONG/SHORT ; les contrôles d’admission existants continuent de s’appliquer après ajout.
- Éviter les entrées/sorties incessantes de la liste à cause d’un pic isolé : exiger une persistance à définir et tester. Les favoris et scénarios verrouillés conservent leur historique lorsqu’un actif quitte la sélection active.
- La limite actuelle de 15 actifs est un garde-fou initial de performance, pas une limite définitive du produit. Son élargissement devra être configurable et évalué selon le temps de scan, la fraîcheur et le coût des requêtes.

Critère de sortie : un actif initialement hors sélection peut être détecté, expliqué, ajouté puis analysé par le même moteur, sans imposer un scan profond de tout le marché à chaque cycle et sans présenter de données manquantes comme une ressemblance confirmée. Cette section décrit une fonctionnalité prévue ; aucun service de surveillance externe ni aucune automatisation planifiée n’est activé par cette modification documentaire.

## Promotion et retour

La candidate reste sur sa branche et sa PR de revue. La production GitHub Pages depuis `main` reste V8.9.17. Aucune fusion ni publication de production n’est faite sans autorisation. En cas de rejet de la candidate, la production et son stockage sont inchangés. Une éventuelle promotion doit aligner la version finale, les assets et le cache, puis vérifier CI et Pages sur le commit publié.


## Retour mobile et retouche graphique RC3 — 8 octobre 2026

L’utilisateur a testé la prévisualisation RC2 sans ralentissement, puis signalé des bougies trop grossières et une vue trop serrée. Sa capture du Radar montrait 34 bougies sur 388 chargées ; sa vue OKX NEAR 5m sert de référence visuelle (traits fins, contexte plus large, espace à droite), sans adopter ses réglages d’indicateurs.

La RC3 élargit la fenêtre initiale selon la largeur disponible : pas horizontal de 3 px sur mobile et 5 px sur grand écran, avec 14 % d’espace à droite du dernier cours. Les bougies, mèches, courbes et grille sont affinées ; les teintes du graphique sont adoucies. Le graphique récupère de la largeur dans ses cartes mobiles. « Vue large » restaure la fenêtre initiale et « Vue détaillée » agrandit la période consultée. Le prix se recadre toujours sur les bougies visibles ; les niveaux restent distincts.

Les valeurs de consultation sont présentées avec au plus 7 chiffres significatifs, le volume avec au plus 2 décimales, et la valeur complète reste disponible dans l’attribut de détail. Les données et calculs conservent toute leur précision. Les graduations temporelles sont alignées sur l’intervalle de bougie et la période réellement visible est indiquée séparément de l’historique chargé.

La sélection initiale de cinq actifs ne constitue pas un résultat de recherche de ressemblance : les quatre candidats restent provisoires. L’ajout manuel est disponible jusqu’à 15 actifs ; le lot 2 doit encore établir une sélection mesurée et évolutive.

Validation RC3 : 122 tests Node réussis, suites moteur/hosted-feed réussies, contrôle de la conservation des 43 fonctions métier protégées et des cinq modules moteur. Le parcours Chromium simulé vérifie également Vue large → Vue détaillée → Vue large, sans débordement mobile. Les preuves RC3 sont séparées des preuves RC1/RC2.

La prévisualisation RC2 avait été publiée avec l’autorisation de l’utilisateur ; son scan public OKX, ses cinq contrats et l’ouverture de la fiche/du graphique NEAR ont fonctionné lors d’un contrôle ponctuel. Ce contrôle ne garantit ni disponibilité future ni performances sur tous les appareils. La production reste V8.9.17 ; seules des prévisualisations de la candidate sont autorisées.

Contrôle ponctuel RC3 avec l’API publique OKX : NEAR en 5m, 76 bougies dans la vue large mobile et 28 dans la vue détaillée ; 142 bougies dans le conteneur de 910 px sur grand écran. Aucun débordement ni erreur JavaScript dans ce parcours. Preuves : `evidence/chart-rc3-live.json` (données live) et `evidence/browser-rc3-results.json` (fixtures). La présentation reste à apprécier sur le téléphone de l’utilisateur.

## RC4 — éclat, timeframes et risque x10

Demande utilisateur : conserver la finesse et la quantité de bougies de RC3, raviver leurs couleurs, placer les timeframes au contact du graphique et intégrer le risque de SL **trop éloignés** pour son usage courant x10 / 100 USD.

- Palette plus lumineuse pour bougies, EMA et volumes. Aucun changement de géométrie. Barre 1m, 5m, 15m, 30m, 1H, 4H, 1D immédiatement avant le tracé, sur fiche, graphique approfondi et projection. La fiche conserve la période choisie lors du rafraîchissement ; les réponses dépassées sont ignorées. 1m reste uniquement consultatif.
- `position-risk.js` calcule la perte de prix au stop : exposition × distance entrée/stop ÷ entrée. Marge × levier donne l’exposition ; un montant déjà notionnel n’est pas multiplié de nouveau. Long et short suivent la même distance absolue avec validation du sens du stop.
- Le sens des 100 USD n’a pas été confirmé. Le profil impose donc le choix marge/position ; il ne présume aucun budget de perte. Les cartes montrent les deux interprétations tant que ce choix manque. La marge du nouveau simulateur reste vide jusqu’au choix.
- Une fois la base et le budget choisis : distance en %, perte USD, perte en % de marge, et distance descriptive en ATR si disponible. Dépassement = « SL trop coûteux pour ce budget ». La taille théorique compatible est affichée avant coûts ; aucune modification du stop, de l’admission, du classement, des verrous ou du journal.
- Frais/glissement/financement exclus des cartes ; le simulateur inclut les coûts saisis. La liquidation n’est pas calculée et une perte théorique atteignant la marge est signalée. Aucune garantie d’exécution du SL. Le profil local est séparé (`ir_position_risk_v1`) ; il n’est pas inclus dans l’ancien export de l’état métier.
- `scenarioSimRead`, `scenarioSimPanel` et `calcScenarioSim` sont les trois nouvelles exceptions explicites aux empreintes historiques : défauts du profil et affichage du risque. `trade-sim.js` et les quatre autres modules métier restent identiques. Les saisies de simulation existantes ne sont pas remplacées ; application du profil par bouton dédié.

Références de calcul vérifiées le 8 octobre 2026 : [OKX — levier X-Perps](https://www.okx.com/en-eu/help/okx-x-perps-eea-leverage-explained), [marge](https://www.okx.com/fr-fr/help/what-is-margin-in-xperps-trading) et [PnL](https://www.okx.com/fr-fr/help/okx-x-perps-eea-pnl-basics). La documentation distingue Amount (position totale), marge et levier.

Validation RC4 : 126 tests Node, suites moteur/hosted-feed et 40 empreintes de fonctions / cinq modules métier réussis. Quatre tests supplémentaires couvrent marge/notionnel, x10 compté une fois, long/short, budget et taille, valeurs invalides, conservation des niveaux et anciens états, conservation du simulateur et conversion EUR/coûts. Le parcours Chromium à 390 px contrôle les boutons au-dessus du tracé, les changements rapides, le rafraîchissement de la période choisie, le profil et les pertes de 40 / 4 USD pour les deux interprétations d’un montant de 100 USD avec SL à 4 %. Pas de débordement mobile.

Contrôle ponctuel de NEAR 5m avec API OKX publique : 76 bougies mobile en vue large, 28 en vue détaillée, 142 sur grand écran (conteneur 910 px). Pas d’erreur JavaScript ni débordement dans ce parcours. Les preuves RC4 sont séparées des précédentes. Le rendu reste à apprécier sur le téléphone réel.

## RC5 — bougies plus lumineuses et séparées

Retour utilisateur sur RC4 : ensemble validé, demande d’un éclat encore plus net et d’une meilleure distinction entre bougies. Corps vert citron / rose rouge plus lumineux, mèches opaques de 1 px, contours SVG nets pour éviter le mélange des pixels aux bords. Les bougies sont dessinées devant les courbes pour rester lisibles à leur croisement. La densité, la largeur théorique, les espacements, les prix et les réglages de risque restent ceux de RC4.

Validation RC5 : les 126 tests existants et les suites moteur/hosted-feed réussissent. Contrôle Chromium avec données publiques OKX : 76 bougies en vue large mobile, 28 en vue détaillée, 142 dans un conteneur desktop de 910 px ; aucun débordement ni erreur JavaScript. Preuve : `evidence/chart-rc5-live.json`. La validation visuelle sur le téléphone réel reste à l’utilisateur.

## RC6 — rouge vif et contour fin

Retour utilisateur : vert citron validé, préférence pour le rouge vif de RC4 et pour un contour plus fin délimitant les bougies. RC6 conserve le vert citron, rétablit `#ff657d` pour la baisse et ajoute un filet lumineux de 0,5 px maximum, adapté aux corps très fins et aux dojis. Le contour est placé à l’intérieur de l’enveloppe du corps ; la largeur extérieure, les limites OHLC, l’espacement et la densité restent identiques. Les mèches restent nettes. Aucun changement de calcul ni de réglage de risque.

Validation RC6 : 126 tests existants et suites moteur/hosted-feed réussis. Contrôle Chromium avec API OKX en vue large et détaillée : 76 / 28 bougies sur mobile, 142 sur grand écran (910 px), sans erreur JavaScript ni débordement. Preuve : `evidence/chart-rc6-live.json`. Le résultat visuel final reste à apprécier sur le téléphone réel.

## RC7 — saturation renforcée

L’utilisateur valide l’ensemble de RC6 mais trouve les couleurs trop peu vives. Aucun filtre ni opacité globale ne les atténue dans les styles ; les contours très clairs ajoutés en RC6 apportaient une composante pastel, surtout sur les corps étroits. RC7 utilise un vert citron `#b6ff00` et un rouge franc `#ff1744`, avec des contours eux aussi saturés (`#d2ff00` / `#ff3755`). La saturation HSV des corps passe de 73 % à 100 % pour le vert, et de 60 % à 91 % pour le rouge. La géométrie, les filets fins et le rendu validés en RC6 sont conservés. Aucun changement fonctionnel.

Validation RC7 : 126 tests existants et suites moteur/hosted-feed réussis. Contrôle Chromium avec API publique OKX, vues large et détaillée : 76 / 28 bougies mobile et 142 sur grand écran, sans erreur JavaScript ni débordement. Preuve : `evidence/chart-rc7-live.json`. Le rendu reste à apprécier sur le téléphone réel.

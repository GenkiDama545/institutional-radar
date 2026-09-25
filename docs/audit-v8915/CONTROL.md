# Traitement contrôlé de l’audit V8.9.15

Baseline : `0eee851e22e2be3651fd6e8b9291b55fe3eda077`, arbre `36f5a92d8c560bab604686ff31e296bfb6ab3ab4`.
Le rapport d’audit d’origine est conservé sans réécriture. Cette branche traite uniquement l’étape 1. Aucun déploiement ni merge en production automatique.

## Classification préalable

A = correction certaine, test avant/après, sans invention de règle stratégique.
B = choix métier/architecture, aucune application avant décision utilisateur.
Pour les constats mixtes, seule la portion A est autorisée. Le reste demeure explicitement en attente, jamais déclaré clôturé par simple documentation.

| IDs | Catégorie | Périmètre de ce lot / décision réservée |
|---|---|---|
| F01, F02 | A + B | Normalisation, horloge de clôture et absence de fuite temporelle certaines ; protocole statistique, couverture et règles d’entrée restent à décider |
| F03 | A | Même filtre de résultats vérifiés dans toutes les statistiques |
| F04 | B | Reconstitution FORMING : invalidation historique vs activation qui aurait eu lieu pendant l’absence |
| F05 | A | Appliquer aux trous internes la règle UNVERIFIED déjà appliquée au trou initial |
| F06 | A | Corriger l’écrasement d’une réponse REST par une ancienne valeur, protéger les événements WS concurrents |
| F07–F11 | B | ADX, bougies ouvertes, règles par kind, biais et invalidation : changements de stratégie à approuver |
| F12 | A | Prix positifs finis et ordre arithmétique des TP ; aucun seuil de score modifié |
| F13–F17 | B | Fraîcheur technique, score directionnel, éligibilité uniforme, profondeur, sélection du sens/kind |
| F18 | A | Unité volume de cotation, suppression du second produit par le prix |
| F19 | A + B | Retirer le faux tri ; ne pas inventer de ratio OI ni modifier sa pondération |
| F20 | A | Dire explicitement que les bornes de jauge sont indicatives et non historiques |
| F21 | B | Politique de warmup commune à décider ; pas de refonte graphique |
| F22 | A | Invalider les callbacks et arrêter les timers lors de la navigation |
| F23 | B | TP1 terminal, suivi page ouverte et absence d’expiration ; nouveau suivi réservé étape 4 |
| F24 | A + B | Validation/erreurs de stockage certaines ; schéma canonique, rétention et export complet à approuver |
| F25 | A + B | Afficher la vraie fraîcheur des données ; gate d’activation sur fraîcheur réservé |
| F26 | A | Vérifier le listing live exact avant reprise d’un contrat favori |
| F27–F30 | A | Vérité des libellés/actions et effacement mémoire/disque |
| F31 | A + B | Accès aux niveaux rejection corrigé ; protocole de confirmation historique réservé |
| F32 | A | Recalculer spread/strongest dérivés, sans changer scores ni éligibilité |

## Lots et rollback

1. Tests/registre sans changement de production.
2. P1 A : adaptateur historique, temporalité, statistiques, trous, actualisation, validité mathématique.
3. P2 A : données affichées, navigation, stockage, favoris et champs dérivés.
4. P3 A : formulations, faux réglages, comparaison et documentation.
5. Dette orpheline prouvée ; audit final et rapport des décisions B.

Chaque lot reçoit un commit distinct. Pour annuler un lot : `git revert <commit-du-lot>` ; pour abandonner toute la proposition, ne pas merger la branche. Les clés de stockage de production ne sont pas renommées. La V8.9.15 reste disponible au commit ci-dessus. Un éventuel retour de code après déploiement devra préserver/exporter le stockage utilisateur ; aucun effacement automatique ne fait partie du rollback.

Tests : `node engine.test.cjs`, `node hosted-feed.test.cjs`, `node --test experience.test.cjs server/*.test.mjs tests/*.test.cjs`.
Les instantanés de moteur caractérisent les scores/niveaux de six fixtures de la baseline. Les tests B sont des descriptions de l’existant, pas une validation de sa qualité métier.

### Lot P1 A — preuve avant/après

Les six tests initiaux de `tests/audit-p1.test.cjs` échouent sur la baseline (filtre statistique, trou interne, prix négatif, clôture future, chemin historique complet, REST écrasé). Après correction : sept tests passent, dont un passage des données API normalisées dans le vrai moteur adaptatif. Les six snapshots de scores/niveaux restent identiques. L'ancien test `btSlice` supposait qu'une ouverture était une clôture : son attendu est corrigé, avec intervalle explicite. Les observations TP1/SL et les poids restent ceux de la baseline. L’accès rejet F31 est réparé avec l’adaptateur F01 pour couvrir le chemin complet ; sa sémantique d’entrée reste B.

Les paramètres du laboratoire (70/20/10, horizon 18) sont conservés. Les évaluations franchissant une frontière sont exclues au lieu d’accéder au futur de la partition. Ce correctif causal ne valide pas la pertinence statistique du laboratoire, sa profondeur historique ni son équivalence au live : décisions B toujours ouvertes.

### Lot P2 A — preuve avant/après

Neuf tests d’intégration ciblés échouent avant correction, puis passent : unité du volume, quatre courses de navigation/timers, historique effacé en mémoire, champs dérivés SHORT, listing d’un favori et niveaux d’un ancien favori. Un test supplémentaire couvre la fraîcheur du ticker affichée en projection. Quatre tests de stockage passent d’échec à succès : formes JSON invalides, import mal formé, quota avec rollback du favori, accès navigateur bloqué.

Le stockage conserve ses clés et son format. Les imports legacy valides restent lisibles ; leur exclusion des statistiques reste celle de `verifiedObservation`. La transaction entre plusieurs clés, la confiance accordée aux imports, leur politique de conflit et la limite 1 500 sont des décisions B non modifiées. Un échec d’écriture est désormais signalé ; aucun message de réussite d’import n’est affiché après quota.

### Lot P3 / UI A — preuve avant/après

Cinq tests passent d’échec à succès : bornes indicatives des jauges, absence de réglages sans effet, comparateur sans doublons et avec contrat, libellé BAISSIER des familles directionnelles, limites du suivi/Learning visibles. Aucun poids ni signal n’est supprimé pour corriger les libellés. Le tri `oiRatio` est retiré ; sa famille neutre reste en place en attente du Signal Audit. Les accès Contexte restent deux raccourcis intentionnels vers le même contenu, pas deux moteurs.

### Lot dette — références et protection

Recherche intégrale des identifiants dans JS, HTML (handlers inline compris), tests et serveur, puis suppression des définitions exactes : `shortDiagnostics`, `obv`, `lineChart`, `backtestFmt`, `trValue`, `nearestLevels`, `pctMove`, `clampPrice`, `clamp01`. Aucun dispatch `eval`, `new Function` ou accès global dynamique n’est trouvé. `csForHover` n’a que des écritures ; la sélection utilise les données du SVG. La branche `simScenario` n’a aucune entrée UI. Le calcul local `ap` et `trs` de ADX n’a pas de consommateur et est retiré ; la formule retournée est inchangée, snapshots et tests inchangés.

Le nettoyage ne supprime pas les fichiers `hosted-*` : ils ont des tests et un rôle historique autonome. Documentation du serveur corrigée : une URL ne reconnecte pas un script que l’index ne charge pas. Métadonnées de régime, Wilson, statistiques auxiliaires, unités et diagnostics conservés avec justification. Pas de suppression CSS sans inventaire complet ; pas de fusion des moteurs.

Le gate complet a détecté pendant le travail un élargissement involontaire du libellé « bornes indicatives » aux graphiques : corrigé dans un commit dédié avant publication, avec test de rendu. Aucun défaut connu introduit par les correctifs ne reste ouvert à ce stade des tests contrôlés.

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

## Arbitrages validés — 25 septembre 2026

Autorisation utilisateur : D01 option 1 ; D02 option 1 ; D03 option 1 sans automates spécifiques ; D04 option 1 et UNVERIFIED si reconstruction non fiable ; D05 option 2 (2 intervalles déclencheur, ticker <=120 s, paramètres centralisés, suspension sans déplacement du verrou) ; D06 option 2 (instrument/sens/kind exact, six horizons, warmup graphique différé) ; D07 option 1 pour le suivi avec sauvegarde/restauration versionnée, reprise transactionnelle et protection des ouvertes ; D08 option 2 provenance/conflits ; D09/D10 option 1 conservation explicitement limitée.

Ces changements B sont désormais autorisés, sans changement des coefficients ni des poids. Chaque lot dispose de tests avant/après et d'un commit. Aucune fusion, aucun déploiement ni étape 2 autorisés. La précédente tentative de push a été refusée par le contrôle automatique ; aucune nouvelle tentative n'est prévue sans autorisation explicite de transfert.

### Lot D03–D04

Avant : 5 des 6 nouveaux tests échouent (biais rejet, live stop, reprise FORMING, bougie ambiguë). Après : 6/6. Confirmation commune et seuil 1,15 inchangés, noms sans promesse d'automate retest. Biais SHORT aligné sur le motif admis. Journal canonique sur high/low clôturé ; live provisoire. Reprise FORMING vérifie chaque barre et classe UNVERIFIED si une activation antérieure ou l'ordre entrée/SL n'est pas reconstructible. Les cas synthétiques historiques qui affirmaient CANCELLED sur une même barre entrée/SL deviennent explicitement UNVERIFIED. TP1 terminal et priorité SL sur une barre post-activation touchant les deux restent inchangés.

### Lot D05

Trois nouveaux tests échouent avant, puis passent : frontières TTL/ticker, six horizons/dates futures, invariance du verrou en suspension. Paramètres centralisés dans RadarMarket.policy. Freshness affichée et vérifiée ; activation suspendue sans réécriture des niveaux. Le test de candidat synthétique préexistant reçoit maintenant les timestamps/six horizons qu'il prétendait avoir. Le suivi d'une observation déjà activée reste possible par bougies clôturées. L'unification de tous les gates d'entrée/cartes est le lot D06 suivant.

### Lot D06

Avant : 4 nouveaux tests échouent (gate partagé absent, substitution de kind, profondeurs divergentes, clic sans mémorisation du sens). Après : les 5 tests, dont un vrai parcours classement → cartes → projection avec moteur réel et API simulée, passent. Tous les niveaux verrouillés correspondent au candidat, instrument/kind/sens préservés. CandidateModel impose les profondeurs du scan (120/100/140/140/180/180) ; aucun nouveau coefficient. La fiche affiche les six horizons tout en conservant séparément le warmup graphique ancien. Le second calcul directionnel qui effaçait le bonus SHORT a été retiré. Les tests synthétiques ont reçu les propriétés requises par le contrat réel (shortPattern, directional, instrumentId), sans abaisser les gates. Le test effectif de parcours utilise les vraies fonctions.

### Lot D07 — persistance, rétention, export

Quatre tests de départ échouent avant et passent après. Six tests couvrent maintenant : 1 601 observations ouvertes jamais purgées, plafond des 1 500 terminales, interruption entre écritures, reprise avant lecture, quota persistant pendant rollback, export complet versionné, absence de faux résultat résolu lorsque la sauvegarde échoue. Verrou + journal et reset sont transactionnels avec journal d'annulation local. Les anciennes clés de production sont conservées. Aucune collecte automatique ni nouveau type de résolution. La restauration/import avec provenance et conflits est finalisée dans D08, pour ne jamais réintroduire un import comme observation vérifiée.

### Lot D08 — restauration et provenance

Cinq tests échouaient avant ; cinq passent après, plus les six tests D07. Import complet reconnecté sans déplacement de niveaux ; conflits signalés/archivés ; contenu identique idempotent ; provenance JSON locale ignorée ; anciens résultats sans provenance conservés mais non vérifiés (impossibilité de prouver rétroactivement leur origine). Les tests de statistiques qui simulent des observations générées localement le déclarent explicitement ; les imports usurpant ce marqueur restent exclus. La restauration est une transaction sur les cinq sous-systèmes. Les imports disposent d'une synthèse séparée. Aucune donnée ne modifie de pondération.

### Lot D09–D10 — conservations validées

D09 option 1 : diagnostic exploratoire, couverture incomplète quantifiée, zéro résultat ne prouve pas absence de configuration. Aucun replay fidèle complet ni dérivés historiques inventés ; aucun poids appris/promu. Deux nouveaux tests échouent avant puis passent après, dont exécution complète avec horizons manquants et poids/journal inchangés.

D10 option 1 : conservation explicitement validée des modèles 1H/MTF, familles corrélées, positioning neutre, métadonnées de régime, diagnostics synthétiques, statistiques de dispersion, contexte pédagogique, CSS et emplacements graphiques, warmup variable des graphiques, connecteur minute débranché et ancien service Railway. Les fusions restent rattachées aux étapes 2/3/4 pertinentes. Aucun point de dette correspondant n'est traité comme supprimé ou comme moteur déjà unifié.

## Recontrôle D05/D06 — verrou existant

Le test d'orchestration `existing Spot lock cannot activate with missing depth or excessive spread` échouait avant correction (activation `true`). Le moniteur ne revérifiait que la fraîcheur du ticker après la création du verrou. Il utilise désormais `refreshDecisionSource` et le contrôle d'exécution commun avant toute nouvelle activation, y compris sur un verrou existant. Le ticker reste étiqueté selon sa propre fraîcheur ; une donnée d'exécution absente suspend la décision. Les niveaux et le suivi des sorties d'une observation déjà activée restent conservés. Aucun seuil stratégique ajouté. 37 tests ciblés verts après correction. Le texte de limite ticker utilise aussi le paramètre central, sans constante parallèle.

## Candidate distincte et autorisation de transfert

Le « oui » utilisateur suivant la demande d'envoi autorise le push de la branche vers `GenkiDama545/institutional-radar`. Il n'autorise ni merge ni déploiement. Les commits existants sont préservés. V8.9.16-rc.1 identifie la candidate ; titre, APP_VERSION, URLs d'assets et cache Service Worker sont alignés et protégés par un test. Les clés de données utilisateur ne sont pas renommées. La validation finale est décrite dans le rapport de clôture.

Le premier gate de la RC a signalé quatre assertions d'URL encore fixées à V8.9.15 dans `engine.test.cjs`. Seules ces attentes de version sont mises à V8.9.16-rc.1 ; aucune fixture de score/niveaux n'est régénérée. Le test indépendant des assets vérifie aussi l'alignement index/application/cache.

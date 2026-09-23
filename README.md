# Institutional Radar V8.6.6 — Learning Engine

Fondation Spot + Perp, moteur directionnel LONG/SHORT et mémoire d'apprentissage gouvernée.

## Principes
- Univers Spot large ; perpétuel associé quand disponible.
- Analyse technique commune aux deux produits.
- Données spécifiques aux dérivés conservées : OI, funding, liquidations quand disponibles.
- Spot : scénario LONG ; Perp : LONG et SHORT.
- LONG et SHORT sont évalués séparément.
- Aucun scénario est une sortie valide.
- Les scénarios sont conditionnels : entrée, invalidation, TP1/TP2/TP3.
- Les données manquantes restent N/D.

## Learning Engine
Chaque scénario verrouillé dans la projection live est enregistré localement avec :
- contexte marché au moment de la création ;
- direction, produit, régime, MTF ;
- scores LONG/SHORT et qualité ;
- signaux et confluences ;
- niveaux Entry/SL/TP ;
- résultat final et R réalisé.

Les données restent dans le navigateur. Elles ne remontent pas automatiquement vers ChatGPT.
Le bouton **Mémoire & apprentissage → Exporter les données d'apprentissage** produit un JSON `IR_LEARNING_V2` qui peut ensuite être envoyé ici pour analyse.

## Gouvernance
Les résultats réels ne réécrivent jamais directement le moteur. Ils servent à formuler des hypothèses qui doivent passer par DEV, validation, puis HOLDOUT avant adoption.

## Publication
Décompresser et publier les fichiers du dossier sur GitHub Pages.


## Interface V8.6.6
- En-tête synchronisé sur V8.6.6 • Learning Engine.
- Top des configurations tous marchés confondus.
- Identification explicite SPOT + LONG / PERP + SHORT.
- Filtres de lecture : Tout, Spot, Long, Short.
- Les catégories Très tradables / Tradables / Surveillance / Faible intérêt restent séparées.

## V8.6.6 — nettoyage et gouvernance renforcée
- Une seule clé canonique pour l’historique des scans et une seule pour le journal d’apprentissage. Les anciennes clés sont migrées une fois puis ne sont plus écrites.
- Journal d’apprentissage idempotent : un verrou de scénario ne crée pas de doublon après rafraîchissement.
- Export `IR_LEARNING_V2` avec version applicative explicite.
- Statistiques par configuration avec taux TP, R moyen, dispersion du R et intervalle de confiance de Wilson.
- Les statistiques servent à générer des hypothèses ; elles ne réécrivent jamais automatiquement les poids du moteur.
- Limite locale du journal portée à 1500 observations.

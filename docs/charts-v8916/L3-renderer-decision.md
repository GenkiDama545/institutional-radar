# L3 — Prototype Lightweight Charts 5.2.1

Statut : **non promu**. Le renderer produit restera SVG, conformément au repli autorisé.

Prototype reproductible : `prototypes/lightweight-charts/index.html`, servi avec un serveur statique local.
Il reçoit un ViewModel synthétique préparé par les helpers actuels, trace OHLC/volume/EMA/RSI/Stoch,
conserve les timestamps en millisecondes dans le contrat et convertit en secondes uniquement à la frontière LWC.
Les niveaux sont des lignes à leur valeur exacte. Aucun endpoint, score ou journal n'est accessible au renderer.

Provenance : paquet npm officiel `lightweight-charts@5.2.1`, licence Apache 2.0 et NOTICE du tag v5.2.1 conservés.
SHA256 du bundle : `e21cc5caa0226ef30bd8549c50b9ef926615f2a4ee6b4e486353477a55f598cf`.
Le prototype porte l'attribution et le lien TradingView. Il n'est ni importé par l'application ni pré-caché.

## Évaluation

| Critère | Résultat à ce stade |
|---|---|
| ViewModel et passage des données | Adaptateur écrit ; conversions et niveaux contrôlables |
| Palette et panneaux | Options alignées sur les couleurs existantes ; vérification visuelle non effectuée |
| Fluidité pan/zoom, sélection et responsive | Non démontrée dans le navigateur cible |
| Pinch mobile réellement utilisable | Non démontré ; aucun appareil physique disponible |
| Accessibilité et coexistence avec le simulateur | Non démontrées de bout en bout pour LWC |
| Licence, attribution, version figée | Présentes dans le prototype isolé |
| Décision de généralisation | **NON : les critères obligatoires ne sont pas tous vérifiés** |

Le navigateur Work a refusé `http://127.0.0.1:8765` (`ERR_BLOCKED_BY_CLIENT`) et le protocole de fichier
partagé (`browser URL policy`). Aucun contournement, navigateur alternatif, CDP brut ou déploiement de
prévisualisation n'a été utilisé. Ce blocage ne prouve aucun défaut de la bibliothèque ni de l'application.

La suite L4–L7 utilise SVG et les contrats communs. La recette navigateur/tactile reste un gate explicite
à effectuer sur un environnement autorisé ; les tests DOM/unitaires ne seront pas présentés comme son équivalent.

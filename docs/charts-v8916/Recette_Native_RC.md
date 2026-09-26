# Recette native obligatoire — V8.9.17-rc.1

**Statut : à exécuter avant adoption.** Les tests DOM et les SVG statiques sont distincts de cette recette.
L'accès navigateur Work au serveur local et au fichier partagé a été refusé par la politique de navigation.
Aucun autre navigateur ou déploiement de prévisualisation n'a été utilisé pour contourner ce refus.

## Installation dans un environnement autorisé

1. Checkout de la branche `charts/v8.9.17-rc.1` ; noter `git rev-parse HEAD` et le résultat CI du même SHA.
2. Servir ce checkout avec un serveur HTTP statique dans son environnement de développement autorisé.
   Ne pas remplacer la branche de production. Ne pas importer de secrets ni de clés de trading.
3. Sur un profil de navigateur de test, utiliser les données synthétiques du script `tests/browser-audit.cjs`
   pour rendre la recette indépendante de l'accès à OKX. Ce script optionnel a été adapté mais **pas exécuté**.
   Dans un environnement disposant de Playwright, Chromium et d'un checkout V8.9.16 :
   `node tests/browser-audit.cjs <baseline-directory> <chromium-executable> <artifacts-directory>`.
4. Compléter par une séance avec les données réelles OKX ; en cas d'erreur réseau, conserver URL/statut/console
   et distinguer la panne API du rendu. Ne pas accepter un scan partiel comme validation de tous les marchés.

## Matrice de validation

| Vérification | Desktop Chrome/Firefox | Android Chrome réel | iOS Safari réel |
|---|---|---|---|
| Fiche, Prix, profondeur, projection à 360/390/768/1440 px et paysage | À faire | À faire | À faire |
| Aucun changement hors zone graphique, polices/cartes/navigation identiques | À faire | À faire | À faire |
| Densité immédiate : corps/mèches lisibles, 3 000 bougies disponibles | À faire | À faire | À faire |
| Glisser horizontal ; zoom ancré ; trackpad/molette si graphique focalisé | À faire | — | — |
| Tap, appui long, inspection, boutons ←/→ ; High/Low et date hors du doigt | — | À faire | À faire |
| Pinch à deux doigts sans saut ni perte de sélection | — | À faire | À faire |
| Scroll vertical de page préservé ; zoom/accessibilité navigateur hors graphique | À faire | À faire | À faire |
| Flèches, +/−, Home/End, Escape ; focus visible ; zoom texte 200 % | À faire | À faire | À faire |
| Sélection au même timestamp après refresh, resize, pan, historique antérieur | À faire | À faire | À faire |
| Ticker/open/close distincts ; expiration du ticker ; erreur de refresh visible | À faire | À faire | À faire |
| TP distant : hors champ avec valeur exacte ; fit niveaux explicite ; null absent | À faire | À faire | À faire |
| Référence moteur vs consultation ; EMA/RSI invariants pendant gestes | À faire | À faire | À faire |
| Six horizons inchangés ; 1m de consultation sans appel métier | À faire | À faire | À faire |
| Saisie des deux simulateurs conservée, même après perte de focus et refresh | À faire | À faire | À faire |
| Funding signé, score 0, OI irrégulier, volume histogramme et périodes partielles | À faire | À faire | À faire |
| Ancien favori/verrou sans historique complet : aucune fausse preuve historique | À faire | À faire | À faire |
| Absence d'erreur console, listeners/timers libérés à la sortie, retour fiche actif | À faire | À faire | À faire |
| Réseau lent, WS interrompu, REST tardif, dernier message WS isolé rendu | À faire | À faire | À faire |
| Cache RC cohérent en ligne/hors ligne ; aucune donnée métier effacée | À faire | À faire | À faire |

## Mesures à consigner

- SHA exact, appareil, OS, navigateur, largeur réelle du conteneur, DPR, taille de texte.
- Frame/input mesurés dans le navigateur, mémoire après dix navigations, délai de sélection/pan/pinch.
  Viser une interaction sans blocages perceptibles ; relever p50/p95 et les longues tâches. Les timings Node
  de `evidence/static-render-results.json` ne mesurent ni layout, ni paint, ni gestes natifs.
- Captures de chaque usage et des erreurs. Pour l'identité générale, comparer avec la même fixture V8.9.16.
- En cas d'échec tactile : garder la candidate en brouillon ; ne pas promouvoir LWC automatiquement ni modifier le moteur.

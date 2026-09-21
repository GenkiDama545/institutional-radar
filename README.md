# Institutional Radar V6.4

Version de fiabilisation de V6.

## Corrections
- Sélecteurs timeframe/période synchronisés avec les données réellement chargées.
- Protection contre les réponses asynchrones anciennes qui pouvaient remplacer une sélection plus récente.
- Historique multi-timeframe récupéré par pagination lorsque la période dépasse la limite d’une requête.
- Une période 1D/14J n’est plus artificiellement gonflée à 48 points.
- Axes temporels adaptés : heures pour une journée, dates + heures pour plusieurs jours.
- Texte des axes et valeurs du graphique agrandi pour mobile.
- Architecture V6 conservée.

Les données de marché restent basées sur les API publiques OKX utilisées par le radar.

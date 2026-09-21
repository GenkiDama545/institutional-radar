# Institutional Radar V6.6

Evolution de V6 sans changement d’architecture.

## Graphique terminal
- Chandeliers OHLC réels OKX.
- Axe prix dynamique, y compris micro-prix.
- Axe temps lisible.
- MIN / ACTUEL / MAX avec précision adaptée.
- Volume par bougie en devise de cotation, sans double multiplication par le prix.
- EMA20, EMA50 et Supertrend.
- RSI, StochRSI et OBV.
- Résolution : 1m / 5m / 15m / 1H / 4H / 1D.
- Période : 24H / 3J / 7J / 14J / 30J / 90J.
- Combinaisons trop fines signalées au lieu d’inventer des données.
- Pagination des chandeliers et recours à l’historique OKX pour les périodes plus longues.

## Lecture trader
- Scénarios continuation, breakout/retest, pullback et absence de trade.
- Checklist débutant : raison, niveau, confirmation, invalidation, risque, discipline.
- Simulateur entrée / stop / TP / levier.
- Glossaire et parcours pédagogique conservés.

## Sources
Les chandeliers et volumes utilisent les champs documentés par l’API publique OKX.

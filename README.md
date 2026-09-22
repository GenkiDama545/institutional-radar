Institutional Radar — V8.4.8

Correction ciblée du chargement Scénarios.

Cause corrigée : le moteur utilisait `mtf.major.length` alors que l'objet retourné par le consensus ne contenait pas de propriété `major`. Cela provoquait exactement l'erreur « Cannot read properties of undefined (reading 'length') ».

V8.4.8 calcule maintenant le nombre de timeframes majeures à partir de `mtf.rows` avant d'évaluer l'alignement.

Conserve les corrections précédentes : labels de projection à gauche, actualisation live, simulation intégrée TP1/TP2/TP3.

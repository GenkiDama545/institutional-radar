# Institutional Radar V7.3

V7.3 refond le moteur de scénario et la lecture trader.

## Changements principaux
- scénario verrouillé uniquement si son invalidation n'est pas déjà franchie à la création ;
- recherche d'une nouvelle configuration fonctionnelle après invalidation ;
- niveaux d'un scénario verrouillé conservés pendant tout son suivi ;
- prix et bougies du graphique actualisés périodiquement ;
- RSI conservé et StochRSI corrigé avec lignes K/D ;
- étiquettes Déclencheur / Invalidation / TP1 / TP2 / TP3 mieux réservées à droite du graphique ;
- blocs Lecture trader, Contexte & acteurs et Scénarios enrichis ;
- nettoyage du texte de développement présent sur l'accueil ;
- menu horizontal des indicateurs conservé.

Les scénarios restent conditionnels : une activation signifie que les conditions définies par le moteur sont remplies, pas qu'un résultat financier est garanti.

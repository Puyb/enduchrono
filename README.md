# enduchrono

Système de chronometrage de course de roller

## chrono : App dialogant avec le chonometre

Fait l'interface entre le service classement le materiel chronelec
La communication avec chronelec se fait en UDP
Les actions sont reçu en HTTP
Les tours et le status sont envoyé en websocket
Stockage des tours dans une base SQLite
Rattrapage des tours en cas de déco avec chronelec ou avec classement

## classement : App calculant le classement

Coeur métier de la course
Fait le rapprochement entre les tours et les equipes/équipier et calcul le classement
Stock tout dans une base SQLite


## sim : App simulant le hardware chonelec

Envoi en UDP des tours et simule le temps qui passe

## Setup

Prod avec simulateur:

```docker-compose --profile prod up```

Interface sur http://localhost:3000/

Interface du simulateur sur http://localhost:3002/

Mode dev (auto-reload /  rebuild) :

```docker-compose --profile dev up```

Interface sur http://localhost:8080/

Interface du simulateur sur http://localhost:8081/



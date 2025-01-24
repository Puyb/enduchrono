# enduchrono

Système de chronometrage de course de roller

## chrono : App dialogant avec le chonometre

Fait l'interface entre le service classement le materiel chronelec
La communication avec chronelec se fait en UDP
Les actions sont reçu en HTTP
Les tours et le status sont envoyé en websocket
Stockage des tours dans une base SQLite
Rattrapage des tours en cas de déco avec chronelec ou avec classement

Lancement
```
cd chrono
npm install
node index.js
```

## classement : App calculant le classement

Coeur métier de la course
Fait le rapprochement entre les tours et les equipes/équipier et calcul le classement
Stock tout dans une base SQLite

Lancement
```
cd classement
npm install
node server.js
```

En attendant que le service puisse servir l'inteface web, il faut lancer le serveur vue à la main
```
cd ui
npm install
npm run serve
```

Interface sur http://localhost:8080


## sim : App simulant le hardware chonelec

Envoi en UDP des tours et simule le temps qui passe

Lancement
```
cd sim
npm install
node index.js
```

En attendant que le service puisse servir l'inteface web, il faut lancer le serveur vue à la main
```
cd ui
npm install
npm run serve
```

Interface sur http://localhost:8081



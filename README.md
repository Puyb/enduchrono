# enduchrono

Système de chronometrage de course de roller

## chrono : App dialogant avec le chonometre

Envoi des requêtes http à l'app classement à chaque tour reçu

## classement : App calculant le classement

Elle reçoit des requête HTTP de l'app chrono a chaque tour comptabilisé

Lancement
```
cd classement
npm install
node server.js
```

En attendant que le service puisse service l'inteface web, il faut lancer le serveur vue à la main
```
cd ui
npm install
npm run serve
```

Interface sur http://localhost:8080

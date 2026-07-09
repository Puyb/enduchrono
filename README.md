# EnduChrono

Systeme de chronometrage pour course d'endurance roller.

## Services

- `sim` : simulateur Chronelec (UDP + API de pilotage)
- `chrono` : acquisition UDP, persistence des passages, diffusion WebSocket
- `classements` : logique metier (tours, doublons, classements, corrections)
- `web` : diffusion publique simplifiee des classements

Flux principal :

```text
sim (UDP) <-> chrono <-> classements <-> web
```

## Lancer la plateforme

Production (avec simulateur) :

```bash
docker-compose --profile prod up --build
```

Developpement (auto-reload + UIs) :

```bash
docker-compose --profile dev up
```

## URLs utiles (mode dev)

APIs :
- `http://localhost:3000` (`classements`)
- `http://localhost:3001` (`chrono`)
- `http://localhost:3002` (`sim`)
- `http://localhost:3003` (`web`)

Interfaces :
- `http://localhost:8080` (UI `classements`)
- `http://localhost:8081` (UI `sim`)
- `http://localhost:8082` (UI `web`)

## Documentation

- Fonctionnel : `docs/specifications.md`
- Architecture technique : `docs/architecture_technique.md`
- Protocole UDP Chronelec (inference) : `CHRONELEC_UDP_PROTOCOL.md`
- Rapport de conformite doc/code : `docs/rapport_conformite.md`


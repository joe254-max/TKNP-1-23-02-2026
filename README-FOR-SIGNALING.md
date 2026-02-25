Local run and deployment

Quick steps to run the Socket.io signaling server locally:

```bash
# from repo root
cd signaling-server
npm install
node index.js
```

Docker build & run:

```bash
cd signaling-server
docker build -t tkpn-signaling-server .
docker run -p 4000:4000 tkpn-signaling-server
```

Set your front-end Vite env (project root `.env`):

```
VITE_SIGNALING_SERVER_URL=http://your-server:4000
```

Deployment notes:
- Vercel serverless functions are not suitable for persistent WebSocket servers. Use a host that supports long-lived WebSocket connections: Render, Fly, Railway, Heroku, DigitalOcean App Platform, AWS Elastic Beanstalk, or a container service (Cloud Run, ECS).
- For production performance and multi-user media routing, consider an SFU (LiveKit, Jitsi, Janus) or a managed service.

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3001 });

const sessionStore = {};

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(rawMessage) {
    const message = JSON.parse(rawMessage);
    const {sessionId, type} = message;
    const session = sessionStore[sessionId];
    if (session) {
      switch (type) {
        case 'SHUTDOWN':
          console.log(`shutting down session: ${sessionId}`);
          session.host.close(1000, 'User initiated shutdown');
          session.members.forEach((memberWs) => memberWs.close(1000, 'Host shutdown the session'))
          delete session[sessionId];
        default:
          console.log('Sending message to members...');
          console.log(JSON.stringify(message, null, 2));
          session.members.forEach((memberWs) => memberWs.send(message))
      }
    } else {
      switch(type) {
        case 'INIT': 
          const state = message.state;
          ws.send('initialized');
          sessionStore[sessionId] = createSessionDetails(ws);
          break;
        case 'CONNECT':
          const hostSession = sessionStore[message.host];
          hostSession.members.push(ws);
        default:
      }
    }
  });
  ws.send('Connected to flux server');
});

function createSessionDetails(host, state) {
  return {
    host,
    state,
    members: []
  };
}

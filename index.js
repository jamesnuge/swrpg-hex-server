const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const fs = require('fs');
const utils = require('./src/state/util');

console.log('Running in mode:', process.env.NODE_ENV);


const PORT = process.env.SERVER_PORT;
if (PORT) {

  console.log('is production?', utils.isProduction());
  const wss = new WebSocket.Server(
    // utils.isProduction() ?
    //   { server: https.createServer({
    //     cert: fs.readFileSync('./keys/server.cert'),
    //     key: fs.readFileSync('./keys/server.key')
    //   })} :
      { port: PORT }
  )
  const sessionStore = {};

  wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(rawMessage) {
      const message = JSON.parse(rawMessage);
      const { user, type, payload } = message;
      const { sessionId, userId } = user;
      const session = sessionStore[sessionId];
      console.log('received message with sessionId: ', sessionId);
      console.log('-> of type: ', type);
      if (session) {
        console.log('-> has session')
        switch (type) {
          case 'SHUTDOWN':
            session.host.close(1000, 'User initiated shutdown');
            session.members.forEach((memberWs) => memberWs.close(1000, 'Host shutdown the session'))
            delete session[sessionId];
            break;
          case 'HEX_SELECTED':
            console.log('-> HEX_SELECTED')
            console.log('userId:', userId);
            console.log('sessionId:', sessionId);
            const messageWithUserDetails = withUserDetails(message, userId);
            if (userId === sessionId) {
              console.log('   -> is the host')
              session.members.forEach((socket) => socket.send(messageWithUserDetails));
            } else {
              console.log('   -> is not the host')
              session.host.send(JSON.stringify(messageWithUserDetails));
              session.members
                .filter((member) => member.id !== userId)
                .forEach((member) => member.send(messageWithUserDetails));
            }
            if (session.state.selectedHex) {
              session.state.selectedHex = undefined;
            } else {
              session.state.selectedHex = message.payload;
            }
            break;
          case 'JOIN_SESSION':
            console.log(' -> processing join session')
            const { members } = sessionStore[message.user.sessionId];
            const memberToAdd = {
              id: userId,
              send: (message) => {
                if (typeof message === 'object') {
                  const rawMessage = JSON.stringify(message)
                  console.log('Sending message to member: ', message)
                  ws.send(rawMessage);
                } else if (typeof message === 'string') {
                  ws.send(message);
                  console.log('Sending message to member: ', message)
                } else {
                  console.warn('Cannot send message of type: ', typeof message);
                }
              }
            }
            members.push(memberToAdd);
            memberToAdd.send({
              type: 'INITIALIZE_BOARD',
              payload: {
                radius: session.radius
              }
            });
            if (session.state.selectedHex) {
              memberToAdd.send({
                type: 'HEX_SELECTED',
                payload: session.state.selectedHex,
                origin: sessionId
              })
            }
            break;
          default:
            console.log('Unconfigured message type detected...');
            console.log('message: ');
            console.log(JSON.stringify(message, null, 2));
        }
      } else {
        switch (type) {
          case 'INITIALIZE_BOARD':
            ws.send('initialized');
            sessionStore[sessionId] = createSessionDetails(ws, payload.radius);
            break;
          default:
        }
      }
    });
    ws.send('Connected to flux server');
  });

  function createSessionDetails(host, radius) {
    return {
      host,
      state: {},
      members: [],
      radius
    };
  }

  const withUserDetails = (message, userId) => {
    return {
      ...message,
      origin: userId
    }
  }
  // if (utils.isProduction()) {
    // wss.server.listen(PORT);
  // }
  console.log('listening on port:', PORT);

} else {
  throw new Error(`Misconfiguration: Server port env variable must be defined`)
}
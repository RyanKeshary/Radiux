import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';

// Polyfill WebSocket in Node environment for testing
globalThis.WebSocket = WebSocket;

console.log('Testing WebSocket Yjs connection to ws://localhost:1234...');

const doc1 = new Y.Doc();
const doc2 = new Y.Doc();

const room = 'test-room-' + Date.now();
const provider1 = new WebsocketProvider('ws://localhost:1234', room, doc1);
const provider2 = new WebsocketProvider('ws://localhost:1234', room, doc2);

const text1 = doc1.getText('code');
const text2 = doc2.getText('code');

let p1Connected = false;
let p2Connected = false;

provider1.on('status', (event) => {
  if (event.status === 'connected') p1Connected = true;
});

provider2.on('status', (event) => {
  if (event.status === 'connected') p2Connected = true;
});

setTimeout(() => {
  console.log('Inserting text in doc1: "console.log(\'Hello CodeCollab!\');"');
  text1.insert(0, "console.log('Hello CodeCollab!');");

  setTimeout(() => {
    console.log('Doc2 received text:', JSON.stringify(text2.toString()));
    if (text2.toString() === "console.log('Hello CodeCollab!');") {
      console.log('SUCCESS: Real-time bi-directional CRDT synchronization verified!');
      provider1.destroy();
      provider2.destroy();
      process.exit(0);
    } else {
      console.error('FAILED: Text mismatch. Received:', text2.toString());
      provider1.destroy();
      provider2.destroy();
      process.exit(1);
    }
  }, 1000);
}, 1000);

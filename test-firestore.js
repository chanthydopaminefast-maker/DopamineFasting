import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    const shareId = 'test-share-123';
    await setDoc(doc(db, 'sharedNotes', shareId), {
      id: shareId,
      ownerId: 'test-user',
      ownerName: 'Test',
      type: 'self-learning',
      title: 'Test',
      payload: { foo: 'bar', children: [{id: "123", title: "sub"}] },
      createdAt: new Date().toISOString()
    });
    console.log('Successfully wrote to Firestore!');
    process.exit(0);
  } catch (e) {
    console.error('Error writing to Firestore:', e);
    process.exit(1);
  }
}
run();

// Importamos Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCyegliX8kCuQOMFl9136nUX24u_0HDyeU",
  authDomain: "arcadiaexplorer-prime.firebaseapp.com",
  projectId: "arcadiaexplorer-prime",
  storageBucket: "arcadiaexplorer-prime.appspot.com",
  messagingSenderId: "261815686144",
  appId: "1:261815686144:web:57332c339510f5a91234e5"
};

// Inicializamos la aplicación
const app = initializeApp(firebaseConfig);

// Exportamos `app`, `db` (FireStore) y `auth` (Auth)
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
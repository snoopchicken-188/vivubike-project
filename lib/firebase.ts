import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCuOzLDeVjlG5hfcW_S8l2aZxXorkF3s7k",
  authDomain: "vivubike-86b86.firebaseapp.com",
  projectId: "vivubike-86b86",
  storageBucket: "vivubike-86b86.firebasestorage.app",
  messagingSenderId: "39681661722",
  appId: "1:39681661722:web:41f7ae73a5f716c35e2aa3",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
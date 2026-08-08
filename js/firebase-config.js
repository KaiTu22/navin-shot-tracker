// Firebase web config is safe to be public — access control is enforced by
// Firestore security rules (see firestore.rules), not by hiding this file.
// Fill in the values from Firebase Console -> Project settings -> General -> Your apps.
export const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.appspot.com',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME'
};

// UID of the one tracker account (from Firebase Console -> Authentication -> Users),
// used by firestore.rules to gate writes. Also fine to be public.
export const TRACKER_UID = 'REPLACE_ME';

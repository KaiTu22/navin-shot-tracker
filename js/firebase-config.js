// Firebase web config is safe to be public — access control is enforced by
// Firestore security rules (see firestore.rules), not by hiding this file.
// Fill in the values from Firebase Console -> Project settings -> General -> Your apps.
export const firebaseConfig = {
  apiKey: 'AIzaSyCIiBJasQxGu_p3IhWucr6tA8hgzRUVVgE',
  authDomain: 'shot-tracker-6a7b8.firebaseapp.com',
  projectId: 'shot-tracker-6a7b8',
  storageBucket: 'shot-tracker-6a7b8.firebasestorage.app',
  messagingSenderId: '494848183675',
  appId: '1:494848183675:web:76642dba44522ad66401de'
};

// UID of the one tracker account (from Firebase Console -> Authentication -> Users),
// used by firestore.rules to gate writes. Also fine to be public.
export const TRACKER_UID = 'RBF5luSvWmhYtwDyi79jo3hxHAz1';

// KRITISK: Alle muterende Cloud Functions MÅ bruke Admin SDK.
// RTDB-reglene har ".write": false på regions, players, nations, etc.
// KUN Admin SDK omgår disse reglene (autentiserer som server-prinsipal).
// Bruk ALDRI klient-SDK i functions/ — det vil feile stille.
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const db = admin.database();
export { admin };

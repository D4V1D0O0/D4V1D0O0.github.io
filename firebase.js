// ============================================================
// firebase.js
// Single shared Firebase initialisation.
// Import { db } from this file in every other module.
// ============================================================

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey:            "AIzaSyDeUOT-hWKgAnAtlwRFujoOpJNDP_WljoE",
    authDomain:        "polhemsgatan17b.firebaseapp.com",
    projectId:         "polhemsgatan17b",
    messagingSenderId: "330775555909",
    appId:             "1:330775555909:web:e644773610112ef007182c"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
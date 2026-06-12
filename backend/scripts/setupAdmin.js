require("dotenv").config();
const admin = require("firebase-admin");
const { initFirebaseAdmin } = require("../config/firebaseAdmin");

initFirebaseAdmin();

const uid = process.env.MAIN_ADMIN_UID;
if (!uid) {
  console.error("MAIN_ADMIN_UID is not set in backend/.env");
  process.exit(1);
}

admin
  .auth()
  .setCustomUserClaims(uid, { admin: true, authorized: true })
  .then(() => {
    console.log(`Admin and authorized claims set for UID: ${uid}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to set admin claims:", error.message);
    process.exit(1);
  });

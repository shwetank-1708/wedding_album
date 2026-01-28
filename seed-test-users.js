const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.error("Missing FIREBASE credentials in .env.local");
    process.exit(1);
}

const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
    })
});

const db = admin.firestore();

async function seedUsers() {
    const users = [
        {
            phone: "8535029872",
            data: {
                name: "Test Admin",
                phone: "8535029872",
                role: "admin",
                addedAt: admin.firestore.FieldValue.serverTimestamp()
            }
        },
        {
            phone: "8057422794",
            data: {
                name: "Test Guest",
                phone: "8057422794",
                role: "guest",
                addedAt: admin.firestore.FieldValue.serverTimestamp()
            }
        }
    ];

    console.log("Seeding users...");

    for (const user of users) {
        try {
            await db.collection("allowed_users").doc(user.phone).set(user.data);
            console.log(`✅ Added ${user.data.role}: ${user.phone}`);
        } catch (error) {
            console.error(`❌ Failed to add ${user.phone}:`, error);
        }
    }

    console.log("Done.");
    process.exit(0);
}

seedUsers();

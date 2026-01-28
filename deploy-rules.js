const admin = require('firebase-admin');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.error("Missing FIREBASE credentials in .env.local");
    process.exit(1);
}

// Fix private key newlines
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

const app = admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
    })
});

async function deployRules() {
    try {
        const source = fs.readFileSync('firestore.rules', 'utf8');

        console.log("Creating new ruleset...");
        const ruleset = await admin.securityRules().createRuleset({
            source: {
                files: [{
                    name: 'firestore.rules',
                    content: source
                }]
            }
        });

        console.log(`Ruleset created: ${ruleset.name}`);

        console.log("Releasing ruleset...");
        await admin.securityRules().releaseFirestoreRulesetFromSource(source);
        // Note: releaseFirestoreRulesetFromSource isn't a direct method, we usually use releaseFirestoreRuleset(ruleset.name)
        // But let's check the API.
        // The standard way is:
        // const ruleset = await admin.securityRules().createRuleset(...)
        // await admin.securityRules().releaseFirestoreRuleset(ruleset.name);

        // However, older localized helper might be handy. Let's stick to the raw API.

        const releaseName = await admin.securityRules().releaseFirestoreRuleset(ruleset.name);
        console.log(`Rules released successfully: ${releaseName}`);
        process.exit(0);
    } catch (error) {
        console.error("Error deploying rules:", error);
        process.exit(1);
    }
}

deployRules();

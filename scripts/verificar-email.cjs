const admin = require('../functions/node_modules/firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('../functions/service-account.json')) });

async function main() {
  const email = 'dugartecayamaa@gmail.com';
  const user = await admin.auth().getUserByEmail(email);
  console.log(`Usuario encontrado: ${user.uid} | emailVerified: ${user.emailVerified}`);
  await admin.auth().updateUser(user.uid, { emailVerified: true });
  console.log(`✅ Email verificado para ${email}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

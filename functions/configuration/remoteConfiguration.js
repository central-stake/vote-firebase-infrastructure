const admin = require('firebase-admin');

//=================================
const configParameter = {
  initialCreditCount: 30,
  quadratiqueEvolution: [
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78, 91, 105, 120, 136, 153, 171,
    190, 210,
  ],
};
//======================

if (admin.apps.length === 0) {
  // Initialize only once
  admin.initializeApp();
}
async function updateRemoteConfig() {
  // Fetch the current Remote Config template
  const template = await admin.remoteConfig().getTemplate();

  // Modify the template as needed
  template.parameters = {
    ...template.parameters,
    ...configParameter,
  };

  // Publish the updated template
  await admin.remoteConfig().publishTemplate(template);
  console.log('Remote Config template updated successfully.');
}
console.log('hellooooooooo');
updateRemoteConfig().catch(console.error);

module.exports = { updateRemoteConfig };

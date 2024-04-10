const functions = require('firebase-functions');
const admin = require('firebase-admin');
if (admin.apps.length === 0) {
  // Initialize only once
  admin.initializeApp();
}
function validationError(isValid, message, callback) {
  if (isValid) {
    console.log('Vote is valid.');
    // Proceed with any further logic, if necessary
  } else {
    console.error('Invalid vote submission.');
    // Optionally, delete the invalid vote document from Firestore
    // Ensure you handle this carefully to avoid unintended data loss
    callback();
    throw new Error(
      'Invalid vote submission: counts do not meet requirements.' + message
    );
  }
}
exports.validateAndCreateVote = functions
  .region('europe-west1')
  .firestore.document('votes/{voteId}')
  .onCreate(async (snapshot) => {
    const configParams = (await admin.remoteConfig().getTemplate()).parameters;
    const voteData = snapshot.data();
    const parties = voteData.parties;

    console.log(
      'check config ================ configParams' +
        JSON.stringify(configParams)
    );
    if (configParams.quadratiqueEvolution) {
      const quadratiqueEvolution = JSON.parse(
        configParams.quadratiqueEvolution.defaultValue.value
      );

      // very disgusting code; I know
      if (
        !Array.isArray(quadratiqueEvolution) ||
        quadratiqueEvolution.length == 0
      ) {
        var acc = 0;
        const serieQuadratique = quadratiqueEvolution.map((i) => {
          acc = acc + i;
          return acc;
        });
        // Validate each individual count is in [1, 3, 5]
        const isValidCount = Object.values(parties).every((party) =>
          serieQuadratique.includes(party.count)
        );

        await validationError(
          isValidCount,
          'Bad Quadratique Evolution',
          async () => {
            await snapshot.ref.delete();
          }
        );
      }
    }

    if (
      !!configParams.initialCreditCount &&
      configParams.initialCreditCount.defaultValue.value > 0
    ) {
      const initialCreditCount =
        configParams.initialCreditCount.defaultValue.value;
      // Calculate the total count
      const totalCount = Object.values(parties).reduce(
        (sum, party) => sum + Math.abs(party.count),
        0
      );
      await validationError(
        totalCount <= initialCreditCount,
        `${totalCount} : Used more credits that allowed => ${initialCreditCount}`,
        async () => {
          await snapshot.ref.delete();
        }
      );
    }
  });

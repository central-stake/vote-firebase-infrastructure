const functions = require('firebase-functions');
const admin = require('firebase-admin');
if (admin.apps.length === 0) {
  // Initialize only once
  admin.initializeApp();
}

async function updateParties(campaignId, voteData) {
  let totalVotesIncrement = 0;
  let totalClassicVotesIncrement = 0;
  await Promise.all(
    Object.keys(voteData.parties).map(async (partyId) => {
      const { count } = voteData.parties[partyId];
      const partyRef = admin.database().ref(`parties/${campaignId}/${partyId}`);
      // Transactionally update the party vote count
      await partyRef.child('voteCount').transaction((current) => {
        return (current || 0) + count;
      });

      // Update classic vote count (assuming positive counts contribute to classic votes)
      if (count > 0) {
        await partyRef.child('classicVoteCount').transaction((current) => {
          return (current || 0) + 1;
        });
        totalClassicVotesIncrement += 1;
      } else {
        await partyRef.child('classicVoteCount').transaction((current) => {
          return current || 0;
        });
      }
      // Increment total votes for overall election metrics
      totalVotesIncrement += Math.abs(count);
    })
  );
  return {
    totalVotesIncrement: totalVotesIncrement,
    totalClassicVotesIncrement: totalClassicVotesIncrement,
  };
}

async function updateResult(
  campaignId,
  totalVotesIncrement,
  totalClassicVotesIncrement
) {
  // Update overall election results
  const resultsRef = admin.database().ref(`results/${campaignId}`);
  // Update total vote count
  await resultsRef.child('participantsCount').transaction((current) => {
    return (current || 0) + 1;
  });
  await resultsRef.child('voteCount').transaction((current) => {
    return (current || 0) + totalVotesIncrement;
  });

  // Update classic vote count for the election
  await resultsRef.child('classicVoteCount').transaction((current) => {
    return (current || 0) + totalClassicVotesIncrement;
  });
}

// Fonction pour calculer les quotients pour chaque parti
function calculateQuotients(seats, votes, keyObj) {
  let quotients = [];
  Object.entries(votes).forEach(([key, value]) => {
    for (let i = 1; i <= seats; i++) {
      quotients.push({ quotient: value[keyObj] / i, partyIndex: key });
    }
  });
  return quotients;
}

// Fonction pour attribuer les sièges selon la méthode D'Hondt
function baseDistributeSeats(seats, votes, keyObj) {
  const quotients = calculateQuotients(seats, votes, keyObj);

  // Tri des quotients du plus grand au plus petit
  quotients.sort((a, b) => b.quotient - a.quotient);

  // Initialisation de la répartition des sièges
  let seatsWon = new Object();
  // Attribution des sièges
  for (let i = 0; i < seats; i++) {
    incrementObject(seatsWon, quotients[i].partyIndex);
  }

  return seatsWon;
}

function incrementObject(obj, key) {
  if (obj[key]) {
    obj[key] += 1;
  } else {
    obj[key] = 1;
  }
}

async function distributeSeats(campaignId, seats) {
  const partiesRef = admin.database().ref(`parties/${campaignId}`);
  const snapshot = await partiesRef.once('value');

  //if (!snapshot.exists()) {
  //  return [];
  //}

  const partiesData = snapshot.val();
  const valueDistributeSeats = baseDistributeSeats(
    seats,
    partiesData,
    'classicVoteCount'
  );
  const classicValueDistributeSeats = baseDistributeSeats(
    seats,
    partiesData,
    'voteCount'
  );
  for (const key of Object.keys(partiesData)) {
    const partyRef = admin.database().ref(`parties/${campaignId}/${key}`);
    await partyRef.child('seatCount').transaction(() => {
      return valueDistributeSeats[key] || 0;
    });
    await partyRef.child('classicSeatCount').transaction(() => {
      return classicValueDistributeSeats[key] || 0;
    });
  }
}

exports.updateVoteCountsAndResults = functions
  .region('europe-west1')
  .firestore.document('votes/{voteId}')
  // (change, context) -> (change, _)
  .onWrite(async (change) => {
    // Get the new vote data
    const voteData = change.after.exists ? change.after.data() : null;
    const campaignId = voteData ? voteData.campaignId : null;
    if (!voteData || !campaignId) return null; // Exit if no data or campaignId
    const { totalVotesIncrement, totalClassicVotesIncrement } =
      await updateParties(campaignId, voteData);
    await updateResult(
      campaignId,
      totalVotesIncrement,
      totalClassicVotesIncrement
    );
    await distributeSeats(campaignId, 125);
  });

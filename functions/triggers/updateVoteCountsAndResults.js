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
    Object.keys(voteData.parties).forEach(async (partyId) => {
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
  await resultsRef.child('voteCount').transaction((current) => {
    return (current || 0) + totalVotesIncrement;
  });

  // Update classic vote count for the election
  await resultsRef.child('classicVoteCount').transaction((current) => {
    return (current || 0) + totalClassicVotesIncrement;
  });
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
  });

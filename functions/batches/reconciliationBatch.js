const functions = require('firebase-functions');
const admin = require('firebase-admin');
if (admin.apps.length === 0) {
  // Initialize only once
  admin.initializeApp();
}

async function recalculateElectionData() {
  const firestore = admin.firestore();
  const realtimeDb = admin.database();

  // Fetch all votes from Firestore
  const votesSnapshot = await firestore.collection('votes').get();

  // Structures to hold recalculated data
  let partyVoteCounts = {}; // For each campaign and party
  let electionResults = {}; // For each campaign

  votesSnapshot.docs.forEach((doc) => {
    const vote = doc.data();
    const campaignId = vote.campaignId;

    if (!partyVoteCounts[campaignId]) {
      partyVoteCounts[campaignId] = {};
      electionResults[campaignId] = { voteCount: 0, classicVoteCount: 0 };
    }

    Object.entries(vote.parties).forEach(([partyId, partyVote]) => {
      const { count } = partyVote;

      // Initialize if party entry doesn't exist
      if (!partyVoteCounts[campaignId][partyId]) {
        partyVoteCounts[campaignId][partyId] = {
          voteCount: 0,
          classicVoteCount: 0,
          result: 0,
          classicResult: 0,
        };
      }

      // Update party vote counts
      partyVoteCounts[campaignId][partyId].voteCount += Math.abs(count);
      if (count > 0) {
        electionResults[campaignId].classicVoteCoun += 1;
      }

      // Update election results
      electionResults[campaignId].voteCount += Math.abs(count);
      partyVoteCounts[campaignId][partyId].result = (
        electionResults[campaignId].voteCount /
        electionResults[campaignId].voteCount
      ).toFixed(2);
      if (count > 0) {
        electionResults[campaignId].classicVoteCount += 1;
        partyVoteCounts[campaignId][partyId].classicResult = (
          electionResults[campaignId].classicVoteCount /
          electionResults[campaignId].classicVoteCount
        ).toFixed(2);
      }
    });
  });

  // Update the Realtime Database with recalculated data
  for (const [campaignId, parties] of Object.entries(partyVoteCounts)) {
    for (const [
      partyId,
      { voteCount, classicVoteCount, result, classicResult },
    ] of Object.entries(parties)) {
      await realtimeDb
        .ref(`parties/${campaignId}/${partyId}`)
        .update({ voteCount, classicVoteCount, result, classicResult });
    }
  }

  // Update overall election results
  for (const [campaignId, { voteCount, classicVoteCount }] of Object.entries(
    electionResults
  )) {
    await realtimeDb
      .ref(`results/${campaignId}`)
      .update({ voteCount, classicVoteCount });
  }
}

exports.scheduledDataReconciliation = functions
  .region('europe-west1')
  .pubsub.schedule('every 12 hours')
  // _=(context)
  .onRun(async () => {
    await recalculateElectionData();
    console.log('Election data reconciliation completed.');
  });

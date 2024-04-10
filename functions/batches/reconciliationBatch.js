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
  /*const resultsRef = admin.database().ref(`results/${campaignId}`);
  // Update total vote count
  await resultsRef.child('participantsCount').transaction((current) => {
    return (current || 0) + 1;
  });
  */
  // Structures to hold recalculated data
  let partyVoteCounts = {}; // For each campaign and party
  let electionResults = {}; // For each campaign
  let participantsCount = {}; // For each campaign

  votesSnapshot.docs.forEach((doc) => {
    const vote = doc.data();
    const campaignId = vote.campaignId;

    if (!partyVoteCounts[campaignId]) {
      partyVoteCounts[campaignId] = {};
      electionResults[campaignId] = { voteCount: 0, classicVoteCount: 0 };
      participantsCount[campaignId] = 0;
    }
    participantsCount[campaignId] += 1;
    console.log(`votes ${JSON.stringify(vote)}`);

    // duplicate
    const partiesArray = Object.entries(vote.parties)
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => ({
        id: key,
        ...value,
      }));

    // Find the entry with the maximum count
    const maxCountParty = partiesArray.reduce((prev, current) =>
      prev.count > current.count ? prev : current
    );

    console.log(`maxCountParty ${JSON.stringify(maxCountParty)}`);
    Object.entries(vote.parties).forEach(([partyId, partyVote]) => {
      const { count } = partyVote;

      // Initialize if party entry doesn't exist
      if (!partyVoteCounts[campaignId][partyId]) {
        partyVoteCounts[campaignId][partyId] = {
          voteCount: 0,
          classicVoteCount: 0,
        };
      }

      // Update party vote counts
      partyVoteCounts[campaignId][partyId].voteCount += Math.abs(count);
      if (count > 0 && maxCountParty.id == partyId) {
        partyVoteCounts[campaignId][partyId].classicVoteCount += 1;
      }

      // Update election results
      electionResults[campaignId].voteCount += Math.abs(count);
      if (count > 0 && maxCountParty.id == partyId) {
        electionResults[campaignId].classicVoteCount += 1;
      }
    });
  });

  // Update the Realtime Database with recalculated data
  for (const [campaignId, parties] of Object.entries(partyVoteCounts)) {
    for (const [partyId, { voteCount, classicVoteCount }] of Object.entries(
      parties
    )) {
      await realtimeDb
        .ref(`parties/${campaignId}/${partyId}`)
        .update({ voteCount, classicVoteCount });
    }
  }

  // Update overall election results
  for (const [campaignId, { voteCount, classicVoteCount }] of Object.entries(
    electionResults
  )) {
    await realtimeDb.ref(`results/${campaignId}`).update({
      voteCount,
      classicVoteCount,
      participantsCount: participantsCount[campaignId],
    });
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

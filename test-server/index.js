const { ApolloServer, gql } = require("apollo-server");
const firebase = require("firebase/app");
require("firebase/firestore");
require("firebase/database");
require("firebase/auth");
const { v4: uuidv4 } = require("uuid");
// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCGOZHgBttP9JRIUfIMOr7lK20b-RmIbsE",
  authDomain: "new-vote-be.firebaseapp.com",
  projectId: "new-vote-be",
  storageBucket: "new-vote-be.appspot.com",
  messagingSenderId: "443136024646",
  appId: "1:443136024646:web:29ed7d0ad46884f2696a47",
  measurementId: "G-4YC6VHL1DT",
  databaseURL:
    "https://new-vote-be-default-rtdb.europe-west1.firebasedatabase.app",
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
// Sign in anonymously
firebase
  .auth()
  .signInAnonymously()
  .then(() => {
    console.log("Signed in anonymously");
  })
  .catch((error) => {
    console.error("Error signing in anonymously:", error);
  });
const db = firebase.firestore();
const realTimeDb = firebase.database();

// GraphQL schema
const typeDefs = gql`
  type Query {
    getVotes(campaignId: String!): [Vote]
    getVoteById(id: ID!): Vote
    getParties(campaignId: String!): [Party]
    getResults(campaignId: String!): Results
  }

  type Mutation {
    submitVote(voteInput: VoteInput!): Boolean
  }

  input VoteInput {
    id: ID
    campaignId: String!
    parties: [PartyInput!]!
  }

  input PartyInput {
    id: String!
    count: Int!
  }

  type Vote {
    id: ID!
    campaignId: String!
    parties: [PartyVote!]!
  }

  type PartyVote {
    id: String!
    count: Int!
  }

  type Party {
    id: String!
    voteCount: Int
    classicVoteCount: Int
  }

  type Results {
    totalVotes: Int
    totalClassicVotes: Int
  }
`;

const resolvers = {
  Mutation: {
    submitVote: async (_, { voteInput }) => {
      const voteData = {
        id: !!voteInput.id ? voteInput.id : uuidv4(),
        campaignId: voteInput.campaignId,
        parties: voteInput.parties.reduce((acc, party) => {
          // Convert the array of parties into an object with party IDs as keys
          acc[party.id] = { count: party.count };
          return acc;
        }, {}),
      };

      await db.collection("votes").doc(voteInput.id).set(voteData);
      return true;
    },
  },
  Query: {
    getVotes: async (_, { campaignId }) => {
      const votesSnapshot = await db
        .collection("votes")
        .where("campaignId", "==", campaignId)
        .get();

      const votes = votesSnapshot.docs.map((doc) => {
        const voteData = doc.data();
        // Transform the parties object into an array of PartyVote
        const partiesArray = Object.entries(voteData.parties).map(
          ([id, { count }]) => ({
            id,
            count,
          })
        );

        return {
          id: voteData.id,
          campaignId: voteData.campaignId,
          parties: partiesArray,
        };
      });

      return votes;
    },
    getVoteById: async (_, { id }) => {
      const voteDoc = await db.collection("votes").doc(id).get();

      if (!voteDoc.exists) {
        throw new Error("Vote not found");
      }

      const voteData = voteDoc.data();
      // Transformer l'objet parties en un tableau de PartyVote
      const partiesArray = Object.entries(voteData.parties).map(
        ([id, { count }]) => ({
          id,
          count,
        })
      );

      return {
        id: voteDoc.id,
        campaignId: voteData.campaignId,
        parties: partiesArray,
      };
    },
    getResults: async (_, { campaignId }) => {
      const resultsRef = realTimeDb.ref(`results/${campaignId}`);
      const snapshot = await resultsRef.once("value");

      if (!snapshot.exists()) {
        throw new Error("Results not found for the specified campaign");
      }

      const resultsData = snapshot.val();
      return {
        totalVotes: resultsData.voteCount,
        totalClassicVotes: resultsData.classicVoteCount,
        // Assurez-vous que ces champs correspondent à ceux définis dans votre schéma GraphQL
      };
    },
    getParties: async (_, { campaignId }) => {
      const partiesRef = realTimeDb.ref(`parties/${campaignId}`);
      const snapshot = await partiesRef.once("value");

      if (!snapshot.exists()) {
        return [];
      }

      const partiesData = snapshot.val();
      const parties = Object.keys(partiesData).map((key) => ({
        id: key,
        ...partiesData[key],
      }));

      return parties;
    },
  },
  // Include other resolvers as necessary
};

const server = new ApolloServer({ typeDefs, resolvers });

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});

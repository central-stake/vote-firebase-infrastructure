// functions/index.js
const {
  updateVoteCountsAndResults,
} = require('./triggers/updateVoteCountsAndResults');
const { validateAndCreateVote } = require('./triggers/validateAndCreateVote');
const {
  scheduledDataReconciliation,
} = require('./batches/reconciliationBatch');
exports.updateVoteCountsAndResults = updateVoteCountsAndResults;
exports.validateAndCreateVote = validateAndCreateVote;
exports.scheduledDataReconciliation = scheduledDataReconciliation;

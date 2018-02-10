const tweet = require('./tweet');

module.exports = {
  handler: (event, context) => {
    tweet().then(() => {
      context.done();
    }).catch((err) => {
      context.done(err);
    });
  }
};

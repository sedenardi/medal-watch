const Twitter = require('twitter');
const _ = require('lodash');
const moment = require('moment-timezone');
const scrape = require('./scrape');

const config = require('./config');
const client = new Twitter(config.twitter);

const retryablePost = function(statusObj, cb) {
  client.post('statuses/update', statusObj, (error, tweet) => {
    if (error) {
      if (error.length) {
        if (error[0].code === 187) {
          console.log('Dupe tweet.');
          return cb();
        }
      }
      console.log(error);
      setTimeout(() => {
        retryablePost(status, cb);
      }, 1000 * 8);
    } else {
      console.log(tweet.user.name + ': ' + tweet.text);
      cb(null, tweet);
    }
  });
};

const post = function(statusObj) {
  return new Promise((resolve, reject) => {
    retryablePost(statusObj, (err, res) => {
      if (err) {
        return reject(err);
      }
      return resolve(res);
    });
  });
};

const BEFORE = moment.duration(30, 'minutes').as('milliseconds');
const THRESHOLD = moment.duration(5, 'minutes').as('milliseconds');
const getNextEvents = (schedule) => {
  const events = _(schedule)
    .filter((e) => {
      const until = moment(e.Start) - Date.now();
      return until > 0 &&
        until < (BEFORE + THRESHOLD) &&
        until > (BEFORE - THRESHOLD);
    })
    .value();
  return events;
};

const TZ = 'America/New_York';
const TIME_FORMAT = 'h:mmA';
const createTweet = (event) => {
  let str = `${moment.tz(event.Start, TZ).format(TIME_FORMAT)}-${moment.tz(event.End, TZ).format(TIME_FORMAT)} (EST)`;
  str += ` on ${event.Network}: ${event.EventName}`;
  if (event.EventDetails) {
    str += `, ${event.EventDetails}`;
  }
  str += ` (${event.Live ? 'LIVE' : 'TAPE'})`;
  return str;
};
const run = module.exports = () => {
  return scrape().then((schedule) => {
    const events = getNextEvents(schedule);
    console.log(`Creating ${events.length} tweets`);
    const actions = events.map((event) => {
      const status = createTweet(event);
      return post({ status: status });
    });
    return Promise.all(actions);
  });
};

// run().catch(console.log);

import * as csv from 'csv-stream';
import { open } from 'node:fs/promises';
import * as pe from 'post-entity';
import WordCache from '../src/wordCache';

const file = process.argv[2] || '';

if (file === '') {
  throw new RangeError();
}

const tokens = {};
// Initialize the parser
const options = {
  delimiter: '\t',
  endLine: '\n',
  columnOffset: 0,
  escapeChar: '"',
  enclosedChar: '"',
};

const csvStream = csv.createStream(options);

let prompt = `Using a list of words where the number after the comma is how frequently the word is used, give a detailed and critical summary (without using any positive terminology) about the personality, interests, fears, and hopes of the person using these words from the list (and account for frequency): 

`;

const alphanumOnly = /[^a-z\-]/g;

/**
 *
 */
async function main() {
  const cache = new WordCache(`${process.cwd()}/tests/test.db`, false)
    .reset()
    .connect();
  let user_id;
  const fd = await open(file, 'r');
  const stream = fd.createReadStream();
  stream
    .pipe(csvStream)

    .on('data', function (data) {
      // outputs an object containing a set of key/value pair representing a line found in the csv file.
      if (data.retweet !== 'False') {
        return;
      }

      if (data.language !== 'en') {
        return;
      }
      const tweet = data.tweet.toLowerCase();

      const text = pe
        .process(tweet)
        .filter((tweet) => tweet.type === 'text')
        .map((tweet) => tweet.raw.trim());

      for (const words of text) {
        const usages = cache.fetch(words);
        user_id = cache.addUsages(
          usages,
          data.username,
          new Date(data.created_at)
        );
      }
    })

    .on('close', function () {
      const report = cache.getReport(user_id);
      console.log(report);
    });
}

main();

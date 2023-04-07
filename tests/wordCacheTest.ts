import { test } from 'uvu';
import * as assert from 'uvu/assert';
import WordCache from '../src/wordCache';

test('WordCache: Basic', () => {
  console.log();
  const cache = new WordCache(`${process.cwd()}/tests/test.db`, false)
    .reset()
    .connect();

  const usages = cache.fetch(
    `Bro, we can't even do this like that lol, do don't and get wrecked :D https://www.test.com`
  );
  const user_id = cache.addUsages(usages, 'test', new Date());

  const future = new Date(Date.now() + 1000 * 60 * 60 * 5);
  const nextUsage = cache.fetch(`Bro, we did do it holy cow`);
  cache.addUsages(nextUsage, user_id, future);

  const report = cache.getReport(user_id);
  console.log(report);
});

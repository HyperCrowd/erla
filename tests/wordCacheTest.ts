import type { TimeSeriesBehavior } from '../src/behavior';
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { categorizeBehavior } from '../src/behavior';
import WordCache from '../src/wordCache';

test('WordCache: Basic', () => {
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

test('Behavior analysis', () => {
  const cache = new WordCache(`${process.cwd()}/tests/behavior.db`, false)
    .reset()
    .connect();

  const messages = [
    [`2023-04-09 03:42:51`, `@TheRealGreggles @OlSaintGrimnar Unsure`],
    [
      `2023-04-08 19:18:43`,
      `@OlSaintGrimnar I do this all the time  I shift from high nerd to hood rat on a whim  But I still have a home base :(`,
    ],
    [`2023-04-08 19:14:35`, `@TheRealGreggles Correct`],
    [
      `2023-04-08 09:37:19`,
      `I know we ain't spoke in a while  It's kinda foul, 'cause you're getting older  Ain't no time for you now  Wishing you were here so I could hold you now  (You're so far away from me)`,
    ],
    [
      `2023-04-08 09:22:28`,
      `@cIass_man LOOK AT THIS PRIME NERD DOING GOD'S WORK  HE'S RIGHT  he's perfectly right  more of this please &lt;3`,
    ],
    [
      `2023-04-08 09:05:48`,
      `Everyone has a grammar home base.  No one is exempt.  From this, I understand your psychology.`,
    ],
    [
      `2023-04-08 08:32:10`,
      `big numbers here  but  i'll be the first to say  she's up against forces she cannot comprehend  and she personalizes it  and that personalization is essential to marketing`,
    ],
    [`2023-04-08 08:15:36 `, `It's time to unravel The Empath`],
    [
      `2023-04-08 08:02:14`,
      `First round of measuring psychosecurity: success  https://t.co/VHSVTrtl1r`,
    ],
    [`2023-04-08 07:58:22`, `@NormaholAddict might be true!`],
    [`2023-04-08 07:57:46`, `@khit_khat_kat @poppymelt27 never`],
    [`2023-04-08 07:57:30`, `@CJWestphall 1 million a year since 1975!`],
    [`2023-04-08 07:56:56`, `@pooptartgav TELL ME MORE`],
    [`2023-04-07 18:03:24`, `🙃   https://t.co/EWf3Aas78G`],
    [`2023-04-07 18:03:11`, `@elonmusk 🙃   https://t.co/EWf3Aas78G`],
    [
      `2023-04-07 14:47:21`,
      `Hop on over to @whatever to see how bad things really are`,
    ],
    [`2023-04-07 14:46:49`, ` https://t.co/XCr4rzpUlG`],
    [`2023-04-07 00:43:57`, `@DaneCurley supply chain slowdowns`],
  ];

  let user_id: number;
  for (const message of messages) {
    const usages = cache.fetch(message[1]);
    user_id = cache.addUsages(usages, 'test', new Date(message[0]));
  }

  const report = cache.getReport(user_id);
  const countSeries = cache.toTimeSeries(report, 'count');
  const newGrammarSeries = cache.toTimeSeries(report, 'newGrammar');
  const ratioSeries = cache.toTimeSeries(report, 'ratio');
  const uniqueCountSeries = cache.toTimeSeries(report, 'uniqueCount');

  const countBehavior = categorizeBehavior(countSeries);
  const newGrammarBehavior = categorizeBehavior(newGrammarSeries);
  const ratioBehavior = categorizeBehavior(ratioSeries);
  const uniqueCountBehavior = categorizeBehavior(uniqueCountSeries);

  console.log('count', getBehaviorCounts(countBehavior));
  console.log('newGrammar', getBehaviorCounts(newGrammarBehavior));
  console.log('ratio', getBehaviorCounts(ratioBehavior));
  console.log('uniqueCount', getBehaviorCounts(uniqueCountBehavior));
});

function getBehaviorCounts(behaviors: TimeSeriesBehavior[]) {
  const result = {
    increasing: 0,
    decreasing: 0,
    fluctuating: 0,
    flat: 0,
    accelerating: 0,
    decelerating: 0,
    turning_point: [],
    volatilie: 0,
  };

  for (const behavior of behaviors) {
    if (behavior.increasing) {
      result.increasing += 1;
    }

    if (behavior.decreasing) {
      result.decreasing += 1;
    }

    if (behavior.fluctuating) {
      result.fluctuating += 1;
    }

    if (behavior.flat) {
      result.flat += 1;
    }

    if (behavior.accelerating) {
      result.accelerating += 1;
    }

    if (behavior.decelerating) {
      result.decelerating += 1;
    }

    if (behavior.turning_point !== null) {
      result.turning_point.push(behavior.turning_point);
    }

    if (behavior.volatilie) {
      result.volatilie += 1;
    }
  }

  return result;
}

import type { TimeSeriesDataPoint } from './behavior';
import { getDb, run, query, reset } from './sqlite';
import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';
import { rmSync } from 'fs-extra';

const singleQuotes = /'/g;
const newLines = /[\n\r]/g;
const msInHour = 1000 * 60 * 60;
const moneyRegex = /\$/g;

// Instantiate winkNLP.
const nlp = winkNLP(model);

interface Word {
  id: number;
  word: string;
}

interface insertResult {
  lastInsertRowid: number;
}

interface WordCacheEntries {
  [key: string]: WordCacheEntry;
}

interface WordCacheEntry {
  id: number;
  amount: number;
}

interface UsageEntry {
  hour: number;
  word_id: number;
  timestamp: number;
}

interface User {
  id: number;
  username: string;
}

interface UniqueWords {
  hour: number;
  uniqueCount: number;
  count: number;
  ratio: number;
  // uniqueMovingAverage: number
  // movingAverage: number
  // uniqueDistance: number
  // countDistance: number
}

interface Report {
  hour: number;
  count: number;
  uniqueCount: number;
  ratio: number;
  newGrammar: number;
}

const queries = {
  createWords: [
    `CREATE TABLE IF NOT EXISTS words (
     id INTEGER PRIMARY KEY,
     word TEXT UNIQUE
  );`,
  ],
  createWordHistory: [
    `CREATE TABLE IF NOT EXISTS word_history (
       id INTEGER PRIMARY KEY,
       account_id INTEGER NOT NULL,
       word_id INTEGER NOT NULL,
       timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (word_id) REFERENCES words(id)
    );`,
    `CREATE INDEX IF NOT EXISTS account_idx ON word_history (account_id);`,
    `CREATE INDEX IF NOT EXISTS word_idx ON word_history (word_id);`,
  ],
  createAccounts: [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_username ON users (username COLLATE NOCASE);`,
  ],
  insertNewWords: `INSERT OR IGNORE INTO words (word) VALUES $$;`,
  insertNewWordHistory: `INSERT INTO word_history (account_id, word_id, timestamp) VALUES (:account_id, :word_id, DATETIME(:timestamp));`,
  insertUser: `INSERT INTO users (username) VALUES (:username);`,
  getNewWords: `SELECT id, word FROM words WHERE word IN $$;`,
  getUser: `SELECT id, username FROM users WHERE username = :username LIMIT 1;`,
  getUniqueWords: `SELECT 
      CAST(strftime('%s', strftime('%Y-%m-%d %H:00:00', timestamp)) AS INT) * 1000 AS hour, 
      COUNT(DISTINCT word_id) AS uniqueCount,
      COUNT(word_id) AS count,
      COUNT(DISTINCT word_id) / COUNT(word_id) AS ratio
    FROM word_history
    WHERE account_id = :account_id
    GROUP BY hour
    ORDER BY hour ASC;`,
  getWordHistory: `SELECT 
      CAST(strftime('%s', strftime('%Y-%m-%d %H:00:00', timestamp)) AS INT) * 1000 AS hour, 
      word_id
    FROM word_history
    WHERE account_id = :account_id
    ORDER BY hour ASC;`,
  getWords: `SELECT id, word FROM words;`,
};

export default class WordCache {
  path: string;
  connection: ReturnType<typeof getDb>;
  cache: {
    [key: string]: number;
  } = {};

  /**
   *
   */
  constructor(
    path: string = __dirname + '/../../../assets/wordCache.db',
    autoConnect = true
  ) {
    this.path = path;
    if (autoConnect) {
      this.connect(path);
    }
  }

  /**
   *
   * @param path
   */
  connect(path: string = this.path) {
    this.connection = getDb(path);
    queries.createWords.forEach((query) => this.connection.exec(query));
    queries.createWordHistory.forEach((query) => this.connection.exec(query));
    queries.createAccounts.forEach((query) => this.connection.exec(query));
    this.populate();
    return this;
  }
  /**
   *
   */
  getUserId(username: string | number) {
    if (typeof username === 'number') {
      return username;
    }

    const user = query<User>(this.connection, queries.getUser, {
      username,
    });

    if (user.length > 0) {
      return user[0].id;
    } else {
      const result = run(this.connection, queries.insertUser, {
        username,
      }) as unknown as insertResult;

      return result.lastInsertRowid;
    }
  }

  /**
   *
   * @returns
   */
  getReport(account_id: number): Report[] {
    const timeline = query<UniqueWords>(
      this.connection,
      queries.getUniqueWords,
      {
        account_id,
      }
    );

    if (timeline.length === 0) {
      return [];
    }

    const wordHistory = query<UsageEntry>(
      this.connection,
      queries.getWordHistory,
      {
        account_id,
      }
    );

    let time = timeline[0].hour;
    const max = timeline[timeline.length - 1].hour + 1;
    const times: number[] = [];
    const uniqueCounts: number[] = [];
    const counts: number[] = [];

    for (; time < max; time += msInHour) {
      times.push(time);
      const event = timeline.find((event) => event.hour === time);

      if (event === undefined) {
        uniqueCounts.push(0);
        counts.push(0);
      } else {
        uniqueCounts.push(event.uniqueCount);
        counts.push(event.count);
      }
    }

    const knownWords: number[] = [];
    const result: Report[] = times.map((time, i) => {
      let newGrammar = 0;
      wordHistory
        .filter((word) => word.hour === time)
        .forEach((word) => {
          if (knownWords.indexOf(word.word_id) === -1) {
            newGrammar += 1;
            knownWords.push(word.word_id);
          }
        });

      return {
        hour: time,
        count: counts[i],
        uniqueCount: uniqueCounts[i],
        ratio: counts[i] === 0 ? 0 : uniqueCounts[i] / counts[i],
        newGrammar,
      };
    });

    return result;
  }

  /**
   *
   */
  reset() {
    if (this.connection) {
      this.connection.close();
    }

    reset(this.path);
    rmSync(this.path);
    return this;
  }

  /**
   *
   */
  addUsages(
    wordEntries: WordCacheEntries,
    username: string | number,
    timestamp: string | Date
  ) {
    const user_id = this.getUserId(username);
    const timeValue =
      timestamp instanceof Date
        ? timestamp.toISOString().slice(0, -5)
        : timestamp;

    for (const word of Object.keys(wordEntries)) {
      const entry = wordEntries[word];
      for (let i = 0; i < entry.amount; i++) {
        this.addUsage(entry.id, user_id, timeValue);
      }
    }

    return user_id;
  }

  /**
   *
   */
  addUsage(word_id: number, account_id: number, timestamp: string | Date) {
    run(this.connection, queries.insertNewWordHistory, {
      word_id,
      account_id,
      timestamp,
    });

    return this;
  }

  /**
   *
   */
  fetch(sentence: string) {
    const tokens = this.tokenize(sentence);
    const newWords = [];
    const results: {
      [key: string]: WordCacheEntry;
    } = {};

    for (const token of tokens) {
      if (this.cache[token] === undefined) {
        // Word is not cached
        newWords.push(token);
      } else {
        // Use cache
        if (results[token] === undefined) {
          // Result doesn't exist
          results[token] = {
            id: this.cache[token],
            amount: 0,
          };
        }

        results[token].amount += 1;
      }
    }

    // Go get new words
    const newRecords = this.getsert(newWords);

    for (const record of newRecords) {
      this.cache[record.word] = record.id;

      if (results[record.word] === undefined) {
        results[record.word] = {
          id: this.cache[record.word],
          amount: 0,
        };
      }

      results[record.word].amount += 1;
    }

    return results;
  }

  /**
   *
   */
  private tokenize(sentence: string): string[] {
    const doc = nlp.readDoc(
      sentence.toLowerCase().replace(singleQuotes, '').replace(newLines, ' ')
    );
    return doc.tokens().out();
  }

  /**
   *
   */
  private populate() {
    const rows = query<Word>(this.connection, queries.getWords);

    for (const row of rows) {
      this.cache[row.word] = row.id;
    }

    return this;
  }

  /**
   *
   */
  private getsert(sentence: string | string[]) {
    const tokens =
      sentence instanceof Array ? sentence : this.tokenize(sentence);

    if (tokens.length === 0) {
      return [];
    }

    const words = `('${tokens.join(`'), ('`)}')`.replace(moneyRegex, `S`);
    run(this.connection, queries.insertNewWords.replace('$$', words));

    const wordList = `('${tokens.join(`', '`)}')`.replace(moneyRegex, `S`);
    const rows = query<Word>(
      this.connection,
      queries.getNewWords.replace('$$', wordList),
      {}
    );

    return rows;
  }

  /**
   *
   */
  toTimeSeries(reports: Report[], value: keyof Report): TimeSeriesDataPoint[] {
    const result: TimeSeriesDataPoint[] = [];

    for (const report of reports) {
      let amount: number = report[value];

      result.push({
        date: report.hour.toString(),
        value: amount,
      });
    }

    return result;
  }
}

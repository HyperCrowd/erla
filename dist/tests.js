var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));

// tests/index.ts
var import_uvu2 = require("uvu");

// tests/wordCacheTest.ts
var import_uvu = require("uvu");

// src/sqlite.ts
var import_sqlite3 = __toESM(require("sqlite3"));
var import_fs_extra = require("fs-extra");
var cache = {};
var getDb = (path) => {
  if (cache[path] === void 0) {
    (0, import_fs_extra.ensureFileSync)(path);
    cache[path] = new import_sqlite3.default.Database(path);
    cache[path].exec("PRAGMA journal_mode = OFF;");
    cache[path].exec("PRAGMA synchronous = 0;");
    cache[path].exec("PRAGMA cache_size = 1000000;");
    cache[path].exec("PRAGMA locking_mode = EXCLUSIVE");
    cache[path].exec("PRAGMA temp_store = MEMORY;");
  }
  return cache[path];
};
var reset = (path) => {
  cache[path] = void 0;
};
var run = (db, query2, parameters = void 0) => {
  return new Promise((resolve) => {
    const statement = db.prepare(query2);
    if (parameters === void 0) {
      return statement.run();
    } else {
      return statement.bind(parameters).run(resolve);
    }
  });
};
var query = (db, query2, parameters = {}) => {
  return new Promise((resolve) => {
    const statement = db.prepare(query2);
    statement.bind(parameters).all((err, rows) => {
      console.log("what");
      console.log(err);
      console.log(rows);
      resolve(rows);
    });
  });
};

// src/wordCache.ts
var import_wink_nlp = __toESM(require("wink-nlp"));
var import_wink_eng_lite_web_model = __toESM(require("wink-eng-lite-web-model"));
var import_fs_extra2 = require("fs-extra");
var singleQuotes = /'/g;
var newLines = /[\n\r]/g;
var msInHour = 1e3 * 60 * 60;
var nlp = (0, import_wink_nlp.default)(import_wink_eng_lite_web_model.default);
var queries = {
  createWords: [
    `CREATE TABLE IF NOT EXISTS words (
     id INTEGER PRIMARY KEY,
     word TEXT UNIQUE
  );`
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
    `CREATE INDEX IF NOT EXISTS word_idx ON word_history (word_id);`
  ],
  createAccounts: [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_username ON users (username COLLATE NOCASE);`
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
  getWords: `SELECT id, word FROM words;`
};
var WordCache = class {
  constructor(path = __dirname + "/../dist/wordCache.db") {
    this.cache = {};
    this.path = path;
  }
  async connect(path = this.path) {
    this.connection = getDb(path);
    queries.createWords.forEach((query2) => this.connection.exec(query2));
    queries.createWordHistory.forEach((query2) => this.connection.exec(query2));
    queries.createAccounts.forEach((query2) => this.connection.exec(query2));
    await this.populate();
    return this;
  }
  async getUserId(username) {
    if (typeof username === "number") {
      return username;
    }
    const user = await query(this.connection, queries.getUser, {
      username
    });
    if (user.length > 0) {
      return user[0].id;
    } else {
      const result = run(this.connection, queries.insertUser, {
        username
      });
      return result.lastInsertRowid;
    }
  }
  async getReport(account_id) {
    const timeline = await query(this.connection, queries.getUniqueWords, {
      account_id
    });
    if (timeline.length === 0) {
      return timeline;
    }
    const wordHistory = await query(this.connection, queries.getWordHistory, {
      account_id
    });
    let time = timeline[0].hour;
    const max = timeline[timeline.length - 1].hour + 1;
    const times = [];
    const uniqueCounts = [];
    const counts = [];
    for (; time < max; time += msInHour) {
      times.push(time);
      const event = timeline.find((event2) => event2.hour === time);
      if (event === void 0) {
        uniqueCounts.push(0);
        counts.push(0);
      } else {
        uniqueCounts.push(event.uniqueCount);
        counts.push(event.count);
      }
    }
    const knownWords = [];
    const result = times.map((time2, i) => {
      let newGrammar = 0;
      wordHistory.filter((word) => word.hour === time2).forEach((word) => {
        if (knownWords.indexOf(word.word_id) === -1) {
          newGrammar += 1;
          knownWords.push(word.word_id);
        }
      });
      return {
        hour: time2,
        count: counts[i],
        uniqueCount: uniqueCounts[i],
        ratio: counts[i] === 0 ? 0 : uniqueCounts[i] / counts[i],
        newGrammar
      };
    });
    return result;
  }
  reset() {
    if (this.connection) {
      this.connection.close();
    }
    reset(this.path);
    (0, import_fs_extra2.rmSync)(this.path);
    return this;
  }
  async addUsages(wordEntries, username, timestamp) {
    const user_id = await this.getUserId(username);
    const timeValue = timestamp instanceof Date ? timestamp.toISOString().slice(0, -5) : timestamp;
    for (const word of Object.keys(wordEntries)) {
      const entry = wordEntries[word];
      for (let i = 0; i < entry.amount; i++) {
        this.addUsage(entry.id, user_id, timeValue);
      }
    }
    return user_id;
  }
  async addUsage(word_id, account_id, timestamp) {
    await run(this.connection, queries.insertNewWordHistory, {
      word_id,
      account_id,
      timestamp
    });
    return this;
  }
  async fetch(sentence) {
    const tokens = this.tokenize(sentence);
    const newWords = [];
    const results = {};
    for (const token of tokens) {
      if (this.cache[token] === void 0) {
        newWords.push(token);
      } else {
        if (results[token] === void 0) {
          results[token] = {
            id: this.cache[token],
            amount: 0
          };
        }
        results[token].amount += 1;
      }
    }
    const newRecords = await this.getsert(newWords);
    for (const record of newRecords) {
      this.cache[record.word] = record.id;
      if (results[record.word] === void 0) {
        results[record.word] = {
          id: this.cache[record.word],
          amount: 0
        };
      }
      results[record.word].amount += 1;
    }
    return results;
  }
  tokenize(sentence) {
    const doc = nlp.readDoc(sentence.toLowerCase().replace(singleQuotes, "").replace(newLines, " "));
    return doc.tokens().out();
  }
  async populate() {
    const rows = await query(this.connection, queries.getWords);
    console.log(rows);
    for (const row of rows) {
      this.cache[row.word] = row.id;
    }
    return this;
  }
  async getsert(sentence) {
    const tokens = sentence instanceof Array ? sentence : this.tokenize(sentence);
    if (tokens.length === 0) {
      return [];
    }
    const words = `('${tokens.join(`'), ('`)}')`;
    await run(this.connection, queries.insertNewWords.replace("$$", words));
    const wordList = `('${tokens.join(`', '`)}')`;
    const rows = query(this.connection, queries.getNewWords.replace("$$", wordList), {});
    return rows;
  }
};

// tests/wordCacheTest.ts
(0, import_uvu.test)("WordCache: Basic", async () => {
  console.log();
  const cache2 = new WordCache(`${process.cwd()}/tests/test.db`).reset();
  await cache2.connect();
  const usages = await cache2.fetch(`Bro, we can't even do this like that lol, do don't and get wrecked :D https://www.test.com`);
  const user_id = await cache2.addUsages(usages, "test", new Date());
  const future = new Date(Date.now() + 1e3 * 60 * 60 * 5);
  const nextUsage = await cache2.fetch(`Bro, we did do it holy cow`);
  await cache2.addUsages(nextUsage, user_id, future);
  const report = await cache2.getReport(user_id);
  console.log(report);
});

// tests/index.ts
import_uvu2.test.run();
//# sourceMappingURL=tests.js.map
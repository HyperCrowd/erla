import*as N from"csv-stream";import{open as D}from"node:fs/promises";import*as I from"post-entity";import A from"better-sqlite3";import{ensureFileSync as C}from"fs-extra";var u={},p=n=>(u[n]===void 0&&(C(n),u[n]=new A(n),u[n].exec("PRAGMA journal_mode = OFF;"),u[n].exec("PRAGMA synchronous = 0;"),u[n].exec("PRAGMA cache_size = 1000000;"),u[n].exec("PRAGMA locking_mode = EXCLUSIVE"),u[n].exec("PRAGMA temp_store = MEMORY;")),u[n]),R=n=>{u[n]=void 0},T=(n,t,e=void 0)=>{let s=n.prepare(t);return e===void 0?s.run():s.bind(e).run()},h=(n,t,e={})=>n.prepare(t).bind(e).all();import O from"wink-nlp";import y from"wink-eng-lite-web-model";import{rmSync as b}from"fs-extra";var _=/'/g,U=/[\n\r]/g,W=1e3*60*60,L=O(y),c={createWords:[`CREATE TABLE IF NOT EXISTS words (
     id INTEGER PRIMARY KEY,
     word TEXT UNIQUE
  );`],createWordHistory:[`CREATE TABLE IF NOT EXISTS word_history (
       id INTEGER PRIMARY KEY,
       account_id INTEGER NOT NULL,
       word_id INTEGER NOT NULL,
       timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (word_id) REFERENCES words(id)
    );`,"CREATE INDEX IF NOT EXISTS account_idx ON word_history (account_id);","CREATE INDEX IF NOT EXISTS word_idx ON word_history (word_id);"],createAccounts:[`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL
    );`,"CREATE INDEX IF NOT EXISTS idx_username ON users (username COLLATE NOCASE);"],insertNewWords:"INSERT OR IGNORE INTO words (word) VALUES $$;",insertNewWordHistory:"INSERT INTO word_history (account_id, word_id, timestamp) VALUES (:account_id, :word_id, DATETIME(:timestamp));",insertUser:"INSERT INTO users (username) VALUES (:username);",getNewWords:"SELECT id, word FROM words WHERE word IN $$;",getUser:"SELECT id, username FROM users WHERE username = :username LIMIT 1;",getUniqueWords:`SELECT 
      CAST(strftime('%s', strftime('%Y-%m-%d %H:00:00', timestamp)) AS INT) * 1000 AS hour, 
      COUNT(DISTINCT word_id) AS uniqueCount,
      COUNT(word_id) AS count,
      COUNT(DISTINCT word_id) / COUNT(word_id) AS ratio
    FROM word_history
    WHERE account_id = :account_id
    GROUP BY hour
    ORDER BY hour ASC;`,getWordHistory:`SELECT 
      CAST(strftime('%s', strftime('%Y-%m-%d %H:00:00', timestamp)) AS INT) * 1000 AS hour, 
      word_id
    FROM word_history
    WHERE account_id = :account_id
    ORDER BY hour ASC;`,getWords:"SELECT id, word FROM words;"},f=class{constructor(t=__dirname+"/../../../assets/wordCache.db",e=!0){this.cache={};this.path=t,e&&this.connect(t)}connect(t=this.path){return this.connection=p(t),c.createWords.forEach(e=>this.connection.exec(e)),c.createWordHistory.forEach(e=>this.connection.exec(e)),c.createAccounts.forEach(e=>this.connection.exec(e)),this.populate(),this}getUserId(t){if(typeof t=="number")return t;let e=h(this.connection,c.getUser,{username:t});return e.length>0?e[0].id:T(this.connection,c.insertUser,{username:t}).lastInsertRowid}getReport(t){let e=h(this.connection,c.getUniqueWords,{account_id:t});if(e.length===0)return e;let s=h(this.connection,c.getWordHistory,{account_id:t}),r=e[0].hour,a=e[e.length-1].hour+1,o=[],i=[],d=[];for(;r<a;r+=W){o.push(r);let E=e.find(m=>m.hour===r);E===void 0?(i.push(0),d.push(0)):(i.push(E.uniqueCount),d.push(E.count))}let g=[];return o.map((E,m)=>{let l=0;return s.filter(w=>w.hour===E).forEach(w=>{g.indexOf(w.word_id)===-1&&(l+=1,g.push(w.word_id))}),{hour:E,count:d[m],uniqueCount:i[m],ratio:d[m]===0?0:i[m]/d[m],newGrammar:l}})}reset(){return this.connection&&this.connection.close(),R(this.path),b(this.path),this}addUsages(t,e,s){let r=this.getUserId(e),a=s instanceof Date?s.toISOString().slice(0,-5):s;for(let o of Object.keys(t)){let i=t[o];for(let d=0;d<i.amount;d++)this.addUsage(i.id,r,a)}return r}addUsage(t,e,s){return T(this.connection,c.insertNewWordHistory,{word_id:t,account_id:e,timestamp:s}),this}fetch(t){let e=this.tokenize(t),s=[],r={};for(let o of e)this.cache[o]===void 0?s.push(o):(r[o]===void 0&&(r[o]={id:this.cache[o],amount:0}),r[o].amount+=1);let a=this.getsert(s);for(let o of a)this.cache[o.word]=o.id,r[o.word]===void 0&&(r[o.word]={id:this.cache[o.word],amount:0}),r[o.word].amount+=1;return r}tokenize(t){return L.readDoc(t.toLowerCase().replace(_,"").replace(U," ")).tokens().out()}populate(){let t=h(this.connection,c.getWords);for(let e of t)this.cache[e.word]=e.id;return this}getsert(t){let e=t instanceof Array?t:this.tokenize(t);if(e.length===0)return[];let s=`('${e.join("'), ('")}')`;T(this.connection,c.insertNewWords.replace("$$",s));let r=`('${e.join("', '")}')`;return h(this.connection,c.getNewWords.replace("$$",r),{})}};var S=process.argv[2]||"";if(S==="")throw new RangeError;var M={delimiter:"	",endLine:`
`,columnOffset:0,escapeChar:'"',enclosedChar:'"'},x=N.createStream(M);async function q(){let n=new f(`${process.cwd()}/tests/test.db`,!1).reset().connect(),t;(await D(S,"r")).createReadStream().pipe(x).on("data",function(r){if(r.retweet!=="False"||r.language!=="en")return;let a=r.tweet.toLowerCase(),o=I.process(a).filter(i=>i.type==="text").map(i=>i.raw.trim());for(let i of o){let d=n.fetch(i);t=n.addUsages(d,r.username,new Date(r.created_at))}}).on("close",function(){let r=n.getReport(t);console.log(r)})}q();
//# sourceMappingURL=index.js.map
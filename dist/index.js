var L=Object.create;var R=Object.defineProperty;var D=Object.getOwnPropertyDescriptor;var M=Object.getOwnPropertyNames;var x=Object.getPrototypeOf,q=Object.prototype.hasOwnProperty;var F=(r,e,t,o)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of M(e))!q.call(r,n)&&n!==t&&R(r,n,{get:()=>e[n],enumerable:!(o=D(e,n))||o.enumerable});return r};var f=(r,e,t)=>(t=r!=null?L(x(r)):{},F(e||!r||!r.__esModule?R(t,"default",{value:r,enumerable:!0}):t,r));var b=f(require("csv-stream")),_=require("fs/promises"),U=f(require("post-entity"));var N=f(require("better-sqlite3")),S=require("fs-extra"),u={},I=r=>(u[r]===void 0&&((0,S.ensureFileSync)(r),u[r]=new N.default(r),u[r].exec("PRAGMA journal_mode = OFF;"),u[r].exec("PRAGMA synchronous = 0;"),u[r].exec("PRAGMA cache_size = 1000000;"),u[r].exec("PRAGMA locking_mode = EXCLUSIVE"),u[r].exec("PRAGMA temp_store = MEMORY;")),u[r]),A=r=>{u[r]=void 0},l=(r,e,t=void 0)=>{let o=r.prepare(e);return t===void 0?o.run():o.bind(t).run()},h=(r,e,t={})=>r.prepare(e).bind(t).all();var C=f(require("wink-nlp")),O=f(require("wink-eng-lite-web-model")),y=require("fs-extra"),k=/'/g,G=/[\n\r]/g,H=1e3*60*60,Y=(0,C.default)(O.default),c={createWords:[`CREATE TABLE IF NOT EXISTS words (
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
    ORDER BY hour ASC;`,getWords:"SELECT id, word FROM words;"},w=class{constructor(e=__dirname+"/../../../assets/wordCache.db",t=!0){this.cache={};this.path=e,t&&this.connect(e)}connect(e=this.path){return this.connection=I(e),c.createWords.forEach(t=>this.connection.exec(t)),c.createWordHistory.forEach(t=>this.connection.exec(t)),c.createAccounts.forEach(t=>this.connection.exec(t)),this.populate(),this}getUserId(e){if(typeof e=="number")return e;let t=h(this.connection,c.getUser,{username:e});return t.length>0?t[0].id:l(this.connection,c.insertUser,{username:e}).lastInsertRowid}getReport(e){let t=h(this.connection,c.getUniqueWords,{account_id:e});if(t.length===0)return t;let o=h(this.connection,c.getWordHistory,{account_id:e}),n=t[0].hour,a=t[t.length-1].hour+1,s=[],i=[],d=[];for(;n<a;n+=H){s.push(n);let E=t.find(m=>m.hour===n);E===void 0?(i.push(0),d.push(0)):(i.push(E.uniqueCount),d.push(E.count))}let g=[];return s.map((E,m)=>{let p=0;return o.filter(T=>T.hour===E).forEach(T=>{g.indexOf(T.word_id)===-1&&(p+=1,g.push(T.word_id))}),{hour:E,count:d[m],uniqueCount:i[m],ratio:d[m]===0?0:i[m]/d[m],newGrammar:p}})}reset(){return this.connection&&this.connection.close(),A(this.path),(0,y.rmSync)(this.path),this}addUsages(e,t,o){let n=this.getUserId(t),a=o instanceof Date?o.toISOString().slice(0,-5):o;for(let s of Object.keys(e)){let i=e[s];for(let d=0;d<i.amount;d++)this.addUsage(i.id,n,a)}return n}addUsage(e,t,o){return l(this.connection,c.insertNewWordHistory,{word_id:e,account_id:t,timestamp:o}),this}fetch(e){let t=this.tokenize(e),o=[],n={};for(let s of t)this.cache[s]===void 0?o.push(s):(n[s]===void 0&&(n[s]={id:this.cache[s],amount:0}),n[s].amount+=1);let a=this.getsert(o);for(let s of a)this.cache[s.word]=s.id,n[s.word]===void 0&&(n[s.word]={id:this.cache[s.word],amount:0}),n[s.word].amount+=1;return n}tokenize(e){return Y.readDoc(e.toLowerCase().replace(k,"").replace(G," ")).tokens().out()}populate(){let e=h(this.connection,c.getWords);for(let t of e)this.cache[t.word]=t.id;return this}getsert(e){let t=e instanceof Array?e:this.tokenize(e);if(t.length===0)return[];let o=`('${t.join("'), ('")}')`.replace("$","S");l(this.connection,c.insertNewWords.replace("$$",o));let n=`('${t.join("', '")}')`.replace("$","S");return h(this.connection,c.getNewWords.replace("$$",n),{})}};var W=process.argv[2]||"";if(W==="")throw new RangeError;var $={delimiter:"	",endLine:`
`,columnOffset:0,escapeChar:'"',enclosedChar:'"'},X=b.createStream($);async function P(){let r=new w(`${process.cwd()}/tests/test.db`,!1).reset().connect(),e;(await(0,_.open)(W,"r")).createReadStream().pipe(X).on("data",function(n){if(n.retweet!=="False"||n.language!=="en")return;let a=n.tweet.toLowerCase(),s=U.process(a).filter(i=>i.type==="text").map(i=>i.raw.trim());for(let i of s){let d=r.fetch(i);e=r.addUsages(d,n.username,new Date(n.created_at))}}).on("close",function(){let n=r.getReport(e);console.log(n)})}P();
//# sourceMappingURL=index.js.map
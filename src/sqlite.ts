import SqliteDatabaseConnection from 'better-sqlite3';
import { ensureFileSync } from 'fs-extra';

/**
 * A cache of all connections
 */
const cache: {
  [key: string]: SqliteDatabaseConnection;
} = {};

/**
 * Get a sqlite database connection
 */
export const getDb = (path: string) => {
  if (cache[path] === undefined) {
    ensureFileSync(path);
    cache[path] = new SqliteDatabaseConnection(path);
    cache[path].exec('PRAGMA journal_mode = OFF;');
    cache[path].exec('PRAGMA synchronous = 0;');
    cache[path].exec('PRAGMA cache_size = 1000000;');
    cache[path].exec('PRAGMA locking_mode = EXCLUSIVE');
    cache[path].exec('PRAGMA temp_store = MEMORY;');
  }

  return cache[path];
};

/**
 *
 * @param path
 */
export const reset = (path: string) => {
  cache[path] = undefined;
};

/**
 * run
 */
export const run = <T = Object>(
  db: SqliteDatabaseConnection,
  query: string,
  parameters: Object | undefined = undefined
): T[] => {
  const statement = db.prepare(query);
  if (parameters === undefined) {
    return statement.run();
  } else {
    return statement.bind(parameters).run();
  }
};

/**
 * query
 * @param query sql
 * @param parameters Object
 * @param db SqliteDatabaseConnection
 * @return Object[]
 */
export const query = <T = Object>(
  db: SqliteDatabaseConnection,
  query: string,
  parameters: Object = {}
): T[] => {
  const statement = db.prepare(query);
  return statement.bind(parameters).all();
};

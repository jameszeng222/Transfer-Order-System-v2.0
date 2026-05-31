import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../data/transfer.db');
const config = {
    client: 'better-sqlite3',
    connection: {
        filename: dbPath,
    },
    useNullAsDefault: true,
    pool: {
        afterCreate: (conn, done) => {
            conn.pragma('journal_mode = WAL');
            conn.pragma('foreign_keys = ON');
            done(null, conn);
        },
    },
    migrations: {
        directory: './migrations',
        extension: 'ts',
    },
    seeds: {
        directory: './seeds',
        extension: 'ts',
    },
};
export default config;
//# sourceMappingURL=knexfile.js.map
import { neon } from '@netlify/neon';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from './schema';

export const sql = neon();
export const db = drizzle({
    schema,
    client: sql
});
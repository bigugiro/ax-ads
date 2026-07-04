// Runner de migrations idempotente contra o Postgres do Supabase (via DATABASE_URL).
// Uso: `npm run db:migrate`  (requer DATABASE_URL no .env)
// Executa os arquivos supabase/migrations/*.sql em ordem, registrando os aplicados
// em public.schema_migrations. Cada arquivo roda dentro de uma transação.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from 'dotenv';
import pg from 'pg';

// .env.local (segredos reais) tem prioridade; .env é fallback.
config({ path: ['.env.local', '.env'] });

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('✗ DATABASE_URL ausente. Copie .env.example para .env e preencha.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  // Supabase exige SSL; não validamos CA aqui (conexão de migração administrativa).
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  await client.query(`
    create table if not exists public.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const applied = new Set(
    (await client.query('select version from public.schema_migrations')).rows.map((r) => r.version),
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`• ${file} (já aplicada)`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into public.schema_migrations (version) values ($1)', [file]);
      await client.query('commit');
      console.log(`✓ ${file}`);
      count++;
    } catch (err) {
      await client.query('rollback');
      console.error(`✗ ${file} falhou:`, err.message);
      throw err;
    }
  }
  console.log(
    count === 0 ? 'Nada a aplicar — banco atualizado.' : `${count} migration(s) aplicada(s).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => client.end());

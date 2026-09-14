import { readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

let pool: Pool | undefined;

// O RDS usa rds.force_ssl=1 (padrao no Postgres 15) e recusa conexao sem TLS
// com "no pg_hba.conf entry ... no encryption". O driver JDBC da oficina-app-api
// nao sofre disso porque usa sslmode=prefer; o pg nao tenta TLS por padrao.
// A CA oficial da AWS vai no zip (ver workflow de deploy) para validar o
// certificado do servidor, em vez de so aceitar qualquer um.
function configurarSsl() {
  return { ca: readFileSync(join(__dirname, "..", "rds-ca.pem"), "utf8") };
}

function obterPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.PGHOST,
      port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: configurarSsl(),
      max: 1,
    });
  }
  return pool;
}

export interface StatusCliente {
  encontrado: boolean;
  ativo: boolean;
}

// Mesma tabela do oficina-app-api (ClienteJpaEntity): "ativo" é soft delete, não exclusão.
export async function buscarStatusClientePorDocumento(documento: string): Promise<StatusCliente> {
  const conexao = obterPool();
  const resultado = await conexao.query<{ ativo: boolean }>(
    "SELECT ativo FROM clientes WHERE documento = $1",
    [documento]
  );

  if (resultado.rowCount === 0) {
    return { encontrado: false, ativo: false };
  }

  return { encontrado: true, ativo: resultado.rows[0].ativo };
}

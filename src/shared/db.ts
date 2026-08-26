import { Pool } from "pg";

let pool: Pool | undefined;

function obterPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.PGHOST,
      port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      max: 1,
    });
  }
  return pool;
}

export interface StatusCliente {
  encontrado: boolean;
  ativo: boolean;
}

/**
 * Consulta a mesma tabela usada por oficina-app-api (ClienteJpaEntity):
 * "clientes", coluna "documento" (CPF/CNPJ sem máscara) e "ativo" (soft delete).
 */
export async function buscarStatusClientePorDocumento(documento: string): Promise<StatusCliente> {
  const resultado = await obterPool().query<{ ativo: boolean }>(
    "SELECT ativo FROM clientes WHERE documento = $1",
    [documento]
  );

  if (resultado.rowCount === 0) {
    return { encontrado: false, ativo: false };
  }

  return { encontrado: true, ativo: resultado.rows[0].ativo };
}

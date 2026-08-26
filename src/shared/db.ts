import { Pool } from "pg";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

interface CredenciaisRds {
  username: string;
  password: string;
}

let pool: Pool | undefined;
let credenciaisCache: CredenciaisRds | undefined;

/**
 * O RDS usa "manage_master_user_password" (oficina-infra-database): a senha
 * nao e um valor fixo nosso, e gerada e guardada pela propria AWS no Secrets
 * Manager. Buscamos aqui e mantemos em cache (a instancia da Lambda pode ser
 * reaproveitada entre invocacoes - warm start).
 */
async function obterCredenciais(): Promise<CredenciaisRds> {
  if (credenciaisCache) return credenciaisCache;

  const secretArn = process.env.RDS_SECRET_ARN;
  if (!secretArn) {
    throw new Error("RDS_SECRET_ARN não configurado");
  }

  const client = new SecretsManagerClient({});
  const resultado = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const segredo = JSON.parse(resultado.SecretString ?? "{}");

  credenciaisCache = { username: segredo.username, password: segredo.password };
  return credenciaisCache;
}

async function obterPool(): Promise<Pool> {
  if (!pool) {
    const credenciais = await obterCredenciais();
    pool = new Pool({
      host: process.env.PGHOST,
      port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
      database: process.env.PGDATABASE,
      user: credenciais.username,
      password: credenciais.password,
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
  const conexao = await obterPool();
  const resultado = await conexao.query<{ ativo: boolean }>(
    "SELECT ativo FROM clientes WHERE documento = $1",
    [documento]
  );

  if (resultado.rowCount === 0) {
    return { encontrado: false, ativo: false };
  }

  return { encontrado: true, ativo: resultado.rows[0].ativo };
}

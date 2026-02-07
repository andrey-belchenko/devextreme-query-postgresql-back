import { ExprProviderOracle11g } from "./expr-provider-oracle11g";
import { ExprProviderPg } from "./expr-provider-pg";
import { LoadOptionsParser } from "./load-options-parser";
import { ExecResult, StatementsExecutor } from "./statement-executor";

type PgQueryMethod = (
  queryText: string,
  values?: any[]
) => Promise<PgQueryResult>;

interface PgQueryResult {
  rows: any;
}

interface PgClient {
  query: PgQueryMethod;
}

export async function queryPg(
  pgClient: PgClient,
  loadOptions: any,
  sourceQueryText: string,
  sourceQueryParamValues?: any[]
): Promise<ExecResult> {
  const exprProvider = new ExprProviderPg();
  const parser = new LoadOptionsParser({
    exprProvider: exprProvider,
  });
  const statements = parser.parse(loadOptions);
  const executor = new StatementsExecutor({
    handler: async (statement) => {
      const query = statement.buildQuery({
        sourceQuery: {
          queryText: sourceQueryText,
          paramValues: sourceQueryParamValues,
        },
        exprProvider: exprProvider,
      });
      const { rows } = await pgClient.query(query.queryText, query.paramValues);
      return rows;
    },
  });
  const result = await executor.execute(statements);
  return result;
}

export async function queryOracle(
  oracleConnection: any,
  loadOptions: any,
  sourceQueryText: string,
  sourceQueryParamValues?: any[]
): Promise<ExecResult> {
  const exprProvider = new ExprProviderOracle11g();
  const parser = new LoadOptionsParser({
    exprProvider: exprProvider,
  });
  const statements = parser.parse(loadOptions);
  const executor = new StatementsExecutor({
    handler: async (statement) => {
      const query = statement.buildQuery({
        sourceQuery: {
          queryText: sourceQueryText,
          paramValues: sourceQueryParamValues,
        },
        exprProvider: exprProvider,
      });
      const result = await oracleConnection.execute(
        query.queryText,
        query.paramValues || [],
        {
          outFormat: 4002, //oracledb.OUT_FORMAT_OBJECT
        }
      );
      // Convert Oracle uppercase column names to lowercase to match PostgreSQL behavior
      return result.rows.map((row: any) => {
        const lowerCaseRow: any = {};
        for (const key in row) {
          lowerCaseRow[key.toLowerCase()] = row[key];
        }
        return lowerCaseRow;
      });
    },
  });
  const result = await executor.execute(statements);
  return result;
}

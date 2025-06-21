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

export async function query(
  pgClient: PgClient,
  loadOptions: any,
  sourceQueryText: string,
  sourceQueryParamValues?: any[]
): Promise<ExecResult> {
  const parser = new LoadOptionsParser({
    exprProvider: new ExprProviderPg(),
  });
  const statements = parser.parse(loadOptions);
  const executor = new StatementsExecutor({
    handler: async (statement) => {
      const query = statement.buildQuery({
        sourceQuery: {
          queryText: sourceQueryText,
          paramValues: sourceQueryParamValues,
        },
      });
      const { rows } = await pgClient.query(query.queryText, query.paramValues);
      return rows;
    },
  });
  const result = await executor.execute(statements);
  return result;
}

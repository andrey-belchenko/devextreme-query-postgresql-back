import { columnNames, Statements } from "./load-options-parser";
import { Statement } from "./statement";

export interface ExecutorOptions {
  statement: Statement;
}

export interface SqlQuery {
  queryText: string;
  paramValues?: any[];
}

export interface BuildQueryParams {
  sourceQuery: SqlQuery;
}

export interface ExecResult {
  data: any[];
  totalCount?: number;
}


export interface StatementsExecutorProps {
  handler: (params: Statement) => Promise<any[]>;
}

export class StatementsExecutor {
  executor: (params: Statement) => Promise<any[]>;
  private statements: Statements = undefined as any;

  constructor(props: StatementsExecutorProps) {
    this.executor = props.handler;
  }

  async execute(statements: Statements): Promise<ExecResult> {
    this.statements = statements;
    let result = {} as ExecResult;
    result = await this.queryData(result, this.statements.data);
    result = await this.queryTotalCount(result, this.statements.total);
    return result;
  }

  private async queryData(
    result: ExecResult,
    statement: Statement
  ): Promise<ExecResult> {
    const rows: any[] = await this.executor(statement);
    return { ...result, data: rows };
  }

  private async queryTotalCount(
    result: ExecResult,
    statement: Statement | undefined
  ): Promise<ExecResult> {
    if (!statement) return { ...result };
    const rows: any[] = await this.executor(statement);
    return { ...result, totalCount: rows[0][columnNames.totalCount] };
  }
}


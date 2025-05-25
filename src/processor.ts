import { LoadOptions } from "./load-options";
import {
  ColumnDefinition,
  ColumnReference,
  OrderByItem,
  Query,
  QueryParam,
  SqlExpressions,
} from "./sql-expressions";

export interface ExecutorOptions {
  statement: SqlStatement;
}

export interface SqlQuery {
  queryText: string;
  paramValues?: any[];
}

export interface BuildQueryParams {
  sourceQuery: SqlQuery;
}

export interface ExecResult {
  data?: any[];
  totalCount?: number;
}

interface SqlStatementProps {
  params?: QueryParam[];
  select?: ColumnDefinition[];
  orderBy?: OrderByItem[];
  offset?: number;
  limit?: number;
}
export class SqlStatement {
  params: QueryParam[];
  select: ColumnDefinition[];
  orderBy: OrderByItem[];
  offset?: number;
  limit?: number;

  constructor(props: SqlStatementProps = {}) {
    this.params = props.params || [];
    this.select = props.select || [];
    this.orderBy = props.orderBy || [];
    this.offset = props.offset;
    this.limit = props.limit;
  }

  buildQuery(params: BuildQueryParams): SqlQuery {
    const sourceQuery = params.sourceQuery;
    const srcAlias = "src";
    const sqlTextItems = [`with ${srcAlias} as (\n${sourceQuery.queryText}\n)`];
    const selectExpr = this.select?.length
      ? this.select.map((it) => it.toSql()).join(",\n")
      : " * ";
    sqlTextItems.push(`select ${selectExpr}`);
    sqlTextItems.push(`from ${srcAlias}`);

    if (this.orderBy?.length) {
      sqlTextItems.push(
        `order by ${this.orderBy.map((it) => it.toSql()).join(", ")}`
      );
    }

    if (this.offset !== undefined) {
      sqlTextItems.push(`offset ${this.offset}`);
    }
    if (this.limit !== undefined) {
      sqlTextItems.push(`limit ${this.limit}`);
    }

    
    return {
      queryText: sqlTextItems.join("\n"),
    };
  }

  copy() {
    return new SqlStatement({
      ...this,
      params: [...this.params],
      select: [...this.select],
      orderBy: [...this.orderBy],
    });
  }
}

const columnNames = {
  totalCount: "total_count",
};

export interface ProcessorProps {
  queryText: string;
  queryParams?: any[];
  loadOptions: LoadOptions;
  executor: (params: SqlStatement) => Promise<any[]>;
}

export class Processor {
  result: ExecResult = {};
  queryText: string;
  filteredQueryText?: string;
  sortedQueryText?: string;
  limitedQueryText?: string;
  queryParams: any[];
  loadOptions: LoadOptions;
  executor: (params: SqlStatement) => Promise<any[]>;
  sqlExpressions: SqlExpressions;

  constructor(props: ProcessorProps) {
    this.executor = props.executor;
    this.loadOptions = props.loadOptions;
    this.queryParams = props.queryParams || [];
    this.sqlExpressions = new SqlExpressions();
    this.queryText = props.queryText;
  }

  async execute(): Promise<ExecResult> {
    const initial = new SqlStatement();
    const filtered = this.createFilteredStatement(initial);
    const sorted = this.createSortedStatement(filtered);
    const limited = this.createLimitedStatement(sorted);
    const totalStatement = this.createTotalStatement(filtered);
    let result = {} as ExecResult;
    result = await this.queryTotalCount(result, totalStatement);
    result = await this.queryData(result, limited);
    return result;
  }

  private createFilteredStatement(base: SqlStatement): SqlStatement {
    return base.copy();
    // this.filteredQueryText = this.queryText;
  }

  private createSortedStatement(base: SqlStatement): SqlStatement {
    const result = base.copy();
    if (!this.loadOptions.sort) return result;

    // this.sortedQueryText = this.filteredQueryText;
    // if (!this.loadOptions.sort) return;

    const sortOptions = Array.isArray(this.loadOptions.sort)
      ? this.loadOptions.sort
      : [this.loadOptions.sort];

    if (!sortOptions.length) return result;

    // const sortExpr = [];
    for (let sortOption of sortOptions as any[]) {
      result.orderBy.push(
        new OrderByItem(
          new ColumnReference(sortOption.selector),
          sortOption?.desc
        )
      );
      // sortExpr.push(`${sortOption.selector} ${sortOption.desc ? "desc" : ""}`);
    }
    return result;

    // this.sortedQueryText += `\norder by ${sortExpr.join(",")}`;
  }

  private createLimitedStatement(base: SqlStatement): SqlStatement {
    const result = base.copy();
    result.offset = this.loadOptions.skip;
    result.limit = this.loadOptions.take;
    return result;
  }

  private createTotalStatement(base: SqlStatement): SqlStatement | undefined {
    if (!this.loadOptions.requireTotalCount) return;
    const result = base.copy();
    result.select = [
      new ColumnDefinition(
        this.sqlExpressions.rowsCount(),
        columnNames.totalCount
      ),
    ];
    return result;
  }

  private async queryData(
    result: ExecResult,
    statement: SqlStatement
  ): Promise<ExecResult> {
    const rows: any[] = await this.executor(statement);
    return { ...result, data: rows };
  }

  private async queryTotalCount(
    result: ExecResult,
    statement: SqlStatement | undefined
  ): Promise<ExecResult> {
    if (!statement) return { ...result };
    const rows: any[] = await this.executor(statement);
    return { ...result, totalCount: rows[0][columnNames.totalCount] };
  }
}

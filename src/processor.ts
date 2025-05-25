import { LoadOptions } from "./load-options";
import {
  ColumnDefinition,
  ColumnReference,
  ExprElement,
  ExprNode,
  OrderByItem,
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
  filter?: ExprElement;
}
export class SqlStatement {
  params: QueryParam[];
  select: ColumnDefinition[];
  orderBy: OrderByItem[];
  offset?: number;
  limit?: number;
  filter?: ExprElement;

  constructor(props: SqlStatementProps = {}) {
    this.params = props.params || [];
    this.select = props.select || [];
    this.orderBy = props.orderBy || [];
    this.offset = props.offset;
    this.limit = props.limit;
    this.filter = props.filter;
  }

  buildQuery(params: BuildQueryParams): SqlQuery {
    const sourceQuery = params.sourceQuery;
    const paramValues = [...(sourceQuery.paramValues || [])];

    let paramIndex = paramValues.length;

    for (const param of this.params) {
      paramIndex++;
      param.index = paramIndex;
      paramValues.push(param.value);
    }

    const srcAlias = "src";
    const sqlTextItems = [`with ${srcAlias} as (\n${sourceQuery.queryText}\n)`];
    const selectExpr = this.select?.length
      ? this.select.map((it) => it.toSql()).join(",\n")
      : " * ";
    sqlTextItems.push(`select ${selectExpr}`);
    sqlTextItems.push(`from ${srcAlias}`);

    if (this.filter) {
      sqlTextItems.push(`where ${this.filter.toSql()}`);
    }

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
      paramValues,
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
  loadOptions: LoadOptions;
  executor: (params: SqlStatement) => Promise<any[]>;
}

interface LoadOptionsPredicate {
  operator: string;
  items: any[];
}

function normalizePredicate(rawPredicate: any[] | any): LoadOptionsPredicate {
  if (!Array.isArray(rawPredicate)) {
    return rawPredicate;
  }
  let first = rawPredicate[0];
  let second = rawPredicate[1];
  let operator: string = "";
  let rawItems = [];
  if (first === "!") {
    operator = "!";
    rawItems.push(second);
  } else {
    operator = second;
    let skip = false;
    for (let item of rawPredicate) {
      if (!skip) {
        rawItems.push(item);
      }
      skip = !skip;
    }
  }
  return {
    operator,
    items: rawItems.map((it: any) => normalizePredicate(it)),
  };
}

export class Processor {
  loadOptions: LoadOptions;
  executor: (params: SqlStatement) => Promise<any[]>;
  sqlExpressions: SqlExpressions;

  constructor(props: ProcessorProps) {
    this.executor = props.executor;
    this.loadOptions = props.loadOptions;
    this.sqlExpressions = new SqlExpressions();
  }

  async execute(): Promise<ExecResult> {
    const initial = new SqlStatement();
    const filtered = this.createFilteredStatement(initial);
    const sorted = this.createSortedStatement(filtered);
    const limited = this.createLimitedStatement(sorted);
    const totalStatement = this.createTotalStatement(filtered);
    let result = {} as ExecResult;
    result = await this.queryData(result, limited);
    result = await this.queryTotalCount(result, totalStatement);
    return result;
  }

  private convertPredicate(
    predicate: LoadOptionsPredicate,
    statement: SqlStatement
  ): ExprElement {
    const sqlExpr = this.sqlExpressions;
    let func: (any: ExprNode[]) => ExprElement = () => undefined as any;
    switch (predicate.operator) {
      case "and":
        func = sqlExpr.and;
        break;
      case "or":
        func = sqlExpr.or;
        break;
      case "!":
        func = sqlExpr.not;
        break;
      case "contains":
        func = sqlExpr.contains;
        break;
      default:
        throw Error(`Unknown operator '${predicate.operator}'`);
    }
    if (!["and", "or", "!"].includes(predicate.operator)) {
      const param = new QueryParam(predicate.items[1]);
      statement.params.push(param);
      return func([new ColumnReference(predicate.items[0]), param]);
    } else {
      return func(
        predicate.items.map((it) =>
          this.convertPredicate(it as LoadOptionsPredicate, statement)
        )
      );
    }
  }

  private createFilteredStatement(base: SqlStatement): SqlStatement {
    const result = base.copy();
    if (this.loadOptions.filter) {
      const filter = normalizePredicate(this.loadOptions.filter);
      result.filter = this.convertPredicate(
        filter,
        result
      );
    }
    return result;
  }

  private createSortedStatement(base: SqlStatement): SqlStatement {
    const result = base.copy();
    if (!this.loadOptions.sort) return result;
    const sortOptions = Array.isArray(this.loadOptions.sort)
      ? this.loadOptions.sort
      : [this.loadOptions.sort];

    if (!sortOptions.length) return result;
    for (let sortOption of sortOptions as any[]) {
      result.orderBy.push(
        new OrderByItem(
          new ColumnReference(sortOption.selector),
          sortOption?.desc
        )
      );
    }
    return result;
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

import { an } from "@faker-js/faker/dist/airline-BUL6NtOJ";
import { LoadOptions } from "./load-options";
import {
  ColumnDefinition,
  ColumnReference,
  ExprElement,
  ExprNode,
  ExprText,
  OrderByItem,
  QueryParam,
  SqlExpressions,
  SqlExpressionsPg,
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
  groupBy?: ExprNode[];
  offset?: number;
  limit?: number;
  filter?: ExprElement;
}
export class SqlStatement {
  params: QueryParam[];
  select: ColumnDefinition[];
  orderBy: OrderByItem[];
  groupBy: ExprNode[];
  offset?: number;
  limit?: number;
  filter?: ExprElement;

  constructor(props: SqlStatementProps = {}) {
    this.params = props.params || [];
    this.select = props.select || [];
    this.orderBy = props.orderBy || [];
    this.groupBy = props.groupBy || [];
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

    if (this.groupBy?.length) {
      sqlTextItems.push(
        `group by ${this.groupBy.map((it) => it.toSql()).join(", ")}`
      );
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
      groupBy: [...this.groupBy],
    });
  }
}

const columnNames = {
  totalCount: "total_count",
  key: "key",
};

interface LoadOptionsPredicate {
  operator: string;
  items: any[];
}

export interface ProcessorProps {
  loadOptions: LoadOptions;
  executor: (params: SqlStatement) => Promise<any[]>;
}

export class Processor {
  loadOptions: LoadOptions;
  executor: (params: SqlStatement) => Promise<any[]>;
  sqlExpressions: SqlExpressions;

  constructor(props: ProcessorProps) {
    this.executor = props.executor;
    this.loadOptions = props.loadOptions;
    this.sqlExpressions = new SqlExpressionsPg();
  }

  async execute(): Promise<ExecResult> {
    const initialStatement = new SqlStatement();
    const filteredStatement = this.createFilteredStatement(initialStatement);
    const groupedStatement = this.createGroupStatement(filteredStatement);
    const sortedStatement = this.createSortedStatement(groupedStatement);
    const limitedStatement = this.createLimitedStatement(sortedStatement);
    const totalStatement = this.createTotalStatement(filteredStatement);
    let result = {} as ExecResult;
    result = await this.queryData(result, limitedStatement);
    result = await this.queryTotalCount(result, totalStatement);
    return result;
  }

  private normalizePredicate(rawPredicate: any[] | any): LoadOptionsPredicate {
    if (!Array.isArray(rawPredicate)) {
      return rawPredicate;
    }
    let first = rawPredicate[0];
    let second = rawPredicate[1];

    if (Array.isArray(first) && !second) {
      return this.normalizePredicate(first);
    }

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

    if (operator == "or") {
      let isInPredicate = true;
      const values = [];
      let prevColumn: string = undefined as any;
      for (const item of rawItems) {
        if (Array.isArray(item)) {
          const column = item[0];
          prevColumn = prevColumn || column;
          if (item[1] === "=" && prevColumn === column) {
            values.push(item[2]);
          } else {
            isInPredicate = false;
            break;
          }
        }
      }
      if (isInPredicate && values.length > 1) {
        return {
          operator: "in",
          items: [prevColumn, values],
        };
      }
    }
    return {
      operator,
      items: rawItems.map((it: any) => this.normalizePredicate(it)),
    };
  }

  private convertPredicate(
    predicate: LoadOptionsPredicate,
    statement: SqlStatement
  ): any[] {
    const sqlExpr = this.sqlExpressions;
    let func: (params: any[]) => any[] = undefined as any;
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
      case "=":
        func = sqlExpr.equal;
        break;
      case "<>":
        func = sqlExpr.notEqual;
        break;
      case ">":
        func = sqlExpr.greaterThan;
        break;
      case ">=":
        func = sqlExpr.greaterThanOrEqual;
        break;
      case "<":
        func = sqlExpr.lessThan;
        break;
      case "<=":
        func = sqlExpr.lessThanOrEqual;
        break;
      case "startswith":
        func = sqlExpr.startsWith;
        break;
      case "endswith":
        func = sqlExpr.endsWith;
        break;
      case "contains":
        func = sqlExpr.contains;
        break;
      case "notcontains":
        func = sqlExpr.notContains;
        break;
      case "in":
        func = sqlExpr.in;
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
      const filter = this.normalizePredicate(this.loadOptions.filter);
      result.filter = new ExprElement(this.convertPredicate(filter, result));
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

  private createGroupStatement(base: SqlStatement): SqlStatement {
    const result = base.copy();
    if (!this.loadOptions.group) return result;
    const groupOptions = Array.isArray(this.loadOptions.group)
      ? this.loadOptions.group
      : [this.loadOptions.group];

    if (!groupOptions.length) return result;

    for (let groupOption of groupOptions as any[]) {
      const columnRef = new ColumnReference(groupOption.selector);
      result.groupBy.push(columnRef);
      result.select.push(new ColumnDefinition(columnRef, columnNames.key));
    }
    return result;
  }

  private createTotalStatement(base: SqlStatement): SqlStatement | undefined {
    if (!this.loadOptions.requireTotalCount) return;
    const result = base.copy();
    result.select = [
      new ColumnDefinition(
        new ExprElement(this.sqlExpressions.count([new ExprText("*")])),
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

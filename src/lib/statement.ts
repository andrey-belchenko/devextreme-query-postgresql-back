import { LoadOptions } from "./load-options";
import {
  ColumnDefinition,
  Expr,
  ExprNode,
  OrderByItem,
  QueryParam,
} from "./expression";
import { ExprProvider } from "./expr-provider";

export interface Query {
  queryText: string;
  paramValues?: any[];
}

export interface BuildQueryParams {
  sourceQuery: Query;
  exprProvider: ExprProvider;
}


interface StatementProps {
  params?: QueryParam[];
  select?: ColumnDefinition[];
  orderBy?: OrderByItem[];
  groupBy?: ExprNode[];
  offset?: number;
  limit?: number;
  filter?: Expr;
}
export class Statement {
  params: QueryParam[];
  select: ColumnDefinition[];
  orderBy: OrderByItem[];
  groupBy: ExprNode[];
  offset?: number;
  limit?: number;
  filter?: Expr;

  constructor(props: StatementProps = {}) {
    this.params = props.params || [];
    this.select = props.select || [];
    this.orderBy = props.orderBy || [];
    this.groupBy = props.groupBy || [];
    this.offset = props.offset;
    this.limit = props.limit;
    this.filter = props.filter;
  }

  buildQuery(params: BuildQueryParams): Query {
    const sourceQuery = params.sourceQuery;
    const exprProvider = params.exprProvider;
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

    if (this.offset !== undefined || this.limit !== undefined) {
      const limitOffsetParts = exprProvider.limitOffset(this.offset, this.limit);
      sqlTextItems.push(...limitOffsetParts);
    }

    return {
      queryText: sqlTextItems.join("\n"),
      paramValues,
    };
  }

  copy() {
    return new Statement({
      ...this,
      params: [...this.params],
      select: [...this.select],
      orderBy: [...this.orderBy],
      groupBy: [...this.groupBy],
    });
  }
}





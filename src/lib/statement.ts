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

    let queryText = sqlTextItems.join("\n");

    // Handle pagination: check if provider supports query wrapping (e.g., Oracle ROWNUM)
    if (this.offset !== undefined || this.limit !== undefined) {
      if (exprProvider.wrapQueryForPagination) {
        const wrappedResult = exprProvider.wrapQueryForPagination(queryText, this.offset, this.limit, paramIndex);
        if (wrappedResult !== null) {
          queryText = wrappedResult.queryText;
          // Add pagination parameter values
          paramValues.push(...wrappedResult.paramValues);
        } else {
          // Provider returned null, use append approach
          const limitOffsetParts = exprProvider.limitOffset(this.offset, this.limit);
          queryText = queryText + "\n" + limitOffsetParts.join("");
        }
      } else {
        // Provider doesn't support wrapping, use append approach
        const limitOffsetParts = exprProvider.limitOffset(this.offset, this.limit);
        queryText = queryText + "\n" + limitOffsetParts.join("");
      }
    }

    return {
      queryText,
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





import { ExprProvider } from "./expr-provider";
import { ColumnDefinition, ColumnReference, Expr, ExprText, OrderByItem, QueryParam } from "./expression";
import { LoadOptions } from "./load-options";
import { Statement } from "./statement";


export const columnNames = {
  totalCount: "total_count",
  key: "key",
};

interface LoadOptionsPredicate {
  operator: string;
  items: any[];
}


export interface Statements {
  data: Statement;
  total?: Statement;
}

export interface LoadOptionsParserProps {
  exprProvider: ExprProvider;
}

export class LoadOptionsParser {
  private loadOptions: LoadOptions = undefined as any;
  exprProvider: ExprProvider;

  constructor(props: LoadOptionsParserProps) {
    this.exprProvider = props.exprProvider;
  }

  parse(loadOptions: LoadOptions): Statements {
    this.loadOptions = loadOptions;
    const initialStatement = new Statement();
    const filteredStatement = this.createFilteredStatement(initialStatement);
    const groupedStatement = this.createGroupStatement(filteredStatement);
    const sortedStatement = this.createSortedStatement(groupedStatement);
    const limitedStatement = this.createLimitedStatement(sortedStatement);
    const totalStatement = this.createTotalStatement(filteredStatement);
    return {
      data: limitedStatement,
      total: totalStatement,
    };
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
    statement: Statement
  ): any[] {
    const sqlExpr = this.exprProvider;
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

  private createFilteredStatement(base: Statement): Statement {
    const result = base.copy();
    if (this.loadOptions.filter) {
      const filter = this.normalizePredicate(this.loadOptions.filter);
      result.filter = new Expr(this.convertPredicate(filter, result));
    }
    return result;
  }

  private createSortedStatement(base: Statement): Statement {
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

  private createLimitedStatement(base: Statement): Statement {
    const result = base.copy();
    result.offset = this.loadOptions.skip;
    result.limit = this.loadOptions.take;
    return result;
  }

  private createGroupStatement(base: Statement): Statement {
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

  private createTotalStatement(base: Statement): Statement | undefined {
    if (!this.loadOptions.requireTotalCount) return;
    const result = base.copy();
    result.select = [
      new ColumnDefinition(
        new Expr(this.exprProvider.count([new ExprText("*")])),
        columnNames.totalCount
      ),
    ];
    return result;
  }
}

export abstract class ExprNode {
  abstract toSql(): string;
}

export class ExprElement extends ExprNode {
  items: ExprNode[];
  constructor(items: (ExprNode | string)[] | ExprElement) {
    super();
    if (items instanceof ExprElement) {
      this.items = items.items;
    } else {
      this.items = items.map((it) =>
        typeof it === "string" ? new ExprText(it) : it
      );
    }
  }
  toSql(): string {
    return "(" + this.items.map((it) => it.toSql()).join(" ") + ")";
  }
}

export class ExprText extends ExprNode {
  text: string;
  constructor(text: string) {
    super();
    this.text = text;
  }
  toSql(): string {
    return this.text;
  }
}

export class QueryParam extends ExprNode {
  constructor(public value: any) {
    super();
  }
  index: number | undefined = undefined;
  toSql(): string {
    return `$${this.index}`;
  }
}

export class ColumnReference extends ExprNode {
  constructor(public columnName: string) {
    super();
  }
  toSql(): string {
    return this.columnName;
  }
}

export class ColumnDefinition {
  constructor(public expr: ExprNode, public alias: string) {}
  toSql() {
    return `${this.expr.toSql()} as ${this.alias}`;
  }
}

export class OrderByItem {
  constructor(public expr: ExprNode, public isDesc: boolean) {}
  toSql(): string {
    return this.expr.toSql() + (this.isDesc ? " desc" : "");
  }
}

export interface SqlExpressions {
  and(params: any[]): any[];
  or(params: any[]): any[];
  not(params: any[]): any[];

  contains(params: any[]): any[];
  equal(params: any[]): any[];
  notEqual(params: any[]): any[];
  greaterThan(params: any[]): any[];
  greaterThanOrEqual(params: any[]): any[];
  lessThan(params: any[]): any[];
  lessThanOrEqual(params: any[]): any[];
  startsWith(params: any[]): any[];
  endsWith(params: any[]): any[];
  notContains(params: any[]): any[];
  in(params: any[]): any[];

  count(params: any[]): any[];
}


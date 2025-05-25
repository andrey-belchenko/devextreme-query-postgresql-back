export abstract class ExprNode {
  abstract toSql(): string;
}

export class Expr extends ExprNode {
  items: ExprNode[];
  constructor(items: (ExprNode | string)[] | Expr) {
    super();
    if (items instanceof Expr) {
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


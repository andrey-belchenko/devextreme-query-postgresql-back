export abstract class ExprNode {
  abstract toSql(): string;
}

export class ExprElement extends ExprNode {
  items: ExprNode[];
  constructor(items: ExprNode[]) {
    super();
    this.items = items;
  }
  toSql(): string {
    return "(" + this.items.map((it) => it.toSql()).join(" ") + ")";
  }
}

class ExprText extends ExprNode {
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

export class SqlExpressions {
  sum(item: ExprNode) {
    return new ExprElement([new ExprText("sum ("), item, new ExprText(")")]);
  }

  and(items: ExprNode[]) {
    const exprNodes: ExprNode[] = [];
    let first = true;
    for (const item of items) {
      if (!first) {
        exprNodes.push(new ExprText(" and "));
      }
      exprNodes.push(item);
      first = false;
    }
    return new ExprElement(exprNodes);
  }

  or(items: ExprNode[]) {
    const exprNodes: ExprNode[] = [];
    let first = true;
    for (const item of items) {
      if (!first) {
        exprNodes.push(new ExprText(" or "));
      }
      exprNodes.push(item);
      first = false;
    }
    return new ExprElement(exprNodes);
  }

  not(items: ExprNode[]) {
    return new ExprElement([
      new ExprText(" not ("),
      items[0],
      new ExprText(")"),
    ]);
  }

  contains(items: ExprNode[]) {
    return new ExprElement([
      items[0],
      new ExprText(" ILIKE '%' || "),
      items[1],
      new ExprText(" || '%' "),
    ]);
  }

  rowsCount() {
    return new ExprText("count(*)::int");
  }

  equal(items: ExprNode[]) {
    return new ExprElement([items[0], new ExprText(" = "), items[1]]);
  }

  notEqual(items: ExprNode[]) {
    return new ExprElement([items[0], new ExprText(" <> "), items[1]]);
  }

  greaterThan(items: ExprNode[]) {
    return new ExprElement([items[0], new ExprText(" > "), items[1]]);
  }

  greaterThanOrEqual(items: ExprNode[]) {
    return new ExprElement([items[0], new ExprText(" >= "), items[1]]);
  }

  lessThan(items: ExprNode[]) {
    return new ExprElement([items[0], new ExprText(" < "), items[1]]);
  }

  lessThanOrEqual(items: ExprNode[]) {
    return new ExprElement([items[0], new ExprText(" <= "), items[1]]);
  }

  startsWith(items: ExprNode[]) {
    return new ExprElement([
      items[0],
      new ExprText(" ILIKE "),
      items[1],
      new ExprText(" || '%'"),
    ]);
  }

  endsWith(items: ExprNode[]) {
    return new ExprElement([
      items[0],
      new ExprText(" ILIKE '%' || "),
      items[1],
    ]);
  }

  notContains(items: ExprNode[]) {
    return new ExprElement([
      items[0],
      new ExprText(" NOT ILIKE '%' || "),
      items[1],
      new ExprText(" || '%'"),
    ]);
  }

  in(items: ExprNode[]) {
    return new ExprElement([
      items[0],
      new ExprText(" = ANY("),
      items[1],
      new ExprText(")"),
    ]);
  }
}

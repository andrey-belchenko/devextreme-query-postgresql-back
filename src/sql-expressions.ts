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

class TextQuery {
  constructor(public text: string) {}
}

export type Query = TextQuery;

class TableAlias {
  constructor(public alias: string) {}
}

class ColumnAlias {
  constructor(public alias: string) {}
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

class SourceDefinition {
  constructor(public query: Query) {}
}

class SelectQuery {
  constructor(public columns: ColumnDefinition[], public from: Query) {}
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
    }
    return new ExprElement(exprNodes);
  }

  not(items: ExprNode[]) {
    const exprNodes: ExprNode[] = [];
    let first = true;
    for (const item of items) {
      if (!first) {
        exprNodes.push(new ExprText(" or "));
      }
      exprNodes.push(item);
    }
    return new ExprElement([
      new ExprText(" not ("),
      items[0],
      new ExprText(")"),
    ]);
  }

  contains(items: ExprNode[]) {
    return new ExprElement([
      new ExprText("upper("),
      items[0],
      new ExprText(") like '%' || upper("),
      items[1],
      new ExprText(") || '%' "),
    ]);
  }

  rowsCount() {
    return new ExprText("count(*)::int");
  }
}

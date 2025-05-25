abstract class ExprNode {
  abstract toSql(): string;
}

class ExprElement extends ExprNode {
  items: ExprNode[];
  constructor(items: ExprNode[]) {
    super();
    this.items = items;
  }
  toSql(): string {
    return this.items.map((it) => it.toSql()).join(" ");
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

  rowsCount() {
    return new ExprText("count(*)");
  }

  textQuery(text: string): TextQuery {
    return new TextQuery(text);
  }

  tableAlias(alias: string): TableAlias {
    return new TableAlias(alias);
  }

  from(query: Query) {
    return new SourceDefinition(query);
  }

  select(columns: ColumnDefinition[], from: Query) {
    return new SelectQuery(columns, from);
  }

  columnDef(expr: ExprNode, alias: string) {
    return new ColumnDefinition(expr, alias);
  }
}

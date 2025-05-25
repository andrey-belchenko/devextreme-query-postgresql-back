export abstract class ExprNode {
  abstract toSql(): string;
}

export class ExprElement extends ExprNode {
  items: ExprNode[];
  constructor(items: (ExprNode | string)[]) {
    super();
    this.items = items.map((it) =>
      typeof it === "string" ? new ExprText(it) : it
    );
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

export class SqlExpressions {
  sum(item: ExprNode) {
    return new ExprElement(["sum (", item, ")"]);
  }

  and(items: ExprNode[]) {
    // const exprNodes: ExprNode[] = [];
    // let first = true;
    // for (const item of items) {
    //   if (!first) {
    //     exprNodes.push(" and ");
    //   }
    //   exprNodes.push(item);
    //   first = false;
    // }
    // return new ExprElement(exprNodes);
    return new ExprElement(items.flatMap((it) => [it, " and "]).splice(0, -1));
  }

  or(items: ExprNode[]) {
    return new ExprElement(items.flatMap((it) => [it, " or "]).splice(0, -1));
  }

  not(items: ExprNode[]) {
    return new ExprElement([" not (", items[0], ")"]);
  }

  contains(items: ExprNode[]) {
    return new ExprElement([items[0], " ILIKE '%' || ", items[1], " || '%' "]);
  }

  rowsCount(items: ExprNode[]) {
    return new ExprElement(["count(", items[0], ")::int"]);
  }

  equal(items: ExprNode[]) {
    return new ExprElement([items[0], " = ", items[1]]);
  }

  notEqual(items: ExprNode[]) {
    return new ExprElement([items[0], " <> ", items[1]]);
  }

  greaterThan(items: ExprNode[]) {
    return new ExprElement([items[0], " > ", items[1]]);
  }

  greaterThanOrEqual(items: ExprNode[]) {
    return new ExprElement([items[0], " >= ", items[1]]);
  }

  lessThan(items: ExprNode[]) {
    return new ExprElement([items[0], " < ", items[1]]);
  }

  lessThanOrEqual(items: ExprNode[]) {
    return new ExprElement([items[0], " <= ", items[1]]);
  }

  startsWith(items: ExprNode[]) {
    return new ExprElement([items[0], " ILIKE ", items[1], " || '%'"]);
  }

  endsWith(items: ExprNode[]) {
    return new ExprElement([items[0], " ILIKE '%' || ", items[1]]);
  }

  notContains(items: ExprNode[]) {
    return new ExprElement([
      items[0],
      " NOT ILIKE '%' || ",
      items[1],
      " || '%'",
    ]);
  }

  in(items: ExprNode[]) {
    return new ExprElement([items[0], " = ANY(", items[1], ")"]);
  }
}

import { SqlExpressions } from "./sql-expressions";

export class SqlExpressionsPg implements SqlExpressions {
  and(params: any[]) {
    return params.flatMap((it) => [it, " and "]).slice(0, -1);
  }

  or(params: any[]) {
    return params.flatMap((it) => [it, " or "]).slice(0, -1);
  }

  not(params: any[]) {
    return [" not (", params[0], ")"];
  }

  contains(params: any[]) {
    return [params[0], " ILIKE '%' || ", params[1], " || '%' "];
  }

  equal(params: any[]) {
    return [params[0], " = ", params[1]];
  }

  notEqual(params: any[]) {
    return [params[0], " <> ", params[1]];
  }

  greaterThan(params: any[]) {
    return [params[0], " > ", params[1]];
  }

  greaterThanOrEqual(params: any[]) {
    return [params[0], " >= ", params[1]];
  }

  lessThan(params: any[]) {
    return [params[0], " < ", params[1]];
  }

  lessThanOrEqual(params: any[]) {
    return [params[0], " <= ", params[1]];
  }

  startsWith(params: any[]) {
    return [params[0], " ILIKE ", params[1], " || '%'"];
  }

  endsWith(params: any[]) {
    return [params[0], " ILIKE '%' || ", params[1]];
  }

  notContains(params: any[]) {
    return [params[0], " NOT ILIKE '%' || ", params[1], " || '%'"];
  }

  in(params: any[]) {
    return [params[0], " = ANY(", params[1], ")"];
  }

  count(params: any[]) {
    return ["count(", params[0], ")::int"];
  }
}

import { ExprProvider } from "./expr-provider";

export class ExprProviderOracle11g implements ExprProvider {
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
    return ["UPPER(", params[0], ") LIKE UPPER('%' || ", params[1], " || '%')"];
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
    return ["UPPER(", params[0], ") LIKE UPPER(", params[1], " || '%')"];
  }

  endsWith(params: any[]) {
    return ["UPPER(", params[0], ") LIKE UPPER('%' || ", params[1], ")"];
  }

  notContains(params: any[]) {
    return ["UPPER(", params[0], ") NOT LIKE UPPER('%' || ", params[1], " || '%')"];
  }

  in(params: any[]) {
    // Oracle uses IN with a subquery or list
    // For array parameters, we'll use IN with a list
    return [params[0], " IN ", params[1]];
  }

  count(params: any[]) {
    return ["CAST(count(", params[0], ") AS NUMBER)"];
  }

  limitOffset(offset?: number, limit?: number): string[] {
    // Return empty array - wrapping handles pagination for Oracle
    return [];
  }

  parameterPlaceholder(index: number): string {
    return `:${index}`;
  }

  wrapQueryForPagination(
    queryText: string,
    offset: number | undefined,
    limit: number | undefined,
    startParamIndex: number
  ): { queryText: string; paramValues: any[] } | null {
    // Oracle 11g ROWNUM pagination pattern
    // SELECT * FROM (
    //   SELECT inner.*, ROWNUM rnum FROM (
    //     -- original query here
    //   ) inner WHERE ROWNUM <= :maxRow
    // ) WHERE rnum > :minRow

    // Only wrap if we have pagination parameters
    if (offset === undefined && limit === undefined) {
      return null;
    }

    const minRow = offset || 0;
    const maxRow = minRow + (limit || 0);

    // If only limit is specified (no offset), use simpler pattern
    if (offset === undefined && limit !== undefined) {
      const maxRowParam = this.parameterPlaceholder(startParamIndex + 1);
      const wrappedQuery = `SELECT * FROM (\n  SELECT inner.*, ROWNUM rnum FROM (\n    ${queryText}\n  ) inner WHERE ROWNUM <= ${maxRowParam}\n)`;
      return {
        queryText: wrappedQuery,
        paramValues: [limit],
      };
    }

    // If only offset is specified (no limit), we still need a max value
    // Use a very large number (Oracle NUMBER max is ~1e126, but we'll use a reasonable large value)
    if (offset !== undefined && limit === undefined) {
      const maxRowParam = this.parameterPlaceholder(startParamIndex + 1);
      const minRowParam = this.parameterPlaceholder(startParamIndex + 2);
      // Use 999999999 as a practical maximum
      const wrappedQuery = `SELECT * FROM (\n  SELECT inner.*, ROWNUM rnum FROM (\n    ${queryText}\n  ) inner WHERE ROWNUM <= ${maxRowParam}\n) WHERE rnum > ${minRowParam}`;
      return {
        queryText: wrappedQuery,
        paramValues: [999999999, minRow],
      };
    }

    // Full pagination with offset and limit
    const maxRowParam = this.parameterPlaceholder(startParamIndex + 1);
    const minRowParam = this.parameterPlaceholder(startParamIndex + 2);
    const wrappedQuery = `SELECT * FROM (\n  SELECT inner.*, ROWNUM rnum FROM (\n    ${queryText}\n  ) inner WHERE ROWNUM <= ${maxRowParam}\n) WHERE rnum > ${minRowParam}`;

    return {
      queryText: wrappedQuery,
      paramValues: [maxRow, minRow],
    };
  }
}

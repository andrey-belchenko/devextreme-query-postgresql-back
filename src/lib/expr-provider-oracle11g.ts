import { ExprProvider } from "./expr-provider";
import { QueryParam, ExprText } from "./expression";

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
    // Oracle 11g: For array parameters, embed values directly as SQL literals
    // Check if params[1] is a QueryParam with an array value
    if (params[1] instanceof QueryParam && Array.isArray(params[1].value)) {
      // Extract the array value and convert to Oracle literal
      const arrayValue = params[1].value;
      const literal = toOracleLiteral(arrayValue);
      // Mark the QueryParam to skip adding to paramValues
      params[1].skipInParams = true;
      // Return ExprText with the literal instead of the QueryParam
      return [params[0], " IN ", new ExprText(literal)];
    }
    // For non-array parameters, use standard IN clause with parameter placeholder
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
    //
    // Note: startParamIndex is the next available parameter index (1-based)
    // So if startParamIndex = 3, we use :4 and :5 for the ROWNUM parameters

    // Only wrap if we have pagination parameters
    if (offset === undefined && limit === undefined) {
      return null;
    }

    // If only limit is specified (no offset), use simpler pattern
    if (offset === undefined && limit !== undefined) {
      // Use startParamIndex + 1 because startParamIndex is the last used index
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
        paramValues: [999999999, offset],
      };
    }

    // Full pagination with offset and limit
    // At this point, both offset and limit are guaranteed to be defined
    const minRow = offset!;
    const maxRow = minRow + limit!;
    const maxRowParam = this.parameterPlaceholder(startParamIndex + 1);
    const minRowParam = this.parameterPlaceholder(startParamIndex + 2);
    const wrappedQuery = `SELECT * FROM (\n  SELECT inner.*, ROWNUM rnum FROM (\n    ${queryText}\n  ) inner WHERE ROWNUM <= ${maxRowParam}\n) WHERE rnum > ${minRowParam}`;

    return {
      queryText: wrappedQuery,
      paramValues: [maxRow, minRow],
    };
  }
}



function toOracleLiteral(value: any): string {
  if (typeof value === 'string') {
      const escapedString = value.replace(/'/g, "''");
      return `'${escapedString}'`;
  } else if (typeof value === 'number') {
      return value.toString();
  } else if (value instanceof Date) {
      const year = value.getFullYear();
      const month = (value.getMonth() + 1).toString().padStart(2, '0');
      const day = value.getDate().toString().padStart(2, '0');
      return `DATE'${year}-${month}-${day}'`;
  } else if (Array.isArray(value)) {
      return `(${value.map(it => toOracleLiteral(it)).join(', ')})`;
  } else {
      throw new Error('Unsupported type');
  }
}
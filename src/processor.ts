import { LoadOptions } from "./load-options";
import {
  ColumnDefinition,
  OrderByItem,
  Query,
  QueryParam,
  SqlExpressions,
} from "./sql-expressions";

export interface ExecutorOptions {
  queryText: string;
  queryParams: any[];
}



export interface ExecResult {
  data?: any[];
  totalCount?: number;
}

export class SqlStatement {
  params: QueryParam[] = [];
  select: ColumnDefinition[] = [];
  orderBy: OrderByItem[] = [];
  copy() {
    return { ...this };
  }
}

export interface ProcessorProps {
  queryText: string;
  queryParams?: any[];
  loadOptions: LoadOptions;
  executor: (params: ExecutorOptions) => Promise<any[]>;
}

export class Processor {
  result: ExecResult = {};
  queryText: string;
  filteredQueryText?: string;
  sortedQueryText?: string;
  limitedQueryText?: string;
  queryParams: any[];
  loadOptions: LoadOptions;
  executor: (params: ExecutorOptions) => Promise<any[]>;
  sqlExpressions: SqlExpressions;

  constructor(props: ProcessorProps) {
    this.executor = props.executor;
    this.loadOptions = props.loadOptions;
    this.queryParams = props.queryParams || [];
    this.sqlExpressions = new SqlExpressions();
    this.queryText = props.queryText;
  }

  async execute(): Promise<ExecResult> {
    this.filter();
    this.sort();
    this.limit();
    await this.totalCount();
    await this.data();
    return this.result;
  }

  private async data() {
    const rows: any[] = await this.executor({
      queryText: this.limitedQueryText!,
      queryParams: this.queryParams,
    });
    this.result.data = rows;
  }

  private async totalCount() {
    if (!this.loadOptions.requireTotalCount) return;
    const query = `with a as\n(${this.filteredQueryText})\nselect count(*) as value from a`;
    const rows: any[] = await this.executor({
      queryText: query,
      queryParams: this.queryParams,
    });
    this.result.totalCount = rows[0].value;
  }

  private filter() {
    this.filteredQueryText = this.queryText;
  }

  private sort() {
    this.sortedQueryText = this.filteredQueryText;
    if (!this.loadOptions.sort) return;

    const sortOptions = Array.isArray(this.loadOptions.sort)
      ? this.loadOptions.sort
      : [this.loadOptions.sort];

    if (!sortOptions.length) return;

    const sortExpr = [];
    for (let sortOption of sortOptions as any[]) {
      sortExpr.push(`${sortOption.selector} ${sortOption.desc ? "desc" : ""}`);
    }

    this.sortedQueryText += `\norder by ${sortExpr.join(",")}`;
  }

  private limit() {
    this.limitedQueryText = this.sortedQueryText;
    if (this.loadOptions.skip) {
      this.limitedQueryText += ` offset ${this.loadOptions.skip}`;
    }

    if (this.loadOptions.take) {
      this.limitedQueryText += ` limit ${this.loadOptions.take}`;
    }
  }
}

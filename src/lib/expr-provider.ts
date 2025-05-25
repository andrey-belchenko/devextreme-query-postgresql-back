export interface ExprProvider {
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

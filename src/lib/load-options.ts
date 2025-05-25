export type KeySelector<T> = string | ((source: T) => string | number | Date | Object);

export type SelectionDescriptor<T> = {
    selector: KeySelector<T>;
};

export type OrderingDescriptor<T> = SelectionDescriptor<T> & {
    desc?: boolean;
};

export type SearchOperation = '=' | '<>' | '>' | '>=' | '<' | '<=' | 'startswith' | 'endswith' | 'contains' | 'notcontains';

export type GroupingInterval = 'year' | 'quarter' | 'month' | 'day' | 'dayOfWeek' | 'hour' | 'minute' | 'second';

export type SortDescriptor<T> = KeySelector<T> | OrderingDescriptor<T>;

export type GroupDescriptor<T> = KeySelector<T> | (OrderingDescriptor<T> & {
  groupInterval?: number | GroupingInterval;
  isExpanded?: boolean;
});

export type SelectDescriptor<T> = string | Array<string> | ((source: T) => any);

export type FilterDescriptor = any;

export type SummaryDescriptor<T> = KeySelector<T> | SelectionDescriptor<T> & {
  summaryType?: 'sum' | 'avg' | 'min' | 'max' | 'count';
};

export interface LoadOptions<T = any> {
  customQueryParams?: any;
  startDate?: Date;
  endDate?: Date;
  expand?: Array<string>;
  filter?: FilterDescriptor | Array<FilterDescriptor>;
  group?: GroupDescriptor<T> | Array<GroupDescriptor<T>>;
  groupSummary?: SummaryDescriptor<T> | Array<SummaryDescriptor<T>>;
  parentIds?: Array<any>;
  requireGroupCount?: boolean;
  requireTotalCount?: boolean;
  searchExpr?: string | Function | Array<string | Function>;
  searchOperation?: SearchOperation;
  searchValue?: any;
  select?: SelectDescriptor<T>;
  skip?: number;
  sort?: SortDescriptor<T> | Array<SortDescriptor<T>>;
  take?: number;
  totalSummary?: SummaryDescriptor<T> | Array<SummaryDescriptor<T>>;
  userData?: any;
}
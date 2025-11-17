import type Identifiable from '@/components/base/type';

export interface DictionaryItemEntity extends Identifiable {
  item_key: string;
  item_value: string;
  op: string;
}

export default interface DictionaryEntity extends Identifiable {
  name: string;
  write_only: boolean;
  items: DictionaryItemEntity[];
  service_id: string;
}

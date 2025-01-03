import type Identifiable from '@/components/base/type';

export default interface AclItemEntity extends Identifiable {
  ip: string;
  subnet: number;
  comment: string;
  op: string;
}

export default interface AclEntity extends Identifiable {
  name: string;
  entries: AclItemEntity[];
  service_id: string;
}

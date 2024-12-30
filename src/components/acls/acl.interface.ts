import type Identifiable from '@/components/base/type';

export default interface AclEntity extends Identifiable {
  name: string;
  entries: Identifiable[];
}

export default interface AclItemEntity extends Identifiable {
  ip: string;
}

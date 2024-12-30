import type Identifiable from '@/components/base/type';

export default interface AclItemEntity extends Identifiable {
  ip: string;
}

export default interface AclEntity extends Identifiable {
  name: string;
  entries: AclItemEntity[];
}

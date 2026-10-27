import type Identifiable from '@/components/base/type';

export default interface AclItemEntity extends Identifiable {
  ip: string;
  /** Fastly expects an integer CIDR prefix length (0-32), or null for an implicit /32; form inputs hold it as a string until save. */
  subnet: number | string | null;
  comment: string;
  op: string;
}

export default interface AclEntity extends Identifiable {
  name: string;
  entries: AclItemEntity[];
  service_id: string;
}

import type Identifiable from '@/components/base/type';

export default interface VclEntity extends Identifiable {
  number: string;
  contentHtml: string;
  contentRaw: string;
}

export default interface VclContentEntity extends Identifiable {
  content: string;
}

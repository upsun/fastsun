import type Identifiable from '@/components/base/type';

export default interface ActivityAttributes extends Identifiable {
  user_id: string;
  username: string;
}

export default interface ActivityEntity extends Identifiable {
  attributes: ActivityAttributes;
}

export default interface UserEntity extends Identifiable {
  name: string;
}

export default interface ProjectEntity extends Identifiable {
  active_version: {
    number: number;
  };
}

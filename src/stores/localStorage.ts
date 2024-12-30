import type UserEntity from '@/components/project/project.interface';


const KEY_USERS = "fastlycdn-cache-users";
export default class UserCache {

  setUser(value: UserEntity): void {
    const users = JSON.parse(localStorage.getItem(KEY_USERS) || '[]') as Array<UserEntity>;

    const finded = users.find((item) => { return item.id == value.id});
    if (!finded) {
      users.push(value);
      localStorage.setItem(KEY_USERS, JSON.stringify(users));
    }
  }

  getUser(id: string):  UserEntity | undefined {
    const users = JSON.parse(localStorage.getItem(KEY_USERS) || '[]') as Array<UserEntity>;
    const user = users.find((item) => { return item.id == id});
    return user;
  }
}

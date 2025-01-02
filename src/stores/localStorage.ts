import type UserEntity from '@/components/project/project.interface';


const KEY_USERS = "fastlycdn-cache-users";
const KEY_FASTLY_ID = "fastlycdn-api-id";
const KEY_FASTLY_TK = "fastlycdn-api-tk";
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

  setFastlyId(fastly_id: string) {
    if (fastly_id) {
      localStorage.setItem(KEY_FASTLY_ID, fastly_id);
    }
  }

  setFastlyToken(fastly_token: string) {
    if (fastly_token) {
      // Encrypt value !!
      localStorage.setItem(KEY_FASTLY_TK, fastly_token);
    }
  }

  getFastlyId(): string {
    return localStorage.getItem(KEY_FASTLY_ID) || '';
  }

  getFastlyToken(): string {
    // Decrypt value !!
    return localStorage.getItem(KEY_FASTLY_TK) || '';
  }
}

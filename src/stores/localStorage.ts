import type UserEntity from '@/components/project/project.interface';
import CryptoJS from 'crypto-js';

// Clean schema of local storage. (change this value if you updated the schema)
const SCHEMA_VERSION = 1;

// Keys of local storage.
const KEY_USERS = 'fastcdn-fastly-cache-users';
const KEY_FASTLY_ID = 'fastcdn-fastly-api-id';
const KEY_FASTLY_TK = 'fastcdn-fastly-api-tk';
const KEY_ADMIN_MODE = 'fastcdn-admin-mode';
const KEY_RTAPI_ENABLE = 'fastcdn-rtapi-enable';
const KEY_SCHEMA_VERSION = 'fastcdn-schema-version';

// Value of encrypt/Decrypt engine.
const SECRET = import.meta.env.VITE_CRYPTO_SECRET_KEY;
const IV = import.meta.env.VITE_CRYPTO_IV_KEY;
const SALT = import.meta.env.VITE_CRYPTO_SALT_KEY;

/**
 * Wrapper of localstorage for FastSun.
 */
export default class LocalStore {
  /**
   * Check version of schema of local storage.
   * If not the same, clean all data !
   */
  checkSchemaVersion() {
    const version = Number(localStorage.getItem(KEY_SCHEMA_VERSION)) || 0;
    if (SCHEMA_VERSION !== version) {
      localStorage.clear();
      localStorage.setItem(KEY_SCHEMA_VERSION, String(SCHEMA_VERSION));
    }
  }

  /**
   * Set Cache user from Fastly.
   */
  setUser(value: UserEntity): void {
    const users = JSON.parse(localStorage.getItem(KEY_USERS) || '[]') as Array<UserEntity>;

    const finded = users.find((item) => {
      return item.id == value.id;
    });
    if (!finded) {
      users.push(value);
      localStorage.setItem(KEY_USERS, JSON.stringify(users));
    }
  }

  /**
   * Get Cache user from Fastly.
   * @returns User.
   */
  getUser(id: string): UserEntity | undefined {
    const users = JSON.parse(localStorage.getItem(KEY_USERS) || '[]') as Array<UserEntity>;
    const user = users.find((item) => {
      return item.id == id;
    });

    return user;
  }

  /**
   * Set Fastly service ID.
   */
  setFastlyId(fastly_id: string) {
    if (fastly_id) {
      localStorage.setItem(KEY_FASTLY_ID, fastly_id);
    }
  }

  /**
   * Set Fastly service Token (and encrypt them).
   */
  setFastlyToken(fastly_token: string) {
    if (fastly_token) {
      const key = CryptoJS.PBKDF2(SECRET, SALT, { keySize: 256 / 32, iterations: 100 });
      const iv = CryptoJS.enc.Utf8.parse(IV);
      const encrypted = CryptoJS.AES.encrypt(fastly_token, key, { iv: iv, mode: CryptoJS.mode.CBC });
      const result = encrypted.ciphertext.toString(CryptoJS.enc.Hex);
      localStorage.setItem(KEY_FASTLY_TK, result);
    }
  }

  resetFastly() {
    localStorage.removeItem(KEY_FASTLY_ID);
    localStorage.removeItem(KEY_FASTLY_TK);
  }

  /**
   * Get Fastly service ID.
   * @returns Fastly service ID.
   */
  getFastlyId(): string {
    return localStorage.getItem(KEY_FASTLY_ID) || '';
  }

  /**
   * Get Fastly service Token (and decrypt them).
   * @returns Fastly service Token.
   */
  getFastlyToken(): string {
    const encryptValue = localStorage.getItem(KEY_FASTLY_TK) || '';
    const key = CryptoJS.PBKDF2(SECRET, SALT, { keySize: 256 / 32, iterations: 100 });
    const iv = CryptoJS.enc.Utf8.parse(IV);
    const cipher = CryptoJS.enc.Hex.parse(encryptValue);
    const decrypted = CryptoJS.AES.decrypt({ ciphertext: cipher } as CryptoJS.lib.CipherParams, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
    });
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    return result;
  }

  /**
   * Check override of Admin mode.
   * @returns True if enabled.
   */
  isAdminMode(): boolean {
    return localStorage.getItem(KEY_ADMIN_MODE) == 'true' || import.meta.env.VITE_ADMIN_MODE == 'true';
  }

  /**
   * Check override of RT-API is enabled.
   * @returns True if enabled.
   */
  isRtApiEnable(): boolean {
    return localStorage.getItem(KEY_RTAPI_ENABLE) == 'true' || import.meta.env.VITE_RTAPI_DISABLE == 'false';
  }
}

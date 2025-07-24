import type UserEntity from '@/components/project/project.interface';
import CryptoJS from 'crypto-js';

// Clean schema of local storage. (change this value if you updated the schema)
const SCHEMA_VERSION = 2;

// Keys of local storage.
const KEY_USERS = 'fastcdn-fastly-cache-users';
const KEY_FASTLY_PROJECTS = 'fastcdn-fastly-projects';
const KEY_FASTLY_ID = 'fastcdn-fastly-api-id'; // Legacy key - kept for migration
const KEY_FASTLY_TK = 'fastcdn-fastly-api-tk'; // Legacy key - kept for migration
const KEY_ADMIN_MODE = 'fastcdn-admin-mode';
const KEY_RTAPI_ENABLE = 'fastcdn-rtapi-enable';
const KEY_SCHEMA_VERSION = 'fastcdn-schema-version';

// Value of encrypt/Decrypt engine.
const SECRET = import.meta.env.VITE_CRYPTO_SECRET_KEY;
const IV = import.meta.env.VITE_CRYPTO_IV_KEY;
const SALT = import.meta.env.VITE_CRYPTO_SALT_KEY;

/**
 * Interface for project credentials
 */
interface ProjectCredentials {
  fastlyId: string;
  fastlyToken: string;
}

/**
 * Wrapper of localstorage for FastSun.
 */
export default class LocalStore {
  /**
   * Generate a unique key for project and environment combination
   */
  private generateProjectKey(projectId: string, environmentId: string): string {
    return `${projectId}:${environmentId}`;
  }

  /**
   * Check version of schema of local storage.
   * If not the same, clean all data !
   * Also migrates from legacy storage format to project-based format.
   */
  checkSchemaVersion() {
    const version = Number(localStorage.getItem(KEY_SCHEMA_VERSION)) || 0;

    // Migration from version 1 to 2: move legacy credentials to project-based storage
    if (version === 1) {
      const legacyId = localStorage.getItem(KEY_FASTLY_ID);
      const legacyToken = localStorage.getItem(KEY_FASTLY_TK);

      if (legacyId && legacyToken) {
        // For migration, we'll use a default project and environment ID since we don't have them
        const decryptedToken = this.decryptToken(legacyToken);
        this.setFastlyCredentials('default', 'default', legacyId, decryptedToken);

        // Clean up legacy keys
        localStorage.removeItem(KEY_FASTLY_ID);
        localStorage.removeItem(KEY_FASTLY_TK);
      }
    }

    if (SCHEMA_VERSION !== version) {
      if (version === 0) {
        localStorage.clear(); // Only clear all if coming from version 0
      }
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
   * Set Fastly credentials for a specific project and environment.
   */
  setFastlyCredentials(projectId: string, environmentId: string, fastlyId: string, fastlyToken: string) {
    if (!projectId || !environmentId || !fastlyId || !fastlyToken) return;

    const projectKey = this.generateProjectKey(projectId, environmentId);
    const projects = this.getAllProjects();
    projects[projectKey] = {
      fastlyId,
      fastlyToken: this.encryptToken(fastlyToken),
    };

    localStorage.setItem(KEY_FASTLY_PROJECTS, JSON.stringify(projects));
  }

  /**
   * Get Fastly credentials for a specific project and environment.
   */
  getFastlyCredentials(projectId: string, environmentId: string): ProjectCredentials | null {
    if (!projectId || !environmentId) return null;

    const projectKey = this.generateProjectKey(projectId, environmentId);
    const projects = this.getAllProjects();
    const project = projects[projectKey];

    if (!project) return null;

    return {
      fastlyId: project.fastlyId,
      fastlyToken: this.decryptToken(project.fastlyToken),
    };
  }

  /**
   * Get all projects from localStorage.
   */
  private getAllProjects(): Record<string, { fastlyId: string; fastlyToken: string }> {
    return JSON.parse(localStorage.getItem(KEY_FASTLY_PROJECTS) || '{}');
  }

  /**
   * Encrypt a token.
   */
  private encryptToken(token: string): string {
    const key = CryptoJS.PBKDF2(SECRET, SALT, { keySize: 256 / 32, iterations: 100 });
    const iv = CryptoJS.enc.Utf8.parse(IV);
    const encrypted = CryptoJS.AES.encrypt(token, key, { iv: iv, mode: CryptoJS.mode.CBC });
    return encrypted.ciphertext.toString(CryptoJS.enc.Hex);
  }

  /**
   * Decrypt a token.
   */
  private decryptToken(encryptedToken: string): string {
    if (!encryptedToken) return '';

    const key = CryptoJS.PBKDF2(SECRET, SALT, { keySize: 256 / 32, iterations: 100 });
    const iv = CryptoJS.enc.Utf8.parse(IV);
    const cipher = CryptoJS.enc.Hex.parse(encryptedToken);
    const decrypted = CryptoJS.AES.decrypt({ ciphertext: cipher } as CryptoJS.lib.CipherParams, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Remove credentials for a specific project and environment.
   */
  removeFastlyCredentials(projectId: string, environmentId: string) {
    if (!projectId || !environmentId) return;

    const projectKey = this.generateProjectKey(projectId, environmentId);
    const projects = this.getAllProjects();
    delete projects[projectKey];

    localStorage.setItem(KEY_FASTLY_PROJECTS, JSON.stringify(projects));
  }

  /**
   * Set Fastly service ID.
   * @deprecated Use setFastlyCredentials instead
   */
  setFastlyId(fastly_id: string) {
    // For backward compatibility, we'll store in a 'default' project and environment
    const credentials = this.getFastlyCredentials('default', 'default');
    if (credentials) {
      this.setFastlyCredentials('default', 'default', fastly_id, credentials.fastlyToken);
    }
  }

  /**
   * Set Fastly service Token (and encrypt them).
   * @deprecated Use setFastlyCredentials instead
   */
  setFastlyToken(fastly_token: string) {
    // For backward compatibility, we'll store in a 'default' project and environment
    const credentials = this.getFastlyCredentials('default', 'default');
    if (credentials) {
      this.setFastlyCredentials('default', 'default', credentials.fastlyId, fastly_token);
    }
  }

  resetFastly(projectId?: string, environmentId?: string) {
    if (projectId && environmentId) {
      // Remove credentials for specific project and environment
      this.removeFastlyCredentials(projectId, environmentId);
    } else {
      // Remove all project credentials (backward compatibility)
      localStorage.removeItem(KEY_FASTLY_PROJECTS);
    }
  }

  /**
   * Get Fastly service ID.
   * @deprecated Use getFastlyCredentials instead
   * @returns Fastly service ID.
   */
  getFastlyId(): string {
    // For backward compatibility, try to get from 'default' project and environment first
    const credentials = this.getFastlyCredentials('default', 'default');
    return credentials?.fastlyId || '';
  }

  /**
   * Get Fastly service Token (and decrypt them).
   * @deprecated Use getFastlyCredentials instead
   * @returns Fastly service Token.
   */
  getFastlyToken(): string {
    // For backward compatibility, try to get from 'default' project and environment first
    const credentials = this.getFastlyCredentials('default', 'default');
    return credentials?.fastlyToken || '';
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

import { ref, computed } from 'vue';
import LocalStore from './localStorage';

// Global reactive state using Vue 3 Composition API
// Alternative to Pinia for projects that don't have it installed

class CredentialsStore {
  private _serviceId = ref<string>('');
  private _serviceToken = ref<string>('');
  private _projectId = ref<string>('');
  private _environmentId = ref<string>('');
  private _vclVersion = ref<number>(-1);
  // Initialized from sessionStorage so the value is ready before any component mounts
  private _logoutReason = ref<string>(sessionStorage.getItem('fastcdn-logout-reason') ?? '');

  private localStore = new LocalStore();

  // Computed getters
  readonly serviceIsDefined = computed(() => {
    return this._serviceId.value !== '' && this._serviceToken.value !== '';
  });

  readonly vclVersionIsDefined = computed(() => {
    return this._vclVersion.value > 0;
  });

  readonly isAdmin = computed(() => {
    return this.localStore.isAdminMode();
  });

  // Actions
  setProjectInfo(projectId: string, environmentId: string) {
    this._projectId.value = projectId;
    this._environmentId.value = environmentId;
    this.loadCredentials();
  }

  setCredentials(serviceId: string, serviceToken: string) {
    this._serviceId.value = serviceId;
    this._serviceToken.value = serviceToken;
  }

  setVclVersion(version: number) {
    this._vclVersion.value = version;
  }

  loadCredentials() {
    if (!this._projectId.value || !this._environmentId.value) return;

    let credentials = this.localStore.getFastlyCredentials(this._projectId.value, this._environmentId.value);

    // Fallback to default credentials if project-specific credentials are not found
    if (!credentials) {
      credentials = this.localStore.getFastlyCredentials('default', 'default');
    }

    if (credentials) {
      this._serviceId.value = credentials.fastlyId;
      this._serviceToken.value = credentials.fastlyToken;

      // serviceId loaded but token is empty (failed to decrypt or corrupted).
      // No API call will be made so no 401 will be caught — set the reason here directly.
      if (credentials.fastlyId && !credentials.fastlyToken) {
        console.warn('FastSun > loadCredentials: serviceId present but token empty after decrypt');
        this.setLogoutReason(
          'Your Fastly token could not be loaded (possibly after a key rotation or browser migration). Please re-enter your credentials.',
        );
      } else if (credentials.fastlyId && credentials.fastlyToken) {
        // Credentials loaded successfully — clear any previous reason
        this.clearLogoutReason();
      }
    } else {
      this._serviceId.value = '';
      this._serviceToken.value = '';
    }
  }

  saveCredentials() {
    if (this._projectId.value && this._environmentId.value && this._serviceId.value && this._serviceToken.value) {
      this.localStore.setFastlyCredentials(
        this._projectId.value,
        this._environmentId.value,
        this._serviceId.value,
        this._serviceToken.value,
      );
      this.clearLogoutReason();
    }
  }
  clearCredentials() {
    this._serviceId.value = '';
    this._serviceToken.value = '';
    this._vclVersion.value = -1;
  }

  logout() {
    this.localStore.resetFastly(this._projectId.value, this._environmentId.value);
    this.clearCredentials();
  }

  setLogoutReason(reason: string) {
    this._logoutReason.value = reason;
    this.localStore.setLogoutReason(reason);
  }

  getLogoutReason(): string {
    return this._logoutReason.value;
  }

  clearLogoutReason() {
    this._logoutReason.value = '';
    this.localStore.clearLogoutReason();
  }

  // Safe getters that don't expose the actual tokens
  getServiceId(): string {
    return this._serviceId.value;
  }

  getServiceToken(): string {
    return this._serviceToken.value;
  }

  getProjectId(): string {
    return this._projectId.value;
  }

  getEnvironmentId(): string {
    return this._environmentId.value;
  }

  getVclVersion(): number {
    return this._vclVersion.value;
  }
}

// Singleton instance
const credentialsStore = new CredentialsStore();

// Composable function for Vue components
export function useCredentialsStore() {
  return credentialsStore;
}

export default credentialsStore;

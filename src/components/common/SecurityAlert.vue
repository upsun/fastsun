<template>
  <div v-if="showAlert" class="security-alert" :class="alertType">
    <div class="alert-header">
      <span class="alert-icon">{{ alertIcon }}</span>
      <h4 class="alert-title">{{ alertTitle }}</h4>
      <button @click="dismissAlert" class="alert-close" aria-label="Fermer l'alerte">×</button>
    </div>
    <div class="alert-content">
      <p>{{ alertMessage }}</p>
      <div v-if="showDetails" class="alert-details">
        <pre>{{ alertDetails }}</pre>
      </div>
      <div class="alert-actions">
        <button v-if="canShowDetails" @click="toggleDetails" class="btn-details">
          {{ showDetails ? 'Masquer les détails' : 'Voir les détails' }}
        </button>
        <button v-if="onRetry" @click="onRetry" class="btn-retry">Réessayer</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface Props {
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  details?: string;
  autoHide?: boolean;
  autoHideDelay?: number;
  onRetry?: () => void;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'warning',
  autoHide: true,
  autoHideDelay: 10000,
});

const showAlert = ref(true);
const showDetails = ref(false);

const canShowDetails = computed(() => props.details && props.details.length > 0);

const alertType = computed(() => `alert-${props.type}`);

const alertIcon = computed(() => {
  switch (props.type) {
    case 'error':
      return '⚠️';
    case 'warning':
      return '⚠️';
    case 'info':
      return 'ℹ️';
    default:
      return '⚠️';
  }
});

const alertTitle = computed(() => props.title);
const alertMessage = computed(() => props.message);
const alertDetails = computed(() => props.details || '');

const dismissAlert = () => {
  showAlert.value = false;
};

const toggleDetails = () => {
  showDetails.value = !showDetails.value;
};

// Auto-hide functionality
if (props.autoHide) {
  setTimeout(() => {
    showAlert.value = false;
  }, props.autoHideDelay);
}

// Expose methods for parent component
defineExpose({
  dismissAlert,
  showAlert: () => {
    showAlert.value = true;
  },
});
</script>

<style scoped>
.security-alert {
  border: 1px solid;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  animation: slideIn 0.3s ease-out;
}

.alert-warning {
  border-color: #fbbf24;
  background-color: #fffbeb;
  color: #92400e;
}

.alert-error {
  border-color: #f87171;
  background-color: #fef2f2;
  color: #dc2626;
}

.alert-info {
  border-color: #60a5fa;
  background-color: #eff6ff;
  color: #1d4ed8;
}

.alert-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.alert-icon {
  font-size: 18px;
  margin-right: 8px;
}

.alert-title {
  font-weight: 600;
  flex: 1;
  margin: 0;
}

.alert-close {
  padding: 4px;
  border-radius: 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.2s;
}

.alert-close:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.alert-content p {
  margin-bottom: 12px;
}

.alert-details {
  margin-top: 12px;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  font-size: 14px;
}

.alert-details pre {
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.alert-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.btn-details,
.btn-retry {
  padding: 4px 12px;
  font-size: 14px;
  border-radius: 4px;
  border: 1px solid;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.2s;
}

.alert-warning .btn-details,
.alert-warning .btn-retry {
  border-color: #fbbf24;
}

.alert-warning .btn-details:hover,
.alert-warning .btn-retry:hover {
  background-color: #fef3c7;
}

.alert-error .btn-details,
.alert-error .btn-retry {
  border-color: #f87171;
}

.alert-error .btn-details:hover,
.alert-error .btn-retry:hover {
  background-color: #fee2e2;
}

.alert-info .btn-details,
.alert-info .btn-retry {
  border-color: #60a5fa;
}

.alert-info .btn-details:hover,
.alert-info .btn-retry:hover {
  background-color: #dbeafe;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

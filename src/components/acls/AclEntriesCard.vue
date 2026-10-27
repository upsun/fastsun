<script setup lang="ts">
import { computed, ref, nextTick, type PropType } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable, {
  type DataTableRowEditSaveEvent,
  type DataTableRowEditInitEvent,
  type DataTableRowEditCancelEvent,
} from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import ProgressSpinner from 'primevue/progressspinner';

import type AclEntity from './acl.interface';
import type AclItemEntity from './acl.interface';
import AclAPIService from './acl.service';
import VclAPIService from '../vcl/vcl.service';
import { useCredentialsStore } from '@/stores/credentialsStore';
import LocalStore from '@/stores/localStorage';
import { eventBus, EventType } from '@/utils/eventBus';

// Init
const emit = defineEmits(['update:visible']);
const toast = useToast();
const credentialsStore = useCredentialsStore();
const props = defineProps({
  acl_data: {
    type: Object as PropType<AclEntity>,
    resuired: true,
  },
  acl_state_dialog: {
    type: Boolean,
    required: true,
  },
});

// Data
const submitted = ref<boolean>(false);
const headerTitle = ref<string>('ACL');
const entries = ref<AclItemEntity[]>([]);
const ip_selected = ref<AclItemEntity>();
const deleteIpDialog = ref<boolean>(false);
const editingRows = ref([]);
const editSnapshots = ref<Record<string, AclItemEntity>>({});
// Rows added via Add that haven't been committed via their own checkmark yet; cancelling one discards it entirely.
const newRowIds = ref<Set<string>>(new Set());
const idCounter = ref<number>(-1);
const DEFAULT_NEW_IP = '8.8.8.8';
const DEFAULT_NEW_SUBNET = '32';

// Dynamic name validation
const nameInputRef = ref<HTMLInputElement>();
const nameError = ref<string>('');
const isNameValid = ref<boolean>(true);
const isSaving = ref<boolean>(false);

// IP/subnet validation and persistent (non-toast) error feedback
const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const entryErrors = ref<Record<string, string>>({});
const formError = ref<string>('');

// We need to retrieve the current VCL version from the credentialsStore
const currentVclVersion = credentialsStore.getVclVersion();

const localStore = new LocalStore();
// Name as loaded from the API, kept so a rename can be detected (the input mutates acl_data.name directly).
const originalName = ref<string>('');
function refresh() {
  console.log('FastSun > Load ACL: ' + props.acl_data!.id);

  newRowIds.value = new Set();
  editSnapshots.value = {};
  entryErrors.value = {};

  if (props.acl_data === undefined || Object.keys(props.acl_data).length === 0) {
    headerTitle.value = 'Add ACL';
    originalName.value = '';
  } else {
    headerTitle.value = 'Edit ACL';
    entries.value = JSON.parse(JSON.stringify(props.acl_data.entries));
    originalName.value = props.acl_data.name;
  }
}
// Run once per dialog open (the component is remounted via v-if each time), not reactively:
// acl_data.name/entries are mutated in place by the form, and a watchEffect would re-run on
// every keystroke, wiping entries.value back to the original and making rename undetectable.
refresh();

// Events
function closeModal(updated = false) {
  emit('update:visible', updated);
}

function openIpDeleteModal() {
  deleteIpDialog.value = true;
}
function closeIpDeleteModal() {
  deleteIpDialog.value = false;
  ip_selected.value = {} as AclItemEntity;
}

// Fastly returns useful detail in the response body (e.g. duplicate entry), which axios'
// generic error.message ("Request failed with status code 400") never surfaces on its own.
function extractErrorMessage(error: unknown): string {
  const axiosError = error as { message?: string; response?: { status?: number; data?: unknown } };
  const status = axiosError?.response?.status;
  const data = axiosError?.response?.data;

  let detail = '';
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.detail === 'string') {
      detail = d.detail;
    } else if (typeof d.msg === 'string') {
      detail = d.msg;
    } else if (typeof d.message === 'string') {
      detail = d.message;
    } else if (Array.isArray(d.errors)) {
      detail = d.errors.map((e) => (typeof e === 'string' ? e : JSON.stringify(e))).join('; ');
    } else {
      detail = JSON.stringify(data);
    }
  } else if (typeof data === 'string' && data.trim() !== '') {
    detail = data;
  }

  const base = axiosError?.message || String(error);
  if (status && detail) {
    return `${base} (HTTP ${status}): ${detail}`;
  }
  return detail || base;
}

// Entries are kept in sync directly via syncField(); this marks the row dirty and rejects the
// commit (reopening it for editing) if it's invalid or a duplicate of another row.
function onRowEditSave(event: DataTableRowEditSaveEvent) {
  const { data } = event;
  const target = entries.value.find((entrie) => entrie.id === data.id);
  if (!target) {
    return;
  }

  if (target.op == undefined || target.op == '') {
    target.op = 'update';
  }

  validateEntries();

  const error = entryErrors.value[target.id];
  if (error) {
    toast.add({ severity: 'error', summary: 'Invalid entry', detail: error, life: 5000 });
    editingRows.value = [...editingRows.value, target as never];
    return;
  }

  // Row committed successfully: a later Cancel should restore it, not discard it.
  newRowIds.value.delete(String(target.id));
}

// Snapshot the pristine values before editing starts, so a Cancel can restore them.
function onRowEditInit(event: DataTableRowEditInitEvent) {
  const { data } = event;
  editSnapshots.value[data.id] = { ...data };
}

// Rows never committed via their checkmark are discarded entirely; everything else
// (including a committed new row reopened for a further edit) reverts to its snapshot.
function onRowEditCancel(event: DataTableRowEditCancelEvent) {
  const { data } = event;

  if (newRowIds.value.has(String(data.id))) {
    entries.value = entries.value.filter((entrie) => entrie.id !== data.id);
    newRowIds.value.delete(String(data.id));
  } else {
    const target = entries.value.find((entrie) => entrie.id === data.id);
    const snapshot = editSnapshots.value[data.id];
    if (target && snapshot) {
      target.ip = snapshot.ip;
      target.subnet = snapshot.subnet;
      target.comment = snapshot.comment;
      target.op = snapshot.op;
    }
  }

  delete entryErrors.value[data.id];
  delete editSnapshots.value[data.id];
}

async function saveACL() {
  console.log('FastSun > Save ACL: ' + props.acl_data!.id);
  submitted.value = true;
  formError.value = '';

  // Dynamic name validation
  if (!validateName()) {
    formError.value = 'Please fix the errors in the form before saving.';
    toast.add({ severity: 'error', summary: 'Invalid name', detail: formError.value, life: 5000 });
    focusNameInput();
    return;
  }

  if (!validateEntries()) {
    const firstError = Object.values(entryErrors.value)[0];
    formError.value = firstError
      ? `${firstError}. Please correct the highlighted rows.`
      : 'One or more IP/subnet entries are invalid. Please correct the highlighted rows.';
    toast.add({ severity: 'error', summary: 'Invalid IP entries', detail: formError.value, life: 5000 });
    return;
  }

  // Check if this is a new ACL (ID is empty or undefined)
  const isNewAcl = !props.acl_data!.id || props.acl_data!.id === '';

  if (isNewAcl) {
    await createNewAcl();
  } else {
    await updateAclEntries();
  }
}

async function createNewAcl() {
  isSaving.value = true;
  try {
    console.log('FastSun > Creating new ACL with draft version...');

    // Step 1: Create a new draft VCL version
    const vclService = new VclAPIService(credentialsStore.getServiceId(), credentialsStore.getServiceToken());
    const newVersion = await vclService.cloneVersion(currentVclVersion.toString());

    console.log('FastSun > New draft version created:', newVersion.number);

    // Step 2: Create the ACL in the new version
    const aclService = new AclAPIService(credentialsStore.getServiceId(), credentialsStore.getServiceToken());
    const cleanedName = props.acl_data!.name.trim(); // Ensure the name is clean
    const newAcl = await aclService.createACL(parseInt(newVersion.number), cleanedName);

    console.log('FastSun > New ACL created:', newAcl.id);

    // Step 3: Update the entries if there are any
    const updated = getPendingEntries();

    if (updated.length > 0) {
      await aclService.updateAclEntry(newAcl.id, updated);
      console.log('FastSun > ACL entries updated');
    }

    // Step 4: Validate the new VCL version
    console.log('FastSun > Validating VCL version:', newVersion.number);
    await vclService.validate(newVersion.number);

    // Step 5: Activate the new VCL version
    console.log('FastSun > Activating VCL version:', newVersion.number);
    await vclService.activate(newVersion.number);

    // Step 6: Close modal first, then update the VCL version in the store and notify other components
    closeModal(true);

    credentialsStore.setVclVersion(parseInt(newVersion.number));
    eventBus.emit(EventType.VCL_VERSION_CHANGED, parseInt(newVersion.number));

    toast.add({
      severity: 'success',
      summary: 'ACL Created & Activated!',
      detail: `ACL "${props.acl_data!.name}" created and version ${newVersion.number} activated`,
      life: 5000,
    });
  } catch (error) {
    console.error('Error creating ACL:', error);
    const message = extractErrorMessage(error);
    formError.value = message;
    toast.add({
      severity: 'error',
      summary: 'Error Creating ACL',
      detail: message,
      life: 5000,
    });
  } finally {
    isSaving.value = false;
  }
}

// Entries marked create/update, with subnet normalized to a number for the Fastly API.
function getPendingEntries(): AclItemEntity[] {
  return entries.value
    .filter((entrie: AclItemEntity) => entrie.op != undefined && entrie.op != '')
    .map((entrie: AclItemEntity) => ({ ...entrie, subnet: Number(entrie.subnet) }));
}

async function updateAclEntries() {
  console.log('FastSun > Save ACL entries: ' + props.acl_data!.id);

  const updated = getPendingEntries();
  const newName = props.acl_data!.name.trim();
  const nameChanged = newName !== originalName.value;

  if (updated.length === 0 && !nameChanged) {
    // Nothing to update, just close
    closeModal(true);
    toast.add({ severity: 'success', summary: 'ACL saved!', detail: 'ACL configuration saved', life: 5000 });
    return;
  }

  isSaving.value = true;
  try {
    const aclApi = new AclAPIService(props.acl_data!.service_id, credentialsStore.getServiceToken());

    // Call API for entry https://www.fastly.com/documentation/reference/api/acls/acl-entry/#bulk-update-acl-entries
    if (updated.length > 0) {
      await aclApi.updateAclEntry(props.acl_data!.id, updated);

      // Mark these as persisted so that if the rename step below fails and the user retries,
      // these entries aren't resent (which Fastly would reject as duplicates, masking the real error).
      const persistedIds = new Set(updated.map((entrie) => entrie.id));
      entries.value = entries.value
        .filter((entrie) => !(persistedIds.has(entrie.id) && entrie.op === 'delete'))
        .map((entrie) => (persistedIds.has(entrie.id) ? { ...entrie, op: '' } : entrie));
    }

    // Renaming the ACL itself is a versioned VCL change, same as create/delete.
    // https://www.fastly.com/documentation/reference/api/acls/acl/
    if (nameChanged) {
      const vclService = new VclAPIService(credentialsStore.getServiceId(), credentialsStore.getServiceToken());
      const newVersion = await vclService.cloneVersion(currentVclVersion.toString());

      await aclApi.updateACL(parseInt(newVersion.number), originalName.value, newName);
      await vclService.validate(newVersion.number);
      await vclService.activate(newVersion.number);

      credentialsStore.setVclVersion(parseInt(newVersion.number));
      eventBus.emit(EventType.VCL_VERSION_CHANGED, parseInt(newVersion.number));
      originalName.value = newName;
    }

    closeModal(true);
    toast.add({
      severity: 'success',
      summary: 'ACL saved!',
      detail: nameChanged ? `ACL renamed to "${newName}" and entries updated` : 'ACL entries updated successfully',
      life: 5000,
    });
  } catch (error) {
    console.error('Error updating ACL:', error);
    const message = extractErrorMessage(error);
    formError.value = message;
    toast.add({ severity: 'error', summary: 'Error updating ACL', detail: message, life: 5000 });
  } finally {
    isSaving.value = false;
  }
}

function addIp() {
  const id = idCounter.value--;
  const newRow = {
    id,
    ip: DEFAULT_NEW_IP,
    subnet: DEFAULT_NEW_SUBNET,
    comment: 'Add by FastSun',
    op: 'create',
  } as never;
  entries.value.unshift(newRow);
  editingRows.value = [...editingRows.value, newRow];
  newRowIds.value.add(String(id));
}

// Reads straight from the real entries record (not PrimeVue's per-column clone), so an
// auto CIDR-split in one column (e.g. ip) is immediately reflected in another (e.g. subnet).
function getEntryField(id: string, field: string): string {
  const target = entries.value.find((entrie: AclItemEntity) => entrie.id === id);
  if (!target) {
    return '';
  }
  const value = (target as unknown as Record<string, unknown>)[field];
  return value === null || value === undefined ? '' : String(value);
}

// Writes every keystroke straight into entries.value (bypassing PrimeVue's row-edit clone),
// so edits aren't lost if the user saves the dialog without clicking each row's own checkmark.
function syncField(id: string, field: string, value: string) {
  const target = entries.value.find((entrie: AclItemEntity) => entrie.id === id);
  if (!target) {
    return;
  }

  if (field === 'ip' && value.includes('/')) {
    const [ipPart = '', subnetPart] = value.split('/');
    target.ip = ipPart.trim();
    if (subnetPart !== undefined && subnetPart.trim() !== '') {
      target.subnet = subnetPart.trim();
    }
  } else if (field === 'ip' || field === 'subnet' || field === 'comment') {
    target[field] = value;
  }

  if (target.op == undefined || target.op == '') {
    target.op = 'update';
  }

  delete entryErrors.value[id];
}

function subnetKey(entrie: AclItemEntity): string {
  return entrie.subnet === null || entrie.subnet === undefined ? '' : String(entrie.subnet).trim();
}

// Format + duplicate check, only for rows actually being created/updated. Pre-existing,
// untouched rows (e.g. IPv6 entries, or ones with no explicit subnet) are already valid in
// Fastly as-is and must not block saving the rest of the ACL.
function computeEntryError(entrie: AclItemEntity, all: AclItemEntity[]): string | null {
  if (!entrie.op) {
    return null;
  }

  const ip = (entrie.ip ?? '').trim();
  const subnet = subnetKey(entrie);

  if (!IPV4_REGEX.test(ip)) {
    return `Invalid IP address: "${entrie.ip}"`;
  }

  const subnetNum = Number(subnet);
  if (subnet === '' || !Number.isInteger(subnetNum) || subnetNum < 0 || subnetNum > 32) {
    return `Invalid subnet prefix: "${entrie.subnet}" (must be 0-32)`;
  }

  const key = `${ip}/${subnet}`;
  const isDuplicate = all.some((other) => other.id !== entrie.id && `${(other.ip ?? '').trim()}/${subnetKey(other)}` === key);

  return isDuplicate ? `Duplicate entry: "${key}" is already used by another row` : null;
}

// Recomputes errors for every row (format + duplicates) so fixing one row also clears a stale
// duplicate flag on whichever other row it used to conflict with.
function validateEntries(): boolean {
  entryErrors.value = {};
  let valid = true;

  for (const entrie of displayEntries.value) {
    const error = computeEntryError(entrie, displayEntries.value);
    if (error) {
      entryErrors.value[entrie.id] = error;
      valid = false;
    }
  }

  return valid;
}

function confirmDeleteAclEntry(index: number) {
  const ipEntity = displayEntries.value[index];
  if (ipEntity) {
    console.log('FastSun > Delete IP (check): ' + ipEntity.id);

    ip_selected.value = ipEntity;
    openIpDeleteModal();
  }
}

function deleteIp() {
  if (ip_selected.value != null) {
    console.log('FastSun > Delete IP (make): ' + ip_selected.value.id);

    ip_selected.value.op = 'delete';
    closeIpDeleteModal();
  }
}

const displayEntries = computed(() => {
  return entries.value.filter((item) => {
    return item.op != 'delete';
  });
});

// Dynamic name validation
function validateName() {
  const name = props.acl_data!.name?.trim() || '';

  if (!name) {
    nameError.value = 'Name is required';
    isNameValid.value = false;
    return false;
  }

  const namePattern = /^[a-zA-Z][a-zA-Z0-9_\s]*$/;
  if (!namePattern.test(name)) {
    nameError.value = 'Name must start with a letter and contain only letters, numbers, underscores, and spaces';
    isNameValid.value = false;
    return false;
  }

  nameError.value = '';
  isNameValid.value = true;
  return true;
}

// Handler for real-time input
function onNameInput() {
  validateName();
}

// Focus on the name field with error
function focusNameInput() {
  nextTick(() => {
    if (nameInputRef.value) {
      nameInputRef.value.focus();
    }
  });
}
</script>

<template>
  <Dialog
    v-bind:visible="acl_state_dialog"
    @update:visible="closeModal"
    :style="{ width: '900px' }"
    v-bind:header="headerTitle"
    :modal="true"
  >
    <div v-if="formError" class="border border-red-500 bg-red-50 text-red-700 rounded p-3 mb-3">
      {{ formError }}
    </div>
    <div>
      <label for="name" class="block font-bold mb-3">Name</label>
      <InputText
        ref="nameInputRef"
        id="name"
        v-model.trim="acl_data!.name"
        required="true"
        autofocus
        :invalid="!isNameValid"
        fluid
        placeholder="e.g. my_acl_name or My ACL Name"
        @input="onNameInput"
        @blur="validateName"
        :class="{ 'border-red-500 bg-red-50': !isNameValid }"
      />
      <small v-if="nameError" class="text-red-500 block mt-1">{{ nameError }}</small>
      <small v-else class="text-gray-500 text-sm mt-1 block">
        Must start with a letter and contain only letters, numbers, underscores, and spaces
      </small>
    </div>
    <br />
    <div>
      <DataTable
        :value="displayEntries"
        dataKey="id"
        scrollable
        scrollHeight="400px"
        editMode="row"
        v-model:editingRows="editingRows"
        @row-edit-init="onRowEditInit"
        @row-edit-save="onRowEditSave"
        @row-edit-cancel="onRowEditCancel"
      >
        <template #empty> No IPs defined. </template>
        <template #loading> Loading IPs data. Please wait...</template>
        <template #header>
          <div class="flex flex-wrap gap-2 items-center justify-between">
            <h4 class="m-0" style="display: inline-flex">Manage IPs</h4>
            <Button
              label="Add"
              icon="pi pi-plus"
              size="small"
              class="mr-2"
              style="margin-left: auto"
              @click="addIp()"
            />
          </div>
        </template>
        <Column field="ip" header="IP" sortable>
          <template #body="{ data }">
            <span :class="{ 'text-red-500': entryErrors[data.id] }" :title="entryErrors[data.id]">{{ data.ip }}</span>
          </template>
          <template #editor="{ data, field }">
            <InputText
              :modelValue="getEntryField(data.id, field)"
              @update:modelValue="(v) => syncField(data.id, field, String(v))"
              :invalid="!!entryErrors[data.id]"
              placeholder="e.g. 192.0.2.0 or 192.0.2.0/24"
              fluid
            />
          </template>
        </Column>
        <Column field="subnet" header="Subnet" sortable style="width: 25%">
          <template #editor="{ data, field }">
            <InputText
              :modelValue="getEntryField(data.id, field)"
              @update:modelValue="(v) => syncField(data.id, field, String(v))"
              :invalid="!!entryErrors[data.id]"
              fluid
            />
          </template>
        </Column>
        <Column field="comment" header="Comment" sortable>
          <template #editor="{ data, field }">
            <InputText
              :modelValue="getEntryField(data.id, field)"
              @update:modelValue="(v) => syncField(data.id, field, String(v))"
              fluid
            />
          </template>
        </Column>
        <Column :exportable="false" style="min-width: 8rem" header="Actions">
          <template #body="{ editorInitCallback, index }">
            <Button icon="pi pi-pencil" outlined rounded class="mr-2" @click="editorInitCallback" />
            <Button icon="pi pi-trash" outlined rounded severity="danger" @click="confirmDeleteAclEntry(index)" />
          </template>
          <template #editor="{ editorSaveCallback, editorCancelCallback }">
            <Button icon="pi pi-save" text rounded @click="editorSaveCallback" />
            <Button icon="pi pi-times" text rounded severity="danger" @click="editorCancelCallback" />
          </template>
        </Column>
      </DataTable>
      <small class="text-gray-500 text-sm mt-1 block">
        Tip: paste a CIDR address (e.g. 192.0.2.0/24) into the IP field and it will split automatically into IP and
        Subnet.
      </small>
    </div>
    <template #footer v-if="!isSaving">
      <Button label="Cancel" icon="pi pi-times" text @click="closeModal(false)" />
      <Button label="Save" icon="pi pi-check" @click="saveACL" />
    </template>
    <div v-if="isSaving" class="flex items-center justify-center gap-2 p-4">
      <ProgressSpinner style="width: 30px; height: 30px" strokeWidth="4" />
      <span>Creating ACL and activating version...</span>
    </div>
  </Dialog>

  <Dialog v-model:visible="deleteIpDialog" :style="{ width: '450px' }" header="Confirm" :modal="true">
    <div class="flex items-center gap-4">
      <i class="pi pi-exclamation-triangle !text-3xl" />
      <span v-if="ip_selected"
        >Are you sure you want to delete <b>{{ ip_selected.ip }}</b
        >?</span
      >
    </div>
    <template #footer>
      <Button label="No" icon="pi pi-times" text @click="deleteIpDialog = false" />
      <Button label="Yes" icon="pi pi-check" @click="deleteIp" />
    </template>
  </Dialog>
</template>

<script lang="ts">

import AclAPIService from '@/components/acls/acl.api';

const aclService = new AclAPIService();

// import type { Header, Item } from "vue3-easy-data-table";

// const headers: Header[] = [
//   { text: "PLAYER", value: "player" },
//   { text: "TEAM", value: "team"},
//   { text: "NUMBER", value: "number"},
//   { text: "POSITION", value: "position"},
//   { text: "HEIGHT", value: "indicator.height"},
//   { text: "WEIGHT (lbs)", value: "indicator.weight", sortable: true},
//   { text: "LAST ATTENDED", value: "lastAttended", width: 200},
//   { text: "COUNTRY", value: "country"},
// ];

export default {
  data() {
    return {
      acls: null
    }
  },
  async created() {
    const [error, data] = await aclService.getACL(11)
    console.log(data)

    if (error) console.error(error);
    else this.acls = data

    this.acls.forEach(acl => {
      console.log(acl.name)
    })

    this.acls.forEach( async (acl) => {
      const [error, data] = await aclService.getACLEntry(acl.id)

      if (error) console.error(error);
      else acl.entries = data;
    });
  }
}

</script>

<template>
  <li v-for="acl in acls" :key="acl.id">
    {{ acl.name }}<br />
    [{{ acl.id }}]
    <li v-for="entry in acl.entries" :key="entry.id">
      {{ entry.ip }}
    </li>
  </li>
  <!-- <EasyDataTable
    :headers="headers"
    :items="acls"
  /> -->
</template>

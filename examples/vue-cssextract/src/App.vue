<template>
  <div class="panel-container foobar">
    <welcome :exampleName="exampleName" :statusMessage="statusMessage" :logoData="logoData" />
    <clicks />
  </div>
</template>

<script>
  import { GTG } from '../../_shared/constants'
  import { vue } from '../../_shared/logos'
  import ready from '../../_shared/ready'
  import clicks from '../../_shared/vue/Clicks.vue'
  import welcome from '../../_shared/vue/Welcome.vue'

  export default {
    name: 'app',
    data: () => ({
      exampleName: 'vue-cssextract',
      logoData: vue,
      statusMessage: '',
    }),
    components: {
      Clicks: clicks,
      Welcome: welcome,
    },
    async mounted() {
      await import(/* webpackChunkName: "greener" */ '../../_shared/make.it.green').then(greener => greener.makeItGreen())
      this.statusMessage = GTG
      ready()
    }
  }
</script>

<style scoped>
.foobar {
  font-family: monospace
}
</style>

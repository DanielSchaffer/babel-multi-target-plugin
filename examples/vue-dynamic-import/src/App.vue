<template>
  <div id="app">
    <HelloWorld msg="dynamic import"/>
  </div>
</template>

<script>

export default {
  name: 'app',
  components: {
    HelloWorld: () => import('./components/HelloWorld.vue')
  },
  mounted() {
    import(/* webpackChunkName: "dep" */ './dependency').then(dep => dep())
  }
}
</script>

<style>
html,
body {
  background: green;
}
</style>

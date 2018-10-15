<template>
  <div class="hello">
    <h1>{{ msg }}</h1>
    <button @click="greet">Open alert</button>
  </div>
</template>

<script>
export default {
  name: 'HelloWorld',
  props: {
    msg: String
  },
  methods: {
    greet() {
      window.alert(`prop msg: ${this.msg}`)
    }
  },
  mounted() {
    import(/* webpackChunkName: "dep" */ '../dependency').then(dep => dep())
  }
}
</script>

<style>
.hello {
  color: white;
}
</style>

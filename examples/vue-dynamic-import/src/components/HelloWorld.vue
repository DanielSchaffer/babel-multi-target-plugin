<template>
  <div class="hello">
    <h1>{{ msg }}</h1>
    <button @click="greet">Open alert</button>
  </div>
</template>

<script>
import moment from 'moment'

export default {
  name: 'HelloWorld',
  props: {
    msg: String
  },
  methods: {
    greet() {
      const date = moment().format()
      window.alert(`prop msg: ${this.msg}, ${date}`)
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

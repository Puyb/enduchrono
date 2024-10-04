<template>
  <div>
    <b-button v-b-modal.modal-change-categorie>Changer categorie</b-button>

    <b-modal
      id="modal-change-categorie"
      ref="modal"
      title="Changer la catégorie"
      @show="resetCategorieModal"
      @hidden="resetCategorieModal"
      @ok="handleChangeCategorie"
    >
      <form ref="form">
        <b-form-group
          label="Catégorie"
          label-for="categorie-input"
        >
          <b-form-select v-model="newCategorie" :options="categories"></b-form-select>
        </b-form-group>
      </form>
    </b-modal>
  </div>
</template>

<script>
export default {
  name: 'ChangeCategorie',
  props: { equipe: null },
  data() {
    return {
      newCategorie: null,
    }
  },
  computed: {
    categories() {
      const categories = []
      for (const equipe of Object.values(this.$store.state.equipes)) {
        if (!categories.includes(equipe.categorie)) {
          categories.push(equipe.categorie)
        }
      }
      return categories
    }
  },
  methods: {
    resetCategorieModal() {
      this.newCategorie = this.equipe.categorie
    },
    handleChangeCategorie() {
      this.equipe.categorie = this.newCategorie
      // save to server
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>

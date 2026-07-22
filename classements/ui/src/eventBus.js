import Vue from 'vue'

// Bus dedie aux composants qui ont besoin des evenements 'tour' bruts
// (nouveaux tours + modifications de statut) independamment de la fenetre
// bornee `store.state.tours` (ex. historique complet d'une equipe).
export const bus = new Vue()

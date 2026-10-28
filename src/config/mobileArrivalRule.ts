import {QueueRule} from '../types/queueTypes';
export const MOBILE_ARRIVAL_RULE: QueueRule = {
 id:'rule-13-mobile-arrival',code:'R-13',name:'Tickets application : tolérance en nombre de clients',category:'booking',enabled:true,priorityOrder:13,
 description:'À la confirmation de présence, conserver le rang FIFO de l’émission si au plus X autres clients sont entrés dans la même agence et catégorie depuis cette émission. Compter aussi les clients déjà appelés ou servis. Au-delà de X, rejoindre la file à la confirmation. Les tickets non confirmés ne sont jamais appelés.',
 rationale:'Les rendez-vous gardent leur tolérance en minutes (R-03). Les autres priorités restent applicables ; aucun client déjà appelé n’est interrompu.',
 formulaDescription:'N = autres entrées physiques après émission et avant confirmation ; règle activée et N ≤ X → FIFO depuis émission, sinon FIFO depuis confirmation.',
 parameters:{peopleTolerance:{key:'peopleTolerance',label:'Tolérance de clients entrés après émission',type:'number',value:2,min:0,max:50,step:1,unit:'clients',description:'Nombre entier X. Zéro conserve le rang uniquement si personne n’est entré entre-temps. Une modification s’applique aux tickets encore en attente selon le compteur figé à leur confirmation.'}}
};

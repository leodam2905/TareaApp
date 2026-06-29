import { asc } from './asc.mjs';
const ai = await asc('/v1/apps/6784029141/appInfos');
const declId = ai.body.data[0].relationships.ageRatingDeclaration.data?.id || ai.body.data[0].id;
const attrs = {
  alcoholTobaccoOrDrugUseOrReferences:'NONE', contests:'NONE', gamblingSimulated:'NONE', gunsOrOtherWeapons:'NONE',
  medicalOrTreatmentInformation:'NONE', profanityOrCrudeHumor:'NONE', sexualContentGraphicAndNudity:'NONE',
  sexualContentOrNudity:'NONE', horrorOrFearThemes:'NONE', matureOrSuggestiveThemes:'NONE',
  violenceCartoonOrFantasy:'NONE', violenceRealisticProlongedGraphicOrSadistic:'NONE', violenceRealistic:'NONE',
  gambling:false, unrestrictedWebAccess:false, lootBox:false, messagingAndChat:true, userGeneratedContent:true,
  parentalControls:false, ageAssurance:false, advertising:false, healthOrWellnessTopics:false,
};
const r = await asc(`/v1/ageRatingDeclarations/${declId}`, { method:'PATCH', body: JSON.stringify({ data:{ type:'ageRatingDeclarations', id: declId, attributes: attrs } })});
console.log('Tarea Pro age rating:', r.status==200 ? 'OK' : JSON.stringify(r.body.errors).slice(0,300));

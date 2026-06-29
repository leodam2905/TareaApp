import { asc } from './asc.mjs';
const declId = 'e0dea3ec-fed6-4cd6-8093-b1ab9421abd2'; // = appInfo id for Tarea Home
const attrs = {
  alcoholTobaccoOrDrugUseOrReferences: 'NONE',
  contests: 'NONE',
  gamblingSimulated: 'NONE',
  gunsOrOtherWeapons: 'NONE',
  medicalOrTreatmentInformation: 'NONE',
  profanityOrCrudeHumor: 'NONE',
  sexualContentGraphicAndNudity: 'NONE',
  sexualContentOrNudity: 'NONE',
  horrorOrFearThemes: 'NONE',
  matureOrSuggestiveThemes: 'NONE',
  violenceCartoonOrFantasy: 'NONE',
  violenceRealisticProlongedGraphicOrSadistic: 'NONE',
  violenceRealistic: 'NONE',
  gambling: false,
  unrestrictedWebAccess: false,
  lootBox: false,
  messagingAndChat: true,
  userGeneratedContent: true,
  parentalControls: false,
  ageAssurance: false,
  advertising: false,
  healthOrWellnessTopics: false,
};
const r = await asc(`/v1/ageRatingDeclarations/${declId}`, { method:'PATCH', body: JSON.stringify({
  data: { type:'ageRatingDeclarations', id: declId, attributes: attrs }
})});
console.log('status', r.status);
if (r.status>=300) console.log(JSON.stringify(r.body.errors, null, 1).slice(0,1200));
else console.log('OK - ageRatingOverride:', r.body.data.attributes.ageRatingOverrideV2);

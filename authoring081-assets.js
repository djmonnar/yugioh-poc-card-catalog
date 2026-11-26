// Presentation-only aliases for approved character images.
// A custom uploaded URL, or an intentionally empty portrait, stays unchanged.
const kenzanPortrait208='assets/actors/native208/tyranno_kenzan/start.png';
const portraits081=Object.freeze({
  ...Object.fromEntries(['start','cutin','lose'].map(stage=>[
    `Character081/images/esper_roba/${stage}`,`assets/actors/esper-roba081/${stage}.png`
  ])),
  'Character206/tyranno_kenzan_start':kenzanPortrait208,
  'Character208/tyranno_kenzan_start':kenzanPortrait208,
  'assets/actors/native206/tyranno_kenzan/start.png':kenzanPortrait208
});
export function portraitUrl081(value){return Object.hasOwn(portraits081,value)?portraits081[value]:value;}

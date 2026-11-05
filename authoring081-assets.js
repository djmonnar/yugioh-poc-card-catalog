// Presentation-only aliases for the three exact original Esper images.
// A custom uploaded URL, or an intentionally empty portrait, stays unchanged.
const portraits081=Object.freeze(Object.fromEntries(['start','cutin','lose'].map(stage=>[
  `Character081/images/esper_roba/${stage}`,`assets/actors/esper-roba081/${stage}.png`
])));
export function portraitUrl081(value){return Object.hasOwn(portraits081,value)?portraits081[value]:value;}

// Card display metadata bound to app card and slot identities.
const entries={
  2765:["813374e461b5f0da7a5e2fd56b9573d234354f2d663ea3a51a491d91c37fd27b",["붉은 눈의 철기사－기어프리드","Gearfried the Red-Eyes Iron Knight"],null],
  2766:["8c4db8a7a94ea6e465ac9a010ebc4daa40cc47b7b812fb5eac5cb4854a516c93",["붉은 눈의 흑염룡","Red-Eyes Black Flare Dragon"],null],
  2767:["ce0a5830a5a33d3c0d8d10bad972fa5be77087361566caf6df4f535df07002b4",["쇠사슬 스파이크 실드","Spikeshield with Chain"],null],
  2768:["c7c7a06b1ab9c0e02846602ef9c5fdb5d71c2bfb85a953b4eb9e29f2958bfd68",["최강의 방패","Magnum Shield"],null],
  2769:["b03efc80142793cde8aa0d09e91fe273015cd715972cff96b46ec330aa8b475e",["자율행동 유닛","Autonomous Action Unit"],null],
  2770:["54d691a3f3720a788ada51026c3b1576fa11284522ca95032d0d55f3dbe4eb73",["왕립 마법도서관","Royal Magical Library"],1],
  2771:["803d108a44bdeb42344d236c2c39db05a1bfd5c10415075e37d08749e9f1a77a",["유사공간","Pseudo Space"],null],
  2772:["183d6a42ab7a9ac6f3a4ea871fb7820aec6dc704421eed88e77a79001efccf3c",["견습마술사","견습 마술사","Apprentice Magician"],null],
  2773:["3633d2c1eedc4658dbaed9e3709799ad048c41aabef149a27827fee44093cfaf",["블리자드 프린세스","Blizzard Princess"],null],
  2774:["64b70550cedad4c910df013be0028dd8a5d2828b3fbdea37036c022dc9d283b9",["제스티 콩피","제스터 콩피","Jester Confit"],null],
  2775:["e9d81ea7dcf7f8c19aad1e6f8710c422f3959f0f71d6b586dd9d398532b9c2eb",["더 트릭키","The Tricky"],null],
  2776:["60d7a09b408ac1e20af292121e8d832991409243b58b1966277671f9e8fa28df",["태양의 신관","Oracle of the Sun"],null],
  2777:["6b8d1e790f5c7163c5ec1e2427789368fe890784037fb20d709fdff288b03bb8",["붉은개미아스카톨","붉은 개미 아스카톨","Fire Ant Ascator"],null],
  2778:["3d6cb17ffa8bf675a9877e0a0e3ef60c4ff0371920b5d2b164558a97af546244",["수파이","Supay"],null],
  2779:["b639549dcb1cda581d1ca247470c08489fd80734886e902b0bc5558dd3cace49",["전선복귀","Back to the Front"],null],
  2780:["81c8e203481b55e35931b2dc74998131ec60d09bc967ba7b9d2bdf3a6b77945b",["침묵의죽은자","침묵의 죽은자","Silent Doom"],null],
  2781:["325cd883d1eaadc8471818e8a0f6897d6f36278f5a4ab0cace851ecbb33c3240",["이중의 함정속으로","이중의 함정 속으로","Gemini Trap Hole"],null],
  2782:["1f9737028fd42867fb3bf39a9eee7037532805d090aba08b8f90cfaea493aa2a",["번개제왕자보르그","번개 제왕 자보르그","Zaborg the Thunder Monarch"],null],
  2783:["c5ab34a932a374d6402179c1d3bdadc72f7139cba6e0413771cee4e40d7fba3e",["번개 제왕가신 미스라","번개 제왕의 가신 미스라","Mithra the Thunder Vassal"],null],
  2784:["f46d10e7b5e7999886cde613f31a5cd3c7b32fef12331cc4d914bea0b3df0f02",["가신 토큰","Vassal Token"],0],
  2785:["66efcb35a0fc1288350f90c38bb51cf06efa2cc1c064b4ed165803c6e72787b1",["전광 설화","전광－설화－","Denko Sekka"],null],
  2786:["d403d9f3ffa0e2c7c61797d4f8f74e594348a039c432239c249582ee17813afa",["썬더나이트","썬더 나이트","Thunder Knight"],null],
  2787:["37eac914ffaeb3ad292797b67d2be12cc66d8ad3cda2ffc919dff9ccefdffb1b",["천둥","Lightning Crash"],null],
  2788:["eac884873ccf55a0a5fa682da4611a6887c499b69fb3c0135a24ca9b5e7869c3",["화톳불","Bonfire"],null],
  2789:["ddce2ae645deaeb7105317cb692c356ca14dc0b691533ff4d7b8f8f56ca6d92b",["환상의총사","환상의 총사","Phantom Skyblaster"],null],
  2790:["27debabe7bfbf059fc29ea2ce621b0e6febf5d557977957acf35d1016bac9f18",["총사 토큰","Skyblaster Token"],0],
};

export function cardMetadata120(sourceId,identityKey){
  const entry=Object.hasOwn(entries,sourceId)?entries[sourceId]:null;
  if(!entry||entry[0]!==identityKey)return null;
  return {image:`assets/native120/cards/${sourceId}.jpg`,searchAliases:entry[1],maximumNormalLimit:entry[2]};
}

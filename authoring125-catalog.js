import {cardMetadata122} from './authoring122-catalog.js?v=20261115-flip-cards';

const entries = {
  2816:["c662f0c2203c59482124b08a7cb0c02888e854dc500216f4774d087b30721243",["에일리언도그","에일리언 도그","Alien Dog"]],
  2817:["d1be5d0963e8e22534515cd211c758173e04e89612372549df74f4cab598bf18",["에일리언스컬","에일리언 스컬","Alien Skull"]],
  2818:["5dc8137918de979678aeafdfd4714988cd7c1218574fbd6b4505506eb993283d",["에일리언버스터","에일리언 버스터","Alien Stealthbuster"]],
  2819:["f2eedbf49dd038288ed38ebe87b466203139e601fd3b57aac4f08a193aa79b7a",["스네이크레인","스네이크 레인","Snake Rain"]],
  2820:["5f4a6ab66fe2ceb135eab10622ed364654653f4e0b483a106ee1029c268a9741",["에일리언브레인","에일리언 브레인","Alien Brain"]],
  2821:["2af5a14a90f28ad1ff630b733e346855fc27e574a9305366c66394bc118215a3",["독사의공물","독사의 공물","Offering to the Snake Deity"]],
  2822:["da7eea471bc4bc7c0df10cf09ce45588a25a510d73fff2f2d3f831d78604ada2",["폭풍 도마뱀","Gale Lizard"]],
  2823:["74045356d1f15e4043e0fae173764bcb3b21066e94c729a9fa9c84efaa67d08c",["그림자 도마뱀","Kagetokage"]],
  2824:["3d56fc15553c1103bb465912ba1f696b73cefffc913561a34b79f30a8ac2e339",["에일리언 키즈","Alien Kid"]],
  2825:["a35c7d691d7858cd03b3147db4a8bef36973ca4947bf6dbf7b336117ce6a164c",["원반 무스키","Flying Saucer Muusik'i"]],
  2826:["cb1ab94e4ed57839af2e30ab1881812059f9c7e0a36a17a861f01b992843edf9",["우주야수 건길","Cosmic Horror Gangi'el"]],
  2827:["8c55a00f23035a46163dc7fe2e2f08c9c9869470acca2fd55fc283335d013fa3",["대기권 외 사격","Orbital Bombardment"]],
  2828:["d754f19afe57c8619f5d8d5dc6baee0e1702f612aa0ea9876ffd0fd211f4465f",["세뇌광선","Brainwashing Beam"]],
  2829:["0c33e035671289d791fe07757f92d3305011586a2a23343d3add93415e82a087",["스네이크 휘슬","Snake Whistle"]],
  2830:["e4e22ea3dc178ef8c0e2bd82da827954dd4017448c128dd4f6a28092856eb549",["세포 파괴 바이러스","Cell Explosion Virus"]],
  2831:["fd5a5d32c1ab2df03155dde3d6200cdb9d18cc111e4d94442601fd80246bbac5",["아공간 점프 장치","Interdimensional Warp"]],
  2832:["31331a2f54fb6e6f86c336e6d33d888da25c9e5a45c886a6b0827a49e3267a91",["이계공간 A존","이계공간－A 존","Otherworld - The \"A\" Zone"]],
  2833:["4b8ee46ccba163a0bbdc708e67ca0c2e39281225c4e3eef7858146feed46b622",["사신의 대재해","Malevolent Catastrophe"]],
  2834:["fec128bd4b28a56dccf722e1a2afda7f46fa4190efd0a48f89a99093c6662c97",["\"A\" 세포 증식 장치","\"A\" Cell Breeding Device"]],
  2835:["6294e4a8c5ce2de0c13dd097e5f79768fac61867c23cf2304d0c69d28cac03f9",["\"A\" 세포 변환 장치","\"A\" Cell Recombination Device"]],
  2836:["494779d777092fb999f97e0966868c08279bc4b6d311ac9bada6c5e4f5535aa3",["트라이앵글 에리어","Mysterious Triangle"]],
  2837:["0ff73a6d4d97302db319d35811426085b8c7d740b8fdc3876f5771faf34818e0",["\"A\" 세포 산포 폭탄","\"A\" Cell Scatter Burst"]],
  2838:["af91b446c95074509cc01cae90658b567050b8ef06e1d0e3bc488684a1b7f030",["침식세포 \"A\"","Corruption Cell \"A\""]],
};

export function cardMetadata125(sourceId,identityKey) {
  const entry = Object.hasOwn(entries,sourceId) ? entries[sourceId] : null;
  if (entry && entry[0] === identityKey)
    return {image:`assets/native125/cards/${sourceId}.jpg`,searchAliases:entry[1]};
  return cardMetadata122(sourceId,identityKey);
}

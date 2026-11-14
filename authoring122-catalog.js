import {cardMetadata120} from './authoring120-catalog.js?v=20261115-120';

const entries = {
  2791:["f3465ad184c76552439fa34a63656e51b78d579af92322b7132e78a0ddb0abb0",["그레이브 오우자","Grave Ohja"]],
  2792:["204abd1f7fe7b4b9c14e38610f6dc3dc86b506a2db2ba81fb241b23763998e91",["왕족친위대","Royal Keeper"]],
  2793:["90833914d313aa7921a1c59c8ecac03938773fb6fa86561c60b6c7e22755dc8b",["모아이요격표","모아이 요격포","Moai Interceptor Cannons"]],
  2794:["af606651a085fb014740d081a19753b255db153c4fcd470ac0f3d16f9c05a215",["포이즌미라","포이즌 미라","Poison Mummy"]],
  2795:["89dac433725a26fb07c5a629d0fa0fc2076d83ead052eec809c3609aaf7b6269",["자이언트미라","자이언트 미라","Giant Axe Mummy"]],
  2796:["8acea80540453e77f6fc965fd03375928e84cc36c373eb9d77659c27c712aa10",["메뚜기군세","메뚜기 군세","Swarm of Locusts"]],
  2797:["cc0928edd72880757ae1e8761251c65f4ee85fbb0d7c9dae2e505b25b2313418",["스캐럽 대군","Swarm of Scarabs"]],
  2798:["44bbb661fda4760f12fcbfd0644d53d65e5679b90fca00991e6988a30a1c1645",["선셋 비트","Sunset Beat"]],
  2799:["c13f36209aeefa6ef852147f126c5f9f47b3fd53aacddc5b1612f3637ab5c9e5",["타임 리와인더","Time Reloader"]],
  2800:["1bb559a41a170a4f994ac9f5d8bd964e4f445249db739f4057470cd0dbeeab75",["마도잡화상인","마도 잡화상인","Magical Merchant"]],
  2801:["5b8b8386a775fb4db7e3974f5822753abcd53c357e2d30929c264f406ec95785",["요술망치","Magical Mallet"]],
  2802:["3aba8ed83a3015de185a1c44f22794c11a597e65d99d9a76a22a193f666c205b",["견습마적사","견습 마적사","Apprentice Piper"]],
  2803:["fa2d6d0e87993b5ed6c38707a752b96ae948a3b9ffb2a01c6075424298b7f505",["리버스포드","리버스 포드","Reverse Jar"]],
  2804:["734398136884a75193a228f8de8ac70543215902dd22a4da538d106946318668",["개기일식의서","개기일식의 서","Book of Eclipse"]],
  2805:["2714b01ee7af544683e04ac12ec7154e65b8db2b9842ad0ba19a8d12f62fc278",["태양의서","태양의 서","Book of Taiyou"]],
  2806:["84a18cf04c0c368cee0c1b9523e61635ba5688be6001431bd777d6ccdf8a6ec9",["금기의항아리","금기의 항아리","Pot of the Forbidden"]],
  2807:["38a0e3aa865b7b4de1c304d29b3cf720ac1381978c4598142441e2ebe0db222a",["의태하는식인곤충","의태하는 식인 곤충","Mimicking Man-Eater Bug"]],
  2808:["b80a3a8abcd68fc894421c7cbe9ed705105959a063d4c1f88005e21ea75a6a58",["쓰쿠요미","Tsukuyomi"]],
  2809:["141013b47560caffde27ab0aba8c8e31cb44f767484c35ef4f0598858c56931c",["펭귄첩자","펭귄 첩자","Penguin Ninja"]],
  2810:["8f7fcfce45cff39ccb38195bd3a5b0d8e7aaeb91349604bc906dc2caa9731811",["펭귄스워드","펭귄 스워드","Penguin Sword"]],
  2811:["5e9afb67053dca915d539b93a90def33b656f064eb869ba12c7f247742a5ee8f",["펭귄나이트메어","펭귄 나이트메어","Nightmare Penguin"]],
  2812:["ff6f65a3aef6869f406010caa8c51bdfd94c97c58c9bb0c193cd3fb8eeb33dfb",["펭귄승려","펭귄 승려","Penguin Cleric"]],
  2813:["eb837c2fa322aabe0838de67b0856ab65b3984a704c7a72a6ebd0c0a8107ea51",["씽전후","씽쩐후","Xing Zhen Hu"]],
  2814:["54451fe2c21b7acff3f454a1b032396dbb52d0572ab416ff78798ea3749633d0",["씽전후의레플리카","씽쩐후의 레플리카","Xing Zhen Hu Replica"]],
  2815:["a09ce1f6382e785c2f4f1e5e18ec2aab1e57f3c3d8ca9a9f4e62547bdd153a70",["도도도갓사","도도도 갓사","Dododo Swordsman"]],
};

export function cardMetadata122(sourceId,identityKey) {
  const entry = Object.hasOwn(entries,sourceId) ? entries[sourceId] : null;
  if (entry?.[0] === identityKey)
    return {image:`assets/native122/cards/${sourceId}.jpg`,searchAliases:entry[1]};
  return cardMetadata120(sourceId,identityKey);
}

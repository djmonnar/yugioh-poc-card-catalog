// Each additive layer keeps all earlier immutable catalog pins. This reader
// accepts older confirmed publications while the new APK is being rolled out.
export const GAME_IDENTITY067=Object.freeze({
  base_catalog_sha256:'b73dd51c78aeab8c9beebf936b46e4cac16040e70df3a7980dec38c40db21e09',
  catalog035_sha256:'b5f1e9749cec0c1497c5fdcbfb2dc9c64895dcd859f083ec0ec4014580f05308',
  native_manifest_sha256:'4674de031c9e3044c86b90fcd402d9533d9353347802f268863746bf3bd7e4d7',
  catalog049_sha256:'a66d3abd442d501d1c53f703e00d269ee877916750884fef21d318732500622e',
  native_manifest049_sha256:'843bc3bcebe36bcbfe7f5f6e2584222f5ab67bc5175c590b37d2963839134e7f',
  catalog053_sha256:'68b9765e467ac1a59b734f2d13f0baa8fad55abcd7bc1e42c1034e979d8f7f5c',
  native_manifest053_sha256:'205ef763b65335d553c1e5870e84f6237814b65b1481c96de06503684dd455aa',
  catalog067_sha256:'01b778306f88adf4307e635c357cd42660ad38e26cf73e7c5a1c1287ccee9842',
  native_manifest067_sha256:'5d671f09f3754cef65f05af7344745372404e8f28ed2e1e15cdafcc409c36d3f'
});
const layers=new Set([3,5,7,9]);
export function gameIdentityMatches067(identity){
  if(identity===null||typeof identity!=='object'||Array.isArray(identity))return false;
  const count=Object.keys(identity).length;
  return layers.has(count)&&Object.entries(GAME_IDENTITY067).slice(0,count).every(([key,value])=>identity[key]===value);
}

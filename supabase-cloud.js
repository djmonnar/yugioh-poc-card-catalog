// Official SDK is bundled locally; no secret/service-role key is ever used here.
export function validateCloudConfig(config){
  if(config?.schema_version!==1||config.provider!=='supabase'||!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(config.url)||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishable_key))throw new Error('온라인 연결 설정을 확인할 수 없어.');
  return config;
}
export function cloudRows(value){
  if(!Array.isArray(value)||value.length>142)throw new Error('온라인 덱 자료를 확인할 수 없어.');
  const seen=new Set();
  for(const row of value){
    if(!row||typeof row.filename!=='string'||!Number.isSafeInteger(row.version)||row.version<1||row.packet?.target?.filename!==row.filename||row.packet.kind!=='poc-ai-deck-sync'||seen.has(row.filename))throw new Error('온라인 덱 버전을 확인할 수 없어.');
    seen.add(row.filename);
  }
  return value;
}
export function cloudError(error){
  const msg=error?.message||'';
  if(msg.includes('poc_ai_asset_limit'))return '새 AI 덱은 100개까지 온라인 저장할 수 있어.';
  if(msg.includes('poc_story_scenario_limit'))return '시나리오는 20개까지 온라인 저장할 수 있어.';
  if(msg.includes('poc_story_battle_limit'))return '온라인 시나리오 전체 전투는 합쳐서 100개까지야.';
  if(msg.includes('poc_conflict'))return '다른 기기에서 이 덱을 수정했어. 온라인 덱을 불러온 뒤 변경 내용을 비교하고 다시 저장해줘.';
  if(msg.includes('poc_editor_required')||error?.code==='42501')return '덱 편집 권한이 있는 이메일 계정으로 로그인해줘.';
  if(msg.includes('poc_invalid_catalog')||msg.includes('poc_identity_changed'))return '카드 자료가 바뀌었어. 페이지를 새로 열고 현재 카드로 확인해줘.';
  if(msg.includes('poc_'))return '덱 검사에 통과하지 못했어. 카드 수·종류·제한과 적용 상대를 확인해줘.';
  if(msg.includes('rate limit'))return '인증 메일 요청이 많아. 잠시 기다린 뒤 다시 요청해줘.';
  return '온라인 연결에 실패했어. 편집본은 이 브라우저에 남아 있어. 잠시 후 다시 시도해줘.';
}
export class DeckCloud{
  constructor(client){this.client=client;this.rows=null;}
  async load(){const {data,error}=await this.client.rpc('poc_load_ai_decks');if(error)throw error;this.rows=cloudRows(data);return this.rows;}
  version(filename){if(this.rows===null)throw new Error('온라인 버전을 먼저 불러와야 해.');return this.rows.find(r=>r.filename===filename)?.version??0;}
  async save(packet,expectedVersion){
    if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw new Error('온라인 버전을 확인해줘.');
    const {data,error}=await this.client.rpc('poc_save_ai_deck',{p_packet:packet,p_expected_version:expectedVersion});if(error)throw error;
    const row=cloudRows([data])[0];if(row.filename!==packet.target.filename)throw new Error('저장 결과가 적용 상대와 달라.');
    this.rows=[...(this.rows||[]).filter(r=>r.filename!==row.filename),row];return row;
  }
  async editor(){const {data,error}=await this.client.rpc('poc_editor_status');if(error)throw error;return data===true;}
  async create(packet,requestId){
    const {data,error}=await this.client.rpc('poc_create_ai_deck',{p_packet:packet,p_request_id:requestId});if(error)throw error;
    const row=cloudRows([data])[0];this.rows=[...(this.rows||[]).filter(r=>r.filename!==row.filename),row];return row;
  }
}

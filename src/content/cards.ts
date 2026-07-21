import { CARD_SETS, CONTENT_VERSION } from '../content/sets'
import type { SetId } from '../content/schema'

export type CardGroupId = 'fire' | 'water' | 'earth' | 'dark' | 'light'

export interface CardGroupDefinition { id: CardGroupId; name: string; shortName: string; description: string }
export const CARD_GROUPS: Record<CardGroupId, CardGroupDefinition> = {
  fire:{id:'fire',name:'불',shortName:'불',description:'공격과 폭발'}, water:{id:'water',name:'물',shortName:'물',description:'드로우와 되돌리기'},
  earth:{id:'earth',name:'땅',shortName:'땅',description:'마나와 성장'}, dark:{id:'dark',name:'어둠',shortName:'암',description:'묘지와 고립'},
  light:{id:'light',name:'빛',shortName:'빛',description:'라이프와 비행'},
}

export const CARD_IDS = [
'volcano_mouse','living_flame','living_smoke','last_ember','ash_hound','moth_swarm','burning_procession','ash_pirate_ship',
'wave_reader','ebb','ripple_spirit','surging_wave','ash_clearing_rain','high_tide','reverse_current','tsunami',
'seeding_fairy','tree_fairy','heavy_seed','rock_armor_knight','desertification','overgrown_sprout','floating_mountains','grave_digging',
'carrion_crow','corpse_cat','nameless_shadow','blue_black_hound','coffin_warrior','demon_finger','demon_breath','eclipse',
'pegasus_rider','temple_prospect','prophet','cathedral_guard','apostle_pigeon','devotion','holy_mirror_wall','battle_campfire',
] as const
export type CardId = typeof CARD_IDS[number]

export type CardKeyword = 'rush'|'charge'|'windfury'|'flying'|'stealth'
export interface CardBase { artUrl?:string; id:CardId; name:string; cost:number; groups:CardGroupId[]; rulesText:string; visualKey:string; setId:SetId; collectorNumber:string; contentVersion:string }
export interface UnitCard extends CardBase { type:'unit'; attack:number; health:number; keywords?:CardKeyword[] }
export interface SpellCard extends CardBase { type:'spell' }
export type CardDefinition = UnitCard | SpellCard

const getMetadata=(id:CardId)=>{
  const setId:SetId='foundations-001'
  const code=CARD_SETS[setId].code
  const number=String(CARD_IDS.indexOf(id)+1).padStart(3,'0')
  return {setId,collectorNumber:`${code}-${number}`,contentVersion:CONTENT_VERSION}
}
const u=(id:CardId,name:string,cost:number,attack:number,health:number,groups:CardGroupId[],rulesText='',keywords:CardKeyword[]=[],visualKey='rings'):UnitCard=>({id,name,type:'unit',cost,attack,health,groups,rulesText,keywords,visualKey,...getMetadata(id)})
const s=(id:CardId,name:string,cost:number,groups:CardGroupId[],rulesText:string,visualKey='waves'):SpellCard=>({id,name,type:'spell',cost,groups,rulesText,visualKey,...getMetadata(id)})

export const CARDS: Record<CardId,CardDefinition> = {
volcano_mouse:u('volcano_mouse','화산쥐',0,1,1,['fire'],'자신의 마나에 불 카드가 2장 이상일 때만 소환할 수 있다.'),
living_flame:u('living_flame','살아 움직이는 불꽃',1,2,1,['fire']), living_smoke:u('living_smoke','살아 움직이는 연기',2,2,1,['fire'],'각성 — 빈 슬롯이 있다면 소환한다.'),
last_ember:u('last_ember','마지막 불씨',2,1,1,['fire'],'고립 — 질풍과 공격력 +2.'), ash_hound:u('ash_hound','잿빛 들개',2,3,2,['fire'],'돌진',['charge']),
moth_swarm:u('moth_swarm','불나방 무리',3,3,1,['fire'],'기습',['rush']), burning_procession:s('burning_procession','불타는 행렬',3,['fire'],'불 몬스터 수만큼 덱 위를 보고 비용 1 이하 불 몬스터를 소환한다.'),
ash_pirate_ship:u('ash_pirate_ship','잿더미 해적선',3,3,1,['fire','water'],'출현 — 불 공명: 이번 턴 아군 공격력 +2. 물 공명: 다른 몬스터가 셋 이상이면 기습.'),
wave_reader:u('wave_reader','물결을 읽는 자',1,1,1,['water'],'출현 — 물 공명: 덱 위 카드를 유지하거나 묘지로 보낸다.'),
ebb:s('ebb','썰물',2,['water'],'마나에 물 카드만 있을 때 사용. 상대 소진 몬스터를 손으로 되돌린다.'), ripple_spirit:u('ripple_spirit','잔물결 정령',2,1,3,['water']),
surging_wave:u('surging_wave','몰아치는 파도',3,2,2,['water'],'출현 — 덱 위가 물 몬스터라면 출현 없이 소환할 수 있다.'),
ash_clearing_rain:s('ash_clearing_rain','잿더미를 치우는 비',3,['water'],'공격력 혹은 체력이 1인 모든 몬스터를 묘지로 보낸다.'),
high_tide:s('high_tide','밀물',3,['water'],'카드 2장을 뽑는다.'), reverse_current:s('reverse_current','역류',3,['water'],'상대 소진 몬스터 하나를 손으로 되돌린다.'),
tsunami:s('tsunami','쓰나미',2,['earth','water'],'물 공명: 1장 뽑기. 땅 공명: 덱 위를 소진 마나로 놓기.'),
seeding_fairy:u('seeding_fairy','씨 뿌리는 요정',1,1,1,['earth'],'출현 — 덱 위를 소진 마나로 놓는다.'), tree_fairy:u('tree_fairy','나무에 사는 요정',1,0,1,['earth'],'마나에 놓일 때 1장 뽑기. 각성 — 소진 마나로 놓는다.'),
heavy_seed:u('heavy_seed','너무 무거운 씨앗',3,1,3,['earth'],'땅 마나가 3장 이상이면 마나에서 소환할 수 있다.'), rock_armor_knight:u('rock_armor_knight','바위 갑옷 기사',3,2,4,['earth']),
desertification:s('desertification','사막화',4,['earth'],'상대 몬스터 하나를 소진 마나로 놓고, 이 카드를 소진 마나로 놓는다.'),
overgrown_sprout:s('overgrown_sprout','과하게 자라난 새싹',4,['earth'],'땅 마나만 있으면 이번 턴 공격력 1 몬스터의 직접 공격은 라이프를 하나 더 잃게 한다.'),
floating_mountains:u('floating_mountains','떠다니는 산맥',5,5,5,['earth'],'질풍',['windfury']), grave_digging:s('grave_digging','파묘',0,['earth','dark'],'준비된 마나 1장을 묘지로 보내고 묘지 카드 1장을 손으로 되돌린다.'),
carrion_crow:u('carrion_crow','시체를 먹는 까마귀',1,1,1,['dark'],'묘지에 카드가 2장 이상이면 질풍.'), corpse_cat:u('corpse_cat','시체에 숨은 고양이',1,1,1,['dark'],'다른 아군이 있으면 잠행.'),
nameless_shadow:u('nameless_shadow','이름 없는 그림자',2,2,1,['dark'],'고립 — 잠행.'), blue_black_hound:u('blue_black_hound','검푸른 들개',2,4,1,['dark']),
coffin_warrior:u('coffin_warrior','관 속의 전사',3,3,3,['dark'],'손에 있는 동안 어둠 카드가 묘지로 갈 때 비용 1 감소.'), demon_finger:u('demon_finger','악마의 손가락',4,4,4,['dark']),
demon_breath:s('demon_breath','악마의 숨결',5,['dark'],'상대 전장의 체력이 가장 높은 몬스터를 모두 묘지로 보낸다. 각성 — 사용한다.'),
eclipse:s('eclipse','일식',5,['dark','light'],'빛 공명: 전장 전부 소진. 어둠 공명: 소진 몬스터 전부 묘지. 각성 — 전장 전부 소진.'),
pegasus_rider:u('pegasus_rider','페가수스 기마병',1,1,1,['light'],'비행',['flying']), temple_prospect:u('temple_prospect','신전의 유망주',1,1,1,['light'],'출현 — 라이프 한 장을 각성 없이 손으로 가져오고 손 한 장을 라이프로 놓을 수 있다.'),
prophet:u('prophet','예언자',2,2,2,['light'],'전장에 있는 동안 상대 각성은 발동하지 않는다.'), cathedral_guard:u('cathedral_guard','성당 경비병',2,1,4,['light']),
apostle_pigeon:u('apostle_pigeon','사도의 비둘기',3,1,3,['light'],'전장에 있는 동안 각 플레이어는 턴마다 한 번만 공격. 각성 — 빈 슬롯이 있다면 소환.'),
devotion:s('devotion','헌신',3,['light'],'라이프가 2장 이하일 때 사용. 이 카드를 라이프에 뒷면으로 놓는다.'),
holy_mirror_wall:s('holy_mirror_wall','성스러운 거울의 벽',5,['light'],'상대 라이프 한 장을 각성 없이 묘지로 보낸다. 각성 — 발동한다.'),
battle_campfire:s('battle_campfire','전장의 모닥불',2,['fire','light'],'불 공명: 모든 몬스터에 1 피해. 빛 공명: 아군 몬스터 1 회복.'),
}
export const ALL_CARD_IDS=[...CARD_IDS]
export const DEFAULT_DECK:CardId[]=['living_flame','living_flame','living_smoke','last_ember','ash_hound','moth_swarm','pegasus_rider','temple_prospect','prophet','cathedral_guard','battle_campfire','holy_mirror_wall']
export const getCard=(id:CardId)=>CARDS[id]
export const isCardId=(v:unknown):v is CardId=>typeof v==='string' && v in CARDS

// ===== Item System =====
export type ItemTag = 'bone' | 'ore' | 'coin' | 'dino';

export type ItemId =
  | 'bone_fragment'
  | 'ore'
  | 'ancient_coin'
  | 'dino_skull'
  | 'dino_body'
  | 'dino_tail';

export interface ItemDef {
  id: ItemId;
  name: string;
  emoji: string;
  tags: ItemTag[];
  baseValue: number;
}

export const ITEM_DEFS: Record<ItemId, ItemDef> = {
  bone_fragment: { id: 'bone_fragment', name: '骨头碎片', emoji: '🦴', tags: ['bone'], baseValue: 10 },
  ore:           { id: 'ore',           name: '矿石',     emoji: '🪨', tags: ['ore'],  baseValue: 15 },
  ancient_coin:  { id: 'ancient_coin',  name: '古钱币',   emoji: '🪙', tags: ['coin'], baseValue: 20 },
  dino_skull:    { id: 'dino_skull',    name: '恐龙头骨', emoji: '💀', tags: ['dino'], baseValue: 40 },
  dino_body:     { id: 'dino_body',     name: '恐龙身体', emoji: '🦕', tags: ['dino'], baseValue: 35 },
  dino_tail:     { id: 'dino_tail',     name: '恐龙尾巴', emoji: '🐉', tags: ['dino'], baseValue: 30 },
};

export interface ItemInstance {
  instanceId: string;
  defId: ItemId;
}

// ===== Tool System =====
export type ToolId =
  | 'dig_speed'
  | 'dig_bonus_coin'
  | 'storage_value_up'
  | 'set_bonus'
  | 'cart_expand'
  | 'storage_expand';

export interface ToolDef {
  id: ToolId;
  name: string;
  emoji: string;
  description: string;
  cost: number;
}

export const TOOL_DEFS: Record<ToolId, ToolDef> = {
  dig_speed:        { id: 'dig_speed',        name: '挖掘加速',       emoji: '⚡', description: '工人挖掘速度 +20%',           cost: 30 },
  dig_bonus_coin:   { id: 'dig_bonus_coin',   name: '挖掘金币',       emoji: '💰', description: '每次挖掘额外 +1 金币',          cost: 25 },
  storage_value_up: { id: 'storage_value_up', name: '存储增值',       emoji: '📦', description: '存储物品每轮价值 +10%',         cost: 40 },
  set_bonus:        { id: 'set_bonus',        name: '套装强化',       emoji: '✨', description: '套装额外 +50% 价值加成',        cost: 50 },
  cart_expand:      { id: 'cart_expand',      name: '扩大车厢',       emoji: '🚗', description: '车厢 +2 格',                  cost: 35 },
  storage_expand:   { id: 'storage_expand',   name: '扩大存储',       emoji: '🏚️', description: '存储 +2 格',                  cost: 35 },
};

// ===== Map =====
export type CellType = 'dirt' | 'rock' | 'empty';

export interface MapCell {
  type: CellType;
  item?: ItemInstance;
}

// ===== Grid Slot =====
export interface GridSlot {
  item: ItemInstance | null;
}

// ===== Worker =====
export interface Worker {
  id: number;
  row: number;
  col: number;
  ticksUntilDig: number;
}

// ===== Shop =====
export interface ShopItem {
  toolId: ToolId;
  purchased: boolean;
}

// ===== Game State =====
export interface GameState {
  round: number;           // 1-6
  timeLeft: number;        // seconds
  coins: number;
  phase: 'playing' | 'rent_due' | 'shop' | 'game_over' | 'victory';

  map: MapCell[][];        // 6x6
  workers: Worker[];       // 2 workers

  storage: GridSlot[];     // 4x4 = 16 slots
  cart: GridSlot[];        // 4x3 = 12 slots (can expand)
  tools: GridSlot[];       // 3 slots

  cartCols: number;        // default 3
  storageCols: number;     // default 4

  ownedTools: ToolId[];    // equipped tools (can have duplicates)
  shop: ShopItem[];
  shopBoughtThisRound: number;

  selectedItem: { source: 'storage' | 'cart' | 'tools'; index: number } | null;

  logs: string[];
  storageValueBonus: number; // cumulative from storage_value_up tool (per round)
}

export const RENT_SCHEDULE = [50, 100, 180, 300, 450, 700];
export const MAP_SIZE = 6;
export const STORAGE_ROWS = 4;
export const STORAGE_COLS = 4;
export const CART_ROWS = 4;
export const CART_COLS_DEFAULT = 3;
export const TOOL_SLOTS = 3;
export const DIG_INTERVAL_BASE = 3000; // ms
export const TIMER_DEFAULT = 90;
export const TIMER_TEST = 30;

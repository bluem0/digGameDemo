import type {
  GameState,
  MapCell,
  GridSlot,
  Worker,
  ItemInstance,
  ItemId,
  ToolId,
  ShopItem,
} from './types';
import {
  ITEM_DEFS,
  TOOL_DEFS,
  RENT_SCHEDULE,
  MAP_SIZE,
  STORAGE_ROWS,
  STORAGE_COLS,
  CART_ROWS,
  CART_COLS_DEFAULT,
  TOOL_SLOTS,
  TIMER_DEFAULT,
} from './types';

let instanceCounter = 0;
function newId(): string {
  return `item_${++instanceCounter}`;
}

// ===== Map generation =====
function randomItem(): ItemInstance | undefined {
  const r = Math.random();
  // 30% chance of an item in a dirt cell
  if (r > 0.30) return undefined;
  const items: ItemId[] = ['bone_fragment', 'ore', 'ancient_coin', 'dino_skull', 'dino_body', 'dino_tail'];
  const weights = [35, 30, 20, 5, 5, 5];
  let total = 0;
  const rand = Math.random() * 100;
  for (let i = 0; i < items.length; i++) {
    total += weights[i];
    if (rand < total) return { instanceId: newId(), defId: items[i] };
  }
  return { instanceId: newId(), defId: 'bone_fragment' };
}

function generateMap(): MapCell[][] {
  const map: MapCell[][] = [];
  for (let r = 0; r < MAP_SIZE; r++) {
    const row: MapCell[] = [];
    for (let c = 0; c < MAP_SIZE; c++) {
      const isRock = Math.random() < 0.15;
      if (isRock) {
        row.push({ type: 'rock' });
      } else {
        const item = randomItem();
        row.push({ type: 'dirt', item });
      }
    }
    map.push(row);
  }
  return map;
}

function makeSlots(count: number): GridSlot[] {
  return Array.from({ length: count }, () => ({ item: null }));
}

function pickShop(): ShopItem[] {
  const allTools: ToolId[] = Object.keys(TOOL_DEFS) as ToolId[];
  const shuffled = [...allTools].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map((toolId) => ({ toolId, purchased: false }));
}

export function initGame(timerSeconds: number = TIMER_DEFAULT): GameState {
  const map = generateMap();
  // Place 2 workers on separate dirt cells
  const dirtCells: [number, number][] = [];
  for (let r = 0; r < MAP_SIZE; r++) {
    for (let c = 0; c < MAP_SIZE; c++) {
      if (map[r][c].type !== 'rock') dirtCells.push([r, c]);
    }
  }
  const w1pos = dirtCells[Math.floor(Math.random() * dirtCells.length)];
  let w2pos = dirtCells[Math.floor(Math.random() * dirtCells.length)];
  while (w2pos[0] === w1pos[0] && w2pos[1] === w1pos[1]) {
    w2pos = dirtCells[Math.floor(Math.random() * dirtCells.length)];
  }
  const workers: Worker[] = [
    { id: 1, row: w1pos[0], col: w1pos[1], ticksUntilDig: 1 },
    { id: 2, row: w2pos[0], col: w2pos[1], ticksUntilDig: 2 },
  ];

  return {
    round: 1,
    timeLeft: timerSeconds,
    coins: 60,
    phase: 'playing',
    map,
    workers,
    storage: makeSlots(STORAGE_ROWS * STORAGE_COLS),
    cart: makeSlots(CART_ROWS * CART_COLS_DEFAULT),
    tools: makeSlots(TOOL_SLOTS),
    cartCols: CART_COLS_DEFAULT,
    storageCols: STORAGE_COLS,
    ownedTools: [],
    shop: pickShop(),
    shopBoughtThisRound: 0,
    selectedItem: null,
    logs: ['游戏开始！挖掘物品并在租金到期前发车赚钱。'],
    storageValueBonus: 0,
  };
}

// ===== Value calculation =====
function calcSellValue(items: ItemInstance[], state: GameState): number {
  if (items.length === 0) return 0;

  const tagCounts: Record<string, number> = {};
  for (const inst of items) {
    const def = ITEM_DEFS[inst.defId];
    for (const tag of def.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  // Check dino set completion
  const hasDinoSet =
    items.some((i) => i.defId === 'dino_skull') &&
    items.some((i) => i.defId === 'dino_body') &&
    items.some((i) => i.defId === 'dino_tail');

  // Check tool bonuses
  const hasSetBonus = state.ownedTools.includes('set_bonus');

  let total = 0;
  for (const inst of items) {
    let val = ITEM_DEFS[inst.defId].baseValue;

    // Same tag >=2 bonus: +30%
    const def = ITEM_DEFS[inst.defId];
    let tagBonus = false;
    for (const tag of def.tags) {
      if (tagCounts[tag] >= 2) {
        tagBonus = true;
        break;
      }
    }
    if (tagBonus) val *= 1.3;

    // Dino set bonus: +100%
    if (hasDinoSet && def.tags.includes('dino')) {
      val *= 2.0;
    }

    // Tool set_bonus: extra +50% on set bonuses
    if (hasSetBonus && (tagBonus || hasDinoSet)) {
      val *= 1.5;
    }

    total += val;
  }

  return Math.floor(total);
}

export function calcCartValue(state: GameState): number {
  const cartItems = state.cart.filter((s) => s.item !== null).map((s) => s.item!);
  return calcSellValue(cartItems, state);
}

export function calcStorageValue(state: GameState): number {
  const storageItems = state.storage.filter((s) => s.item !== null).map((s) => s.item!);
  let base = calcSellValue(storageItems, state);
  // Apply storage_value_up bonus per round
  if (state.ownedTools.includes('storage_value_up')) {
    base = Math.floor(base * (1 + state.storageValueBonus));
  }
  return base;
}

// ===== Worker digging tick =====
function findNearbyDirtWithItem(map: MapCell[][], row: number, col: number): [number, number] | null {
  const dirs = [
    [0, 1], [1, 0], [0, -1], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  // shuffle dirs
  const shuffled = dirs.sort(() => Math.random() - 0.5);
  for (const [dr, dc] of shuffled) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < MAP_SIZE && nc >= 0 && nc < MAP_SIZE) {
      if (map[nr][nc].type === 'dirt') return [nr, nc];
    }
  }
  return null;
}

export function tickWorkers(state: GameState): GameState {
  if (state.phase !== 'playing') return state;

  const newMap = state.map.map((row) => row.map((cell) => ({ ...cell })));
  const newStorage = [...state.storage.map((s) => ({ ...s }))];
  const newWorkers = [...state.workers.map((w) => ({ ...w }))];
  const newLogs = [...state.logs];
  let newCoins = state.coins;

  const hasBonusCoin = state.ownedTools.includes('dig_bonus_coin');

  for (let i = 0; i < newWorkers.length; i++) {
    const w = newWorkers[i];
    w.ticksUntilDig -= 1;
    if (w.ticksUntilDig > 0) continue;

    w.ticksUntilDig = 1; // will be reset below

    // Find a target cell to dig
    const target = findNearbyDirtWithItem(newMap, w.row, w.col);
    if (target) {
      const [tr, tc] = target;
      const cell = newMap[tr][tc];
      if (cell.item) {
        // Try to add to storage
        const emptySlot = newStorage.findIndex((s) => s.item === null);
        if (emptySlot >= 0) {
          newStorage[emptySlot] = { item: cell.item };
          newLogs.unshift(`工人${w.id} 挖出了 ${ITEM_DEFS[cell.item.defId].emoji}${ITEM_DEFS[cell.item.defId].name}`);
          if (hasBonusCoin) {
            newCoins += 1;
          }
          cell.item = undefined;
          cell.type = 'empty';
          w.row = tr;
          w.col = tc;
        } else {
          newLogs.unshift(`存储已满！工人${w.id} 无法放置物品。`);
        }
      } else {
        // Move to the empty dirt cell
        cell.type = 'empty';
        w.row = tr;
        w.col = tc;
      }
    } else {
      // No nearby dirt, stay put
    }
  }

  return {
    ...state,
    map: newMap,
    storage: newStorage,
    workers: newWorkers,
    coins: newCoins,
    logs: newLogs.slice(0, 20),
  };
}

// ===== Cart operations =====
export function sendCart(state: GameState): GameState {
  const cartItems = state.cart.filter((s) => s.item !== null).map((s) => s.item!);
  if (cartItems.length === 0) {
    return { ...state, logs: ['没有物品可以发车！', ...state.logs].slice(0, 20) };
  }
  const earned = calcCartValue(state);
  const newCart = state.cart.map(() => ({ item: null as ItemInstance | null }));
  const newLogs = [`发车！售出 ${cartItems.length} 件物品，获得 ${earned} 金币。`, ...state.logs].slice(0, 20);
  return {
    ...state,
    coins: state.coins + earned,
    cart: newCart,
    logs: newLogs,
  };
}

// ===== Rent handling =====
export function payRent(state: GameState): GameState {
  const rent = RENT_SCHEDULE[state.round - 1];
  let newCoins = state.coins;
  const newStorage = [...state.storage.map((s) => ({ ...s }))];
  const newLogs = [...state.logs];

  if (newCoins >= rent) {
    newCoins -= rent;
    newLogs.unshift(`第 ${state.round} 轮：缴纳租金 ${rent} 金币。`);
  } else {
    // Auto-sell from storage at 50% value
    const deficit = rent - newCoins;
    const storageItems = newStorage
      .map((s, idx) => ({ slot: idx, item: s.item }))
      .filter((s) => s.item !== null)
      .sort((a, b) => ITEM_DEFS[b.item!.defId].baseValue - ITEM_DEFS[a.item!.defId].baseValue);

    let gained = 0;
    for (const s of storageItems) {
      if (gained >= deficit) break;
      const val = Math.floor(ITEM_DEFS[s.item!.defId].baseValue * 0.5);
      gained += val;
      newStorage[s.slot] = { item: null };
      newLogs.unshift(`强制出售 ${ITEM_DEFS[s.item!.defId].name} 获得 ${val} 金币。`);
    }

    newCoins = newCoins + gained - rent;

    if (newCoins < 0) {
      newLogs.unshift(`金币不足以缴纳租金！游戏失败。`);
      return {
        ...state,
        coins: 0,
        storage: newStorage,
        logs: newLogs.slice(0, 20),
        phase: 'game_over',
      };
    } else {
      newLogs.unshift(`金币不足，强制出售补差，缴纳租金 ${rent} 金币。`);
    }
  }

  // Check victory
  if (state.round >= 6) {
    newLogs.unshift('恭喜！你通过了所有 6 轮租金考验，游戏胜利！');
    return {
      ...state,
      coins: newCoins,
      storage: newStorage,
      logs: newLogs.slice(0, 20),
      phase: 'victory',
    };
  }

  // Update storage value bonus accumulation
  const newStorageValueBonus = state.ownedTools.includes('storage_value_up')
    ? state.storageValueBonus + 0.1
    : state.storageValueBonus;

  return {
    ...state,
    coins: newCoins,
    storage: newStorage,
    logs: newLogs.slice(0, 20),
    phase: 'shop',
    storageValueBonus: newStorageValueBonus,
  };
}

export function startNextRound(state: GameState, timerSeconds: number): GameState {
  const newMap = generateMap();
  const dirtCells: [number, number][] = [];
  for (let r = 0; r < MAP_SIZE; r++) {
    for (let c = 0; c < MAP_SIZE; c++) {
      if (newMap[r][c].type !== 'rock') dirtCells.push([r, c]);
    }
  }
  const w1pos = dirtCells[Math.floor(Math.random() * dirtCells.length)];
  let w2pos = dirtCells[Math.floor(Math.random() * dirtCells.length)];
  while (w2pos[0] === w1pos[0] && w2pos[1] === w1pos[1]) {
    w2pos = dirtCells[Math.floor(Math.random() * dirtCells.length)];
  }

  const newWorkers: Worker[] = [
    { id: 1, row: w1pos[0], col: w1pos[1], ticksUntilDig: 1 },
    { id: 2, row: w2pos[0], col: w2pos[1], ticksUntilDig: 2 },
  ];

  return {
    ...state,
    round: state.round + 1,
    timeLeft: timerSeconds,
    phase: 'playing',
    map: newMap,
    workers: newWorkers,
    shop: pickShop(),
    shopBoughtThisRound: 0,
    logs: [`第 ${state.round + 1} 轮开始！租金目标：${RENT_SCHEDULE[state.round]} 金币。`, ...state.logs].slice(0, 20),
  };
}

// ===== Shop purchase =====
export function buyTool(state: GameState, shopIndex: number): GameState {
  const shopItem = state.shop[shopIndex];
  if (!shopItem || shopItem.purchased) return state;
  if (state.shopBoughtThisRound >= 2) {
    return { ...state, logs: ['本轮已购买上限（2件）！', ...state.logs].slice(0, 20) };
  }

  const def = TOOL_DEFS[shopItem.toolId];
  if (state.coins < def.cost) {
    return { ...state, logs: [`金币不足！${def.name} 需要 ${def.cost} 金币。`, ...state.logs].slice(0, 20) };
  }

  // Check if there's a free tool slot
  const freeToolSlot = state.tools.findIndex((s) => s.item === null);
  if (freeToolSlot < 0) {
    return { ...state, logs: ['道具栏已满！', ...state.logs].slice(0, 20) };
  }

  const newTools = state.tools.map((s) => ({ ...s }));
  // Tool slots use a sentinel item (instanceId prefixed with "tool_") to mark the slot as occupied.
  // The actual tool effect is tracked via ownedTools; defId is a placeholder and not used for tools.
  newTools[freeToolSlot] = { item: { instanceId: `tool_${shopItem.toolId}`, defId: 'bone_fragment' } };

  const newShop = state.shop.map((s, i) => i === shopIndex ? { ...s, purchased: true } : s);
  const newOwnedTools = [...state.ownedTools, shopItem.toolId];

  // Handle special tool effects
  let newCartCols = state.cartCols;
  let newStorageCols = state.storageCols;
  let newCart = state.cart;
  let newStorage = state.storage;

  if (shopItem.toolId === 'cart_expand') {
    newCartCols = state.cartCols + 2;
    // Add 2 more columns * CART_ROWS slots
    newCart = [...state.cart, ...makeSlots(CART_ROWS * 2)];
    newTools[freeToolSlot] = { item: null }; // tool consumed
  } else if (shopItem.toolId === 'storage_expand') {
    newStorageCols = state.storageCols + 2;
    newStorage = [...state.storage, ...makeSlots(STORAGE_ROWS * 2)];
    newTools[freeToolSlot] = { item: null };
  } else {
    newTools[freeToolSlot] = { item: { instanceId: `tool_${shopItem.toolId}_${newId()}`, defId: 'bone_fragment' } };
  }

  return {
    ...state,
    coins: state.coins - def.cost,
    tools: newTools,
    shop: newShop,
    shopBoughtThisRound: state.shopBoughtThisRound + 1,
    ownedTools: newOwnedTools,
    cartCols: newCartCols,
    storageCols: newStorageCols,
    cart: newCart,
    storage: newStorage,
    logs: [`购买了 ${def.emoji}${def.name}！花费 ${def.cost} 金币。`, ...state.logs].slice(0, 20),
  };
}

// ===== Item movement =====
export type ItemSource = 'storage' | 'cart' | 'tools';

export function moveItem(
  state: GameState,
  fromSource: ItemSource,
  fromIndex: number,
  toSource: ItemSource,
  toIndex: number
): GameState {
  if (fromSource === toSource && fromIndex === toIndex) return state;

  const getSlots = (src: ItemSource) => {
    if (src === 'storage') return state.storage.map((s) => ({ ...s }));
    if (src === 'cart') return state.cart.map((s) => ({ ...s }));
    return state.tools.map((s) => ({ ...s }));
  };

  const fromSlots = getSlots(fromSource);
  const toSlots = fromSource === toSource ? fromSlots : getSlots(toSource);

  const fromItem = fromSlots[fromIndex]?.item ?? null;
  const toItem = toSlots[toIndex]?.item ?? null;

  if (!fromItem) return state;

  // Swap or move
  if (fromSource === toSource) {
    fromSlots[fromIndex] = { item: toItem };
    fromSlots[toIndex] = { item: fromItem };
  } else {
    fromSlots[fromIndex] = { item: toItem };
    toSlots[toIndex] = { item: fromItem };
  }

  return {
    ...state,
    storage: fromSource === 'storage' ? fromSlots : toSource === 'storage' ? toSlots : state.storage,
    cart: fromSource === 'cart' ? fromSlots : toSource === 'cart' ? toSlots : state.cart,
    tools: fromSource === 'tools' ? fromSlots : toSource === 'tools' ? toSlots : state.tools,
    selectedItem: null,
  };
}

export function sortGrid(slots: GridSlot[]): GridSlot[] {
  const items = slots.filter((s) => s.item !== null).map((s) => s.item!);
  // Sort by defId for grouping
  items.sort((a, b) => a.defId.localeCompare(b.defId));
  return slots.map((_, i) => ({ item: items[i] ?? null }));
}

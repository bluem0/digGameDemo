import { useEffect, useRef, useState, useCallback } from 'react';
import type { GameState, GridSlot, ToolId } from './types';
import {
  ITEM_DEFS,
  TOOL_DEFS,
  RENT_SCHEDULE,
  MAP_SIZE,
  TIMER_DEFAULT,
  TIMER_TEST,
} from './types';
import type { ItemSource } from './gameEngine';
import {
  initGame,
  tickWorkers,
  sendCart,
  payRent,
  startNextRound,
  buyTool,
  moveItem,
  sortGrid,
  calcCartValue,
} from './gameEngine';
import './App.css';

const DIG_INTERVAL_MS = 3000;

function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// ===== Sub-components =====

function MapGrid({ state }: { state: GameState }) {
  return (
    <div className="map-container">
      <h3>🗺️ 挖掘地图</h3>
      <div className="map-grid" style={{ gridTemplateColumns: `repeat(${MAP_SIZE}, 1fr)` }}>
        {state.map.map((row, r) =>
          row.map((cell, c) => {
            const isWorker = state.workers.some((w) => w.row === r && w.col === c);
            let cellClass = 'map-cell';
            if (cell.type === 'rock') cellClass += ' rock';
            else if (cell.type === 'empty') cellClass += ' empty';
            else cellClass += ' dirt';

            return (
              <div key={`${r}-${c}`} className={cellClass} title={cell.item ? ITEM_DEFS[cell.item.defId].name : cell.type}>
                {isWorker ? <span className="worker">⛏️</span> : cell.item ? <span>{ITEM_DEFS[cell.item.defId].emoji}</span> : null}
              </div>
            );
          })
        )}
      </div>
      <div className="workers-info">
        {state.workers.map((w) => <span key={w.id} className="worker-badge">工人{w.id}: ({w.row},{w.col})</span>)}
      </div>
    </div>
  );
}

interface GridProps {
  title: string;
  slots: GridSlot[];
  cols: number;
  source: ItemSource;
  selectedItem: GameState['selectedItem'];
  onSelect: (source: ItemSource, index: number) => void;
  onSort?: () => void;
  extra?: React.ReactNode;
}

function ItemGrid({ title, slots, cols, source, selectedItem, onSelect, onSort, extra }: GridProps) {
  return (
    <div className="grid-container">
      <div className="grid-header">
        <h3>{title}</h3>
        {onSort && <button className="btn-small" onClick={onSort}>整理</button>}
        {extra}
      </div>
      <div className="item-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {slots.map((slot, i) => {
          const isSelected = selectedItem?.source === source && selectedItem?.index === i;
          const isTargetable = selectedItem !== null && !isSelected;
          return (
            <div
              key={i}
              className={`item-slot${isSelected ? ' selected' : ''}${isTargetable ? ' targetable' : ''}${slot.item ? ' filled' : ' empty-slot'}`}
              onClick={() => onSelect(source, i)}
              title={slot.item ? ITEM_DEFS[slot.item.defId].name : '空'}
            >
              {slot.item ? (
                <span className="item-emoji">{ITEM_DEFS[slot.item.defId].emoji}</span>
              ) : (
                <span className="slot-empty">·</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShopPanel({ state, onBuy }: { state: GameState; onBuy: (idx: number) => void }) {
  return (
    <div className="shop-container">
      <h3>�� 商店 <small>(本轮已买: {state.shopBoughtThisRound}/2)</small></h3>
      <div className="shop-items">
        {state.shop.map((item, i) => {
          const def = TOOL_DEFS[item.toolId];
          const canBuy = !item.purchased && state.shopBoughtThisRound < 2 && state.coins >= def.cost;
          const hasToolSlot = state.tools.some((s) => s.item === null) || item.toolId === 'cart_expand' || item.toolId === 'storage_expand';
          return (
            <div key={i} className={`shop-item${item.purchased ? ' purchased' : ''}`}>
              <span className="shop-emoji">{def.emoji}</span>
              <div className="shop-info">
                <div className="shop-name">{def.name}</div>
                <div className="shop-desc">{def.description}</div>
                <div className="shop-cost">💰 {def.cost}</div>
              </div>
              <button
                className="btn-buy"
                onClick={() => onBuy(i)}
                disabled={item.purchased || !canBuy || !hasToolSlot}
              >
                {item.purchased ? '已购' : '购买'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LogPanel({ logs }: { logs: string[] }) {
  return (
    <div className="log-container">
      <h3>📋 日志</h3>
      <div className="log-list">
        {logs.map((log, i) => (
          <div key={i} className="log-entry">{log}</div>
        ))}
      </div>
    </div>
  );
}

// ===== Main App =====
export default function App() {
  const [timerSeconds, setTimerSeconds] = useState(TIMER_DEFAULT);
  const [state, setState] = useState<GameState>(() => initGame(TIMER_DEFAULT));
  const [isTest, setIsTest] = useState(false);

  const isPlaying = state.phase === 'playing';

  // Countdown timer
  useInterval(
    useCallback(() => {
      setState((prev) => {
        if (prev.phase !== 'playing') return prev;
        if (prev.timeLeft <= 1) {
          // Time's up - pay rent
          return payRent(prev);
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, []),
    isPlaying ? 1000 : null
  );

  // Worker dig ticks
  useInterval(
    useCallback(() => {
      setState((prev) => tickWorkers(prev));
    }, []),
    isPlaying ? DIG_INTERVAL_MS : null
  );

  const handleSelect = useCallback((source: ItemSource, index: number) => {
    setState((prev) => {
      if (prev.selectedItem === null) {
        // Select item only if slot has item
        const slots = source === 'storage' ? prev.storage : source === 'cart' ? prev.cart : prev.tools;
        if (!slots[index]?.item) return prev;
        return { ...prev, selectedItem: { source, index } };
      } else {
        // Move item
        const from = prev.selectedItem;
        return moveItem(prev, from.source, from.index, source, index);
      }
    });
  }, []);

  const handleSort = useCallback((source: ItemSource) => {
    setState((prev) => {
      if (source === 'storage') {
        return { ...prev, storage: sortGrid(prev.storage) };
      } else if (source === 'cart') {
        return { ...prev, cart: sortGrid(prev.cart) };
      }
      return prev;
    });
  }, []);

  const handleSendCart = useCallback(() => {
    setState((prev) => sendCart(prev));
  }, []);

  const handlePayRent = useCallback(() => {
    setState((prev) => payRent(prev));
  }, []);

  const handleNextRound = useCallback(() => {
    setState((prev) => startNextRound(prev, timerSeconds));
  }, [timerSeconds]);

  const handleBuyTool = useCallback((idx: number) => {
    setState((prev) => buyTool(prev, idx));
  }, []);

  const handleRestart = useCallback(() => {
    setState(initGame(timerSeconds));
  }, [timerSeconds]);

  const handleToggleTimer = useCallback(() => {
    const newSecs = isTest ? TIMER_DEFAULT : TIMER_TEST;
    setIsTest(!isTest);
    setTimerSeconds(newSecs);
    setState((prev) => ({ ...prev, timeLeft: newSecs }));
  }, [isTest]);

  const nextRent = state.round <= 6 ? RENT_SCHEDULE[state.round - 1] : 0;
  const cartValue = calcCartValue(state);
  const storageCount = state.storage.filter((s) => s.item !== null).length;

  // Tool names for display
  const toolNames: Record<ToolId, string> = {
    dig_speed: '⚡挖速', dig_bonus_coin: '💰挖金', storage_value_up: '📦增值',
    set_bonus: '✨套装', cart_expand: '🚗扩车', storage_expand: '🏚️扩储',
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1>🦕 挖掘租约</h1>
        <div className="header-stats">
          <div className="stat">🔄 第 {state.round}/6 轮</div>
          <div className={`stat timer${state.timeLeft <= 15 ? ' urgent' : ''}`}>
            ⏱️ {state.timeLeft}s
          </div>
          <div className="stat">�� {state.coins} 金币</div>
          <div className="stat">🏠 下次租金: {nextRent}</div>
          <div className="stat">🛒 车内价值: {cartValue}</div>
          <div className="stat">📦 存储: {storageCount}/{state.storage.length}</div>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={handleToggleTimer}>
            {isTest ? `切换 ${TIMER_DEFAULT}s` : `测试 ${TIMER_TEST}s`}
          </button>
          <button className="btn" onClick={handleRestart}>重新开始</button>
        </div>
      </header>

      {/* Owned tools */}
      {state.ownedTools.length > 0 && (
        <div className="owned-tools">
          已激活道具: {state.ownedTools.map((t, i) => (
            <span key={i} className="tool-badge">{toolNames[t]}</span>
          ))}
        </div>
      )}

      {/* Game over / victory overlay */}
      {(state.phase === 'game_over' || state.phase === 'victory') && (
        <div className="overlay">
          <div className="overlay-box">
            <h2>{state.phase === 'victory' ? '🎉 游戏胜利！' : '💀 游戏失败'}</h2>
            <p>{state.phase === 'victory' ? `恭喜通关！剩余 ${state.coins} 金币。` : '租金不足，游戏结束。'}</p>
            <button className="btn btn-large" onClick={handleRestart}>再来一局</button>
          </div>
        </div>
      )}

      {/* Shop overlay */}
      {state.phase === 'shop' && (
        <div className="overlay">
          <div className="overlay-box shop-overlay">
            <h2>🛒 商店</h2>
            <p>第 {state.round} 轮结束，剩余 {state.coins} 金币</p>
            <ShopPanel state={state} onBuy={handleBuyTool} />
            <button className="btn btn-large" onClick={handleNextRound}>进入下一轮</button>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="main-layout">
        {/* Left: Map */}
        <div className="left-panel">
          <MapGrid state={state} />
          <div className="action-buttons">
            <button className="btn btn-primary" onClick={handleSendCart} disabled={!isPlaying}>
              🚗 发车出售 (+{cartValue})
            </button>
            <button className="btn btn-warning" onClick={handlePayRent} disabled={!isPlaying}>
              �� 提前缴租 ({nextRent})
            </button>
          </div>
        </div>

        {/* Center: Grids */}
        <div className="center-panel">
          <ItemGrid
            title={`📦 存储 (${state.storageCols}×${state.storage.length / state.storageCols})`}
            slots={state.storage}
            cols={state.storageCols}
            source="storage"
            selectedItem={state.selectedItem}
            onSelect={handleSelect}
            onSort={() => handleSort('storage')}
          />
          <ItemGrid
            title={`🚗 车厢 (${state.cartCols}×${Math.ceil(state.cart.length / state.cartCols)})`}
            slots={state.cart}
            cols={state.cartCols}
            source="cart"
            selectedItem={state.selectedItem}
            onSelect={handleSelect}
            onSort={() => handleSort('cart')}
          />
          <ItemGrid
            title="🔧 道具栏 (3格)"
            slots={state.tools}
            cols={3}
            source="tools"
            selectedItem={state.selectedItem}
            onSelect={handleSelect}
          />
          {state.selectedItem && (
            <div className="selection-hint">
              已选中物品，点击目标位置放置（或点击自身取消）
            </div>
          )}
        </div>

        {/* Right: Shop + Log */}
        <div className="right-panel">
          <ShopPanel state={state} onBuy={handleBuyTool} />
          <LogPanel logs={state.logs} />
        </div>
      </div>
    </div>
  );
}

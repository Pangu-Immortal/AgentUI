/**
 * 素材瓦片配置 - TileConfig.ts
 *
 * 定义 Kenney CC0 素材包中每个 tile 的语义映射：
 * - URBAN_TILES: RPG Urban Pack (27x18 grid, 16x16px per tile)
 * - DUNGEON_TILES: Tiny Dungeon Pack (12x11 grid)
 * - TOWN_TILES: Tiny Town Pack (12x11 grid)
 *
 * 素材来源：https://kenney.nl (CC0 公共领域，免费商用)
 */

/** 瓦片大小（像素） */
export const TILE_SIZE = 16

/** 渲染缩放倍数（16px → 48px 显示） */
export const TILE_SCALE = 3

/** 素材包路径（相对于 public/） */
export const ASSET_PATHS = {
  urban: '/assets/kenney-urban/Tilemap/tilemap_packed.png',       // RPG Urban Pack
  dungeon: '/assets/kenney-dungeon/Tilemap/tilemap_packed.png',   // Tiny Dungeon
  town: '/assets/kenney-town/Tilemap/tilemap_packed.png',         // Tiny Town
} as const

/** 每个素材包的列数（用于计算 tile 坐标） */
export const SHEET_COLS = {
  urban: 27,    // 432/16 = 27 列
  dungeon: 12,  // 12 列
  town: 12,     // 12 列
} as const

// ══════════════════════════════════════════════
//  RPG Urban Pack — 角色精灵（cols 23-26）
// ══════════════════════════════════════════════

/**
 * 角色精灵 tile 索引（Urban Pack）
 * 每个角色有 4 方向 x 4 帧行走动画
 * 排列规则：每 4 行为一个角色（向下/向上/向左/向右）
 * 每行 4 帧：idle, walk1, walk2, walk3
 */
export const CHARACTER_TILES = {
  // 角色 A（棕发女性）— 行 0-3
  charA_front:  [23, 24, 25, 26],     // 向下（面向屏幕）4帧
  charA_back:   [50, 51, 52, 53],     // 向上 4帧
  charA_left:   [77, 78, 79, 80],     // 向左 4帧
  charA_right:  [104, 105, 106, 107], // 向右 4帧

  // 角色 B（红发）— 行 4-7
  charB_front:  [131, 132, 133, 134],
  charB_back:   [158, 159, 160, 161],
  charB_left:   [185, 186, 187, 188],
  charB_right:  [212, 213, 214, 215],

  // 角色 C（金发）— 行 8-11
  charC_front:  [239, 240, 241, 242],
  charC_back:   [266, 267, 268, 269],
  charC_left:   [293, 294, 295, 296],
  charC_right:  [319, 320, 321, 322],

  // 角色 D（深色）— 行 12-15
  charD_front:  [345, 346, 347, 348],
  charD_back:   [372, 373, 374, 375],
  charD_left:   [399, 400, 401, 402],
  charD_right:  [426, 427, 428, 429],
} as const

/** 9 个 Agent 的正面 idle tile（从 4 个角色变体中分配） */
export const AGENT_IDLE_TILES: number[] = [
  23,   // 小浩仔  → 角色A
  131,  // 安卓仔  → 角色B
  239,  // 苹果仔  → 角色C
  345,  // 前端仔  → 角色D
  24,   // 后端仔  → 角色A 帧2
  132,  // 测试仔  → 角色B 帧2
  240,  // 运维仔  → 角色C 帧2
  346,  // 设计仔  → 角色D 帧2
  25,   // 产品仔  → 角色A 帧3
]

// ══════════════════════════════════════════════
//  RPG Urban Pack — 环境素材
// ══════════════════════════════════════════════

export const URBAN_TILES = {
  // 地板 — 浅色室内地板
  floor_beige1: 54,    // 米色地板1
  floor_beige2: 55,    // 米色地板2
  floor_beige3: 56,    // 米色地板3
  floor_gray1:  8,     // 灰色地板（人行道风格）
  floor_gray2:  9,     // 灰色地板

  // 树木 / 绿植
  tree_green1:  232,   // 绿色灌木（小）
  tree_green2:  233,   // 绿树（中）
  tree_green3:  234,   // 绿树（大）
  tree_big_top: 235,   // 大树树冠（上）
  tree_big_bot: 262,   // 大树树干（下）
  tree_pine:    259,   // 松树

  // 家具 / 城市元素
  bench_h:      224,   // 横向长椅
  bench_v:      250,   // 纵向长椅
  lamp_post:    169,   // 路灯
  trash_bin:    168,   // 垃圾桶

  // 车辆（装饰）
  car_red:      393,   // 红色车
  car_yellow:   394,   // 黄色出租车
  car_green:    421,   // 绿色车
} as const

// ══════════════════════════════════════════════
//  Tiny Dungeon — 室内家具
// ══════════════════════════════════════════════

export const DUNGEON_TILES = {
  table_wood:   63,    // 木桌
  chair:        66,    // 椅子（桶状）
  bookshelf1:   42,    // 书架（上）
  bookshelf2:   44,    // 书架（满）
  chest_closed: 34,    // 箱子（关）
  chest_open:   35,    // 箱子（开）
  barrel:       67,    // 木桶
  candle:       71,    // 蜡烛/灯
  skull:        120,   // 骷髅（Bug 角落装饰）
  potion_green: 127,   // 绿药水
  potion_red:   128,   // 红药水

  // 小怪物 / 宠物候选
  slime_green:  108,   // 绿色史莱姆（宠物）
  slime_red:    109,   // 红色史莱姆
  ghost:        110,   // 幽灵
} as const

// ══════════════════════════════════════════════
//  Tiny Town — 户外装饰
// ══════════════════════════════════════════════

export const TOWN_TILES = {
  tree_small:   4,     // 小树
  tree_med:     5,     // 中树
  tree_large1:  6,     // 大树1
  tree_large2:  7,     // 大树2
  bush_small:   16,    // 小灌木
  bush_med:     17,    // 中灌木
  flower:       18,    // 花
  mushroom:     31,    // 蘑菇
  grass_patch:  0,     // 草地
} as const

/**
 * 根据 tile 索引计算在 tilemap 上的像素坐标
 * @param index tile 索引（0 开始）
 * @param cols 每行列数
 * @returns {x, y} tile 左上角像素坐标（在 packed tilemap 上）
 */
export function getTileRect(index: number, cols: number): { x: number; y: number; w: number; h: number } {
  const col = index % cols                   // 列号
  const row = Math.floor(index / cols)       // 行号
  return {
    x: col * TILE_SIZE,                      // X 像素坐标
    y: row * TILE_SIZE,                      // Y 像素坐标
    w: TILE_SIZE,                            // 宽度
    h: TILE_SIZE,                            // 高度
  }
}

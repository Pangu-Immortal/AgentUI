/**
 * 办公室地图渲染器 - OfficeMap.ts
 *
 * 迁移自 claude-office 风格的办公室背景渲染，使用 PixiJS 8 命令式 API。
 * 渲染层级：墙壁背景 → 地板棋盘格 → 工位网格 → 墙壁装饰 → 地毯 → 电梯
 *
 * 纹理优先使用 TextureLoader 加载的 Sprite，加载失败时回退为 Graphics 纯色矩形。
 * 画布尺寸：CANVAS_WIDTH=1280, CANVAS_HEIGHT=1024
 *
 * 函数列表：
 *   constructor()           - 创建地图根容器
 *   drawMap()               - 绘制完整办公室（墙壁/地板/工位/装饰/地毯/电梯）
 *   getWalkableGrid()       - 返回 A* 寻路可通行网格
 *   drawWall()              - 绘制墙壁背景（深灰矩形 + 底部装饰条）
 *   drawFloor()             - 绘制棋盘格地板（Sprite 铺贴或纯色回退）
 *   drawDeskGrid()          - 绘制 4x 排列工位网格（desk/chair/keyboard/monitor，anchor+scale 定位）
 *   drawDeskAccessories()   - 确定性分配工位配件（8种配件 + ACCESSORY_TINTS 颜色系统）
 *   drawWallDecorations()   - 绘制墙壁装饰（饮水机/咖啡机/插座/员工相框）
 *   drawFloorDecorations()  - 绘制地面装饰（打印机/盆栽/Boss地毯）
 *   drawElevator()          - 绘制电梯
 *   tryCreateSpriteAnchored() - 尝试创建 Sprite（anchor+scale），失败回退为 Graphics
 */
import { Container, Graphics, Sprite, Text } from 'pixi.js'
import { TILE_SIZE } from './TileConfig'
import { getTexture } from './TextureLoader'

// ══════════════════════════════════════════════
//  claude-office 风格常量
// ══════════════════════════════════════════════

/** 画布尺寸 */
const CANVAS_WIDTH = 1280                     // 画布宽度
const CANVAS_HEIGHT = 1024                    // 画布高度

/** 墙壁参数 */
const WALL_HEIGHT = 250                       // 墙壁高度（px）
const FLOOR_COLOR = 0x2a2a2a                  // 深灰地板色
const WALL_COLOR = 0x3d3d3d                   // 深灰墙壁色
const WALL_TRIM_COLOR = 0x4a4a4a              // 墙裙条色
const WALL_TRIM_HEIGHT = 10                   // 装饰条高度（原版 WALL_TRIM_HEIGHT = 10）

/** 工位网格参数 */
const DESK_GRID_ORIGIN = { x: 256, y: 408 }  // 工位网格起始位置
const DESK_GRID_SPACING = { x: 256, y: 192 } // 工位间距
const DESK_GRID_COLS = 4                      // 每排工位数

/** 墙壁装饰物位置 */
const DECO_WATER_COOLER = { x: 1010, y: 200 }       // 饮水机
const DECO_COFFEE_MACHINE = { x: 1081, y: 191 }     // 咖啡机
const DECO_WALL_OUTLET = { x: 581, y: 209 }         // 墙壁插座
const DECO_EMPLOYEE_FRAME = { x: 184, y: 50 }       // 月度最佳员工相框
const DECO_PRINTER = { x: 50, y: 945 }              // 打印机
const DECO_PLANT = { x: 118, y: 970 }               // 盆栽
const DECO_BOSS_RUG = { x: 640, y: 940 }            // Boss 地毯

/** 电梯位置 */
const ELEVATOR_POS = { x: 1200, y: 160 }            // 电梯位置（右侧偏上）

/** 地板棋盘格参数（原版 FLOOR_TILE_SIZE = 100） */
const FLOOR_TILE_SIZE = 100                          // 地板瓦片铺贴大小（原版 100px）

/** 配件颜色色调数组（原版 ACCESSORY_TINTS，按工位索引循环使用） */
const ACCESSORY_TINTS = [
  0xffffff, 0x87ceeb, 0x98fb98, 0xffb6c1,           // 白/天蓝/淡绿/粉红
  0xffd700, 0xdda0dd, 0xf0e68c, 0xadd8e6,           // 金/梅/卡其/淡蓝
]

/** 确定性配件序列（原版 DESK_ITEM_SEQUENCE，按工位索引取值） */
const DESK_ITEM_SEQUENCE = [
  'lamp', 'mug', '8ball', 'stapler',                // 工位 0-3
  'penholder', 'thermos', 'rubiks', 'duck',          // 工位 4-7
  'lamp', 'none', 'none', 'lamp',                    // 工位 8-11
  'stapler', 'penholder', 'mug', 'mug',              // 工位 12-15
  '8ball', 'thermos', 'rubiks', 'duck',              // 工位 16-19
]

/** 配件序列名 → 纹理名映射 */
const ACCESSORY_TEXTURE_MAP: Record<string, string> = {
  mug: 'coffeeMug',                                  // 咖啡杯
  stapler: 'stapler',                                // 订书机
  lamp: 'deskLamp',                                  // 台灯
  penholder: 'penHolder',                            // 笔筒
  '8ball': 'magic8Ball',                             // 魔力8号球
  rubiks: 'rubiksCube',                              // 魔方
  duck: 'rubberDuck',                                // 橡皮鸭
  thermos: 'thermos',                                // 保温杯
}

/** 每种配件相对工位中心的精确偏移和缩放（原版 DeskGrid.tsx 参数） */
const ACCESSORY_PARAMS: Record<string, { x: number; y: number; scale: number }> = {
  mug:       { x: 50,  y: 40, scale: 0.025 },       // 咖啡杯
  stapler:   { x: 50,  y: 43, scale: 0.19 },        // 订书机
  lamp:      { x: 50,  y: 29, scale: 0.35 },        // 台灯
  penholder: { x: 54,  y: 38, scale: 0.22 },        // 笔筒
  '8ball':   { x: 54,  y: 42, scale: 0.162 },       // 魔力8号球
  rubiks:    { x: 52,  y: 42, scale: 0.16 },        // 魔方
  duck:      { x: 52,  y: 42, scale: 0.16 },        // 橡皮鸭
  thermos:   { x: 52,  y: 40, scale: 0.36 },        // 保温杯
}

/** 区域配置接口 */
interface ZoneConfig {
  x: number        // 区域左上角 X（像素）
  y: number        // 区域左上角 Y（像素）
  width: number    // 区域宽度（像素）
  height: number   // 区域高度（像素）
  label: string    // 区域中文标签
}

/** 工位配置接口 */
interface DeskConfig {
  index: number    // 工位编号
  x: number        // 工位左上角 X（像素）
  y: number        // 工位左上角 Y（像素）
  width: number    // 工位宽度（像素）
  height: number   // 工位高度（像素）
}

/** 回退绘制颜色（纹理加载失败时使用） */
const FALLBACK_COLORS: Record<string, number> = {
  desk: 0x8b6914,        // 桌面木色
  chair: 0x4a4a5a,       // 椅子灰
  keyboard: 0x333333,    // 键盘深灰
  monitor: 0x4488aa,     // 显示器蓝
  printer: 0x888888,     // 打印机灰
  plant: 0x2d8b46,       // 盆栽绿
  waterCooler: 0xcccccc, // 饮水机白
  coffeeMachine: 0x4a3a2a, // 咖啡机棕
  wallOutlet: 0x666666,  // 插座灰
  employeeOfMonth: 0xddaa44, // 相框金
  bossRug: 0x8b2222,     // 地毯深红
  elevatorFrame: 0x777777, // 电梯框灰
  elevatorDoor: 0x999999, // 电梯门灰
  coffeeMug: 0xeeeeee,   // 咖啡杯白
  stapler: 0xcc3333,     // 订书机红
  deskLamp: 0xffcc00,    // 台灯黄
  penHolder: 0x555555,   // 笔筒灰
  magic8Ball: 0x222222,  // 魔力8号球黑
  rubiksCube: 0xee4444,  // 魔方红
  rubberDuck: 0xffdd00,  // 橡皮鸭黄
  thermos: 0x336699,     // 保温杯蓝
}

export class OfficeMap {
  container: Container                              // 地图根容器（公共属性，OfficeScene 访问）
  deskBaseContainer!: Container                     // 桌面底层（desk + keyboard）
  deskTopContainer!: Container                      // 桌面顶层（monitor + accessories + marquee）
  private _chairData: Array<{sprite: Container, sortY: number}> = []  // 椅子数据（供Y-sorted层使用）

  private _mapWidth = 0                             // 缓存地图宽度
  private _mapHeight = 0                            // 缓存地图高度
  private _desks: DeskConfig[] = []                 // 缓存工位配置
  private _deskRects: Array<{ x: number; y: number; w: number; h: number }> = [] // 工位占用矩形（用于寻路）

  // ── DeskMarquee 滚动文字系统 ──
  private _marquees: Map<number, {
    container: Container        // marquee 根容器
    textObj: Text               // 文字对象
    mask: Graphics              // 裁剪遮罩
    panel: Graphics             // 背景面板
    text: string                // 当前文字
    offset: number              // 滚动偏移
    shouldScroll: boolean       // 是否需要滚动
    estimatedWidth: number      // 估算文字宽度
    startTime: number           // 动画起始时间
  }> = new Map()

  constructor() {
    this.container = new Container()                // 创建根容器
    this.container.label = 'office-map'             // 调试标签
    this.deskBaseContainer = new Container()        // 创建桌面底层容器
    this.deskBaseContainer.label = 'desk-base'      // 调试标签
    this.deskTopContainer = new Container()         // 创建桌面顶层容器
    this.deskTopContainer.label = 'desk-top'        // 调试标签
  }

  /**
   * 绘制完整的办公室地图（claude-office 风格）
   * @param zones 功能区域配置（key 为区域类型）
   * @param desks 工位配置数组
   * @param mapWidth 地图总宽度（像素）
   * @param mapHeight 地图总高度（像素）
   */
  drawMap(_zones: Record<string, ZoneConfig>, desks: DeskConfig[], mapWidth: number, mapHeight: number): void {
    this.container.removeChildren()                 // 清空旧内容
    this._mapWidth = mapWidth || CANVAS_WIDTH       // 缓存宽度，默认 1280
    this._mapHeight = mapHeight || CANVAS_HEIGHT    // 缓存高度，默认 1024
    this._desks = desks                             // 缓存工位配置
    this._deskRects = []                            // 清空工位占用矩形
    this._chairData = []                            // 清空椅子数据
    this.deskBaseContainer.removeChildren()         // 清空桌面底层
    this.deskTopContainer.removeChildren()          // 清空桌面顶层

    // 第一层：墙壁背景
    this.drawWall()

    // 第二层：棋盘格地板
    this.drawFloor()

    // 第三层：工位网格（desk + chair + keyboard + monitor + 配件）
    this.drawDeskGrid(desks)

    // 第四层：墙壁装饰（饮水机/咖啡机/插座/员工相框）
    this.drawWallDecorations()

    // 第五层：地面装饰（打印机/盆栽/Boss 地毯）
    this.drawFloorDecorations()

    // 第六层：电梯
    this.drawElevator()

    console.log(`[OfficeMap] 地图绘制完成 ${this._mapWidth}x${this._mapHeight}，工位数=${desks.length}，工位占用矩形=${this._deskRects.length}`)
  }

  /**
   * 获取可通行网格数据（供 PathSystem 的 A* 寻路使用）
   * @returns 二维布尔数组，true 表示可通行
   */
  getWalkableGrid(): boolean[][] {
    const cols = Math.ceil(this._mapWidth / TILE_SIZE)   // 网格列数
    const rows = Math.ceil(this._mapHeight / TILE_SIZE)  // 网格行数

    // 初始化全部可通行
    const grid: boolean[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => true)
    )

    // 标记墙壁区域为不可通行（顶部 WALL_HEIGHT 像素）
    const wallRows = Math.ceil(WALL_HEIGHT / TILE_SIZE)  // 墙壁占多少行
    for (let r = 0; r < wallRows && r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        grid[r]![c] = false                              // 墙壁不可通行
      }
    }

    // 标记左右边缘墙壁（各 1 格宽）
    for (let r = 0; r < rows; r++) {
      if (grid[r]![0] !== undefined) grid[r]![0] = false                   // 左墙
      if (cols > 1 && grid[r]![cols - 1] !== undefined) grid[r]![cols - 1] = false // 右墙
    }

    // 标记底部边缘墙壁（1 格高）
    for (let c = 0; c < cols; c++) {
      if (rows > 1 && grid[rows - 1]![c] !== undefined) grid[rows - 1]![c] = false // 下墙
    }

    // 标记工位区域为不可通行（使用绘制时记录的占用矩形）
    for (const rect of this._deskRects) {
      const startCol = Math.floor(rect.x / TILE_SIZE)    // 起始列
      const endCol = Math.ceil((rect.x + rect.w) / TILE_SIZE)  // 结束列
      const startRow = Math.floor(rect.y / TILE_SIZE)    // 起始行
      const endRow = Math.ceil((rect.y + rect.h) / TILE_SIZE)  // 结束行
      for (let r = startRow; r < endRow && r < rows; r++) {
        for (let c = startCol; c < endCol && c < cols; c++) {
          if (r >= 0 && c >= 0) grid[r]![c] = false      // 工位不可通行
        }
      }
    }

    // 额外标记传入的 desks 配置为不可通行
    for (const desk of this._desks) {
      const startCol = Math.floor(desk.x / TILE_SIZE)
      const endCol = Math.ceil((desk.x + desk.width) / TILE_SIZE)
      const startRow = Math.floor(desk.y / TILE_SIZE)
      const endRow = Math.ceil((desk.y + desk.height) / TILE_SIZE)
      for (let r = startRow; r < endRow && r < rows; r++) {
        for (let c = startCol; c < endCol && c < cols; c++) {
          if (r >= 0 && c >= 0) grid[r]![c] = false
        }
      }
    }

    // 标记电梯区域为不可通行
    const elevStartCol = Math.floor((ELEVATOR_POS.x - 30) / TILE_SIZE)
    const elevEndCol = Math.ceil((ELEVATOR_POS.x + 30) / TILE_SIZE)
    const elevStartRow = Math.floor((ELEVATOR_POS.y - 40) / TILE_SIZE)
    const elevEndRow = Math.ceil((ELEVATOR_POS.y + 40) / TILE_SIZE)
    for (let r = elevStartRow; r < elevEndRow && r < rows; r++) {
      for (let c = elevStartCol; c < elevEndCol && c < cols; c++) {
        if (r >= 0 && c >= 0) grid[r]![c] = false        // 电梯不可通行
      }
    }

    return grid
  }

  // ══════════════════════════════════════════════
  //  绘制方法
  // ══════════════════════════════════════════════

  /**
   * 绘制墙壁背景（上方 WALL_HEIGHT 区域 + 底部装饰条）
   */
  private drawWall(): void {
    const wall = new Graphics()

    // 墙壁主体矩形
    wall.rect(0, 0, this._mapWidth, WALL_HEIGHT)         // 墙壁区域
    wall.fill({ color: WALL_COLOR })                      // 深灰填充

    // 底部装饰条（墙裙线，4px 高）
    wall.rect(0, WALL_HEIGHT - WALL_TRIM_HEIGHT, this._mapWidth, WALL_TRIM_HEIGHT) // 装饰条
    wall.fill({ color: WALL_TRIM_COLOR })                 // 略浅灰色

    this.container.addChild(wall)                         // 添加到容器
    console.log(`[OfficeMap] 墙壁绘制完成 高度=${WALL_HEIGHT}px`)
  }

  /**
   * 绘制棋盘格地板
   * 优先使用 floor-tile.png Sprite 铺贴，加载失败则用纯色矩形回退
   * 棋盘格效果：交替旋转和色调变化
   */
  private drawFloor(): void {
    const floorContainer = new Container()               // 地板子容器
    floorContainer.label = 'floor'                       // 调试标签

    const floorTexture = getTexture('floorTile')         // 尝试获取地板纹理
    const startY = WALL_HEIGHT                           // 地板从墙壁下方开始

    if (floorTexture) {
      // 使用 Sprite 铺贴地板
      for (let y = startY; y < this._mapHeight; y += FLOOR_TILE_SIZE) {
        for (let x = 0; x < this._mapWidth; x += FLOOR_TILE_SIZE) {
          const tile = new Sprite(floorTexture)          // 创建地板瓦片 Sprite
          tile.width = FLOOR_TILE_SIZE                   // 设置宽度
          tile.height = FLOOR_TILE_SIZE                  // 设置高度
          tile.anchor.set(0.5, 0.5)                      // 统一锚点为中心（匹配原版）
          tile.position.set(x + FLOOR_TILE_SIZE / 2, y + FLOOR_TILE_SIZE / 2) // 统一中心定位

          // 棋盘格效果：交替旋转和色调
          const gridX = Math.floor(x / FLOOR_TILE_SIZE)  // 网格列号
          const gridY = Math.floor((y - startY) / FLOOR_TILE_SIZE) // 网格行号
          const isAlternate = (gridX + gridY) % 2 === 1  // 交替判断

          if (isAlternate) {
            tile.rotation = Math.PI / 2                  // 旋转 90 度
            tile.tint = 0xd8d8d8                         // 略暗色调（匹配原版 TILE_TINT_DARK）
          } else {
            tile.tint = 0xffffff                         // 不着色（匹配原版 TILE_TINT_LIGHT）
          }

          floorContainer.addChild(tile)                  // 添加瓦片
        }
      }
      console.log('[OfficeMap] 地板铺贴完成（Sprite 模式）')
    } else {
      // 纹理未加载，使用纯色棋盘格回退
      const floorGfx = new Graphics()
      const darkColor = FLOOR_COLOR                      // 深灰
      const lightColor = 0x333333                        // 略浅灰

      for (let y = startY; y < this._mapHeight; y += FLOOR_TILE_SIZE) {
        for (let x = 0; x < this._mapWidth; x += FLOOR_TILE_SIZE) {
          const gridX = Math.floor(x / FLOOR_TILE_SIZE)
          const gridY = Math.floor((y - startY) / FLOOR_TILE_SIZE)
          const isEven = (gridX + gridY) % 2 === 0      // 交替颜色
          floorGfx.rect(x, y, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE) // 绘制方格
          floorGfx.fill({ color: isEven ? darkColor : lightColor }) // 填充颜色
        }
      }

      floorContainer.addChild(floorGfx)                 // 添加纯色地板
      console.log('[OfficeMap] 地板铺贴完成（纯色回退模式）')
    }

    this.container.addChild(floorContainer)              // 添加地板容器
  }

  /**
   * 绘制工位网格
   * 布局：4 个工位一排，起始位置 (256, 408)，间距 256x192
   * 每个工位包含：desk + keyboard + chair + monitor + 随机配件
   * @param desks 传入的工位配置（用于位置覆盖）
   */
  private drawDeskGrid(desks: DeskConfig[]): void {
    // 根据传入的 desks 数量计算排数
    const rowCount = Math.ceil(desks.length / DESK_GRID_COLS) || 2 // 至少 2 排
    const totalDesks = desks.length || (rowCount * DESK_GRID_COLS)  // 总工位数

    for (let i = 0; i < totalDesks; i++) {
      const col = i % DESK_GRID_COLS                     // 列号（0-3）
      const row = Math.floor(i / DESK_GRID_COLS)         // 排号

      // 工位中心位置（基于 claude-office 布局常量）
      const cx = DESK_GRID_ORIGIN.x + col * DESK_GRID_SPACING.x // 中心 X
      const cy = DESK_GRID_ORIGIN.y + row * DESK_GRID_SPACING.y // 中心 Y

      // ── 桌面（DeskSurfacesBase 层）── anchor={0.5, 0}, y=30, scale=0.105
      const deskSprite = this.tryCreateSpriteAnchored('desk', cx, cy + 30, 0.5, 0, 0.105)
      this.deskBaseContainer.addChild(deskSprite)        // 添加桌子到底层容器

      // 记录工位占用矩形（用于寻路不可通行标记，估算桌面实际范围）
      const deskBounds = deskSprite.getBounds?.() ?? { x: cx - 40, y: cy + 6, width: 80, height: 48 }
      this._deskRects.push({ x: deskBounds.x, y: deskBounds.y, w: deskBounds.width, h: deskBounds.height })

      // ── 键盘（DeskSurfacesBase 层）── anchor=0.5, x=0, y=42, scale=0.04
      const kbSprite = this.tryCreateSpriteAnchored('keyboard', cx, cy + 42, 0.5, 0.5, 0.04)
      this.deskBaseContainer.addChild(kbSprite)          // 添加键盘到底层容器

      // ── 椅子（Y-sorted 层）── anchor=0.5, x=0, y=30, scale=0.1386
      const chairSprite = this.tryCreateSpriteAnchored('chair', cx, cy + 30, 0.5, 0.5, 0.1386)
      this._chairData.push({ sprite: chairSprite, sortY: cy + 20 }) // 存储椅子数据供Y-sorted层使用

      // 记录椅子区域为不可通行
      const chairBounds = chairSprite.getBounds?.() ?? { x: cx - 14, y: cy + 16, width: 28, height: 28 }
      this._deskRects.push({ x: chairBounds.x, y: chairBounds.y, w: chairBounds.width, h: chairBounds.height })

      // ── 显示器（DeskSurfacesTop 层）── anchor=0.5, x=-45, y=27, scale=0.08
      const monSprite = this.tryCreateSpriteAnchored('monitor', cx - 45, cy + 27, 0.5, 0.5, 0.08)
      this.deskTopContainer.addChild(monSprite)          // 添加显示器到顶层容器

      // ── 配件（DeskSurfacesTop 层）── 使用确定性配件序列
      this.drawDeskAccessories(this.deskTopContainer, cx, cy, i)

      // ── DeskMarquee 滚动文字（DeskSurfacesTop 层）── 默认隐藏，工作时显示
      this.createDeskMarquee(this.deskTopContainer, cx, cy, i)
    }

    console.log(`[OfficeMap] 工位网格绘制完成 总数=${totalDesks}`)
  }

  /** 获取椅子精灵数据（供 OfficeScene 添加到 Y-sorted 层） */
  getChairSprites(): Array<{sprite: Container, sortY: number}> {
    return this._chairData
  }

  /**
   * 为单个工位分配配件（使用原版 DESK_ITEM_SEQUENCE 确定性序列）
   * @param parent 父容器
   * @param cx 工位中心 X
   * @param cy 工位中心 Y
   * @param deskIndex 工位索引（用于查询 DESK_ITEM_SEQUENCE）
   */
  private drawDeskAccessories(parent: Container, cx: number, cy: number, deskIndex: number): void {
    // 按工位索引从确定性序列中取配件类型
    const itemKey = DESK_ITEM_SEQUENCE[deskIndex % DESK_ITEM_SEQUENCE.length]! // 配件序列名
    if (itemKey === 'none') return                       // none 不绘制任何配件

    const params = ACCESSORY_PARAMS[itemKey]             // 配件位置和缩放参数
    const textureName = ACCESSORY_TEXTURE_MAP[itemKey]   // 纹理名
    if (!params || !textureName) return                   // 参数或纹理映射缺失则跳过

    // 使用 anchor+scale 方式创建配件精灵
    const accSprite = this.tryCreateSpriteAnchored(
      textureName,                                       // 纹理名
      cx + params.x,                                     // 相对工位中心的 X 偏移
      cy + params.y,                                     // 相对工位中心的 Y 偏移
      0.5, 0.5,                                          // anchor 居中
      params.scale,                                      // 原版精确缩放
    )

    // 仅 mug 类型应用颜色色调（原版只有 mug 使用 tint）
    if (itemKey === 'mug' && accSprite instanceof Sprite) {
      accSprite.tint = ACCESSORY_TINTS[deskIndex % ACCESSORY_TINTS.length]! // 循环颜色
    }

    parent.addChild(accSprite)                           // 添加配件
  }

  /**
   * 绘制墙壁装饰物
   * 翻译自原版 OfficeGame.tsx 渲染层级，包含：
   * - 饮水机/咖啡机/插座（Sprite）
   * - EmployeeOfTheMonth 海报（Graphics 绘制，翻译自原版组件）
   * - WallClock 模拟时钟（Graphics 绘制，翻译自原版组件）
   * - SafetySign 安全标牌（Graphics 绘制，翻译自原版组件）
   */
  private drawWallDecorations(): void {
    const decoContainer = new Container()                // 装饰容器
    decoContainer.label = 'wall-decorations'             // 调试标签

    // ── 饮水机（原版 anchor=0.5, scale=0.198, 位置 1010,200） ──
    const waterCooler = this.tryCreateSpriteAnchored('waterCooler', DECO_WATER_COOLER.x, DECO_WATER_COOLER.y, 0.5, 0.5, 0.198)
    decoContainer.addChild(waterCooler)
    this._deskRects.push({ x: DECO_WATER_COOLER.x - 20, y: DECO_WATER_COOLER.y - 30, w: 40, h: 60 })

    // ── 咖啡机（原版 anchor=0.5, scale=0.1, 位置 1081,191） ──
    const coffeeMachine = this.tryCreateSpriteAnchored('coffeeMachine', DECO_COFFEE_MACHINE.x, DECO_COFFEE_MACHINE.y, 0.5, 0.5, 0.1)
    decoContainer.addChild(coffeeMachine)
    this._deskRects.push({ x: DECO_COFFEE_MACHINE.x - 18, y: DECO_COFFEE_MACHINE.y - 24, w: 36, h: 48 })

    // ── 墙壁插座（原版 anchor=0.5, scale=0.04, 位置 581,209） ──
    const wallOutlet = this.tryCreateSpriteAnchored('wallOutlet', DECO_WALL_OUTLET.x, DECO_WALL_OUTLET.y, 0.5, 0.5, 0.04)
    decoContainer.addChild(wallOutlet)

    // ── EmployeeOfTheMonth 海报（翻译自原版 EmployeeOfTheMonth.tsx, 位置 184,50） ──
    this.drawEmployeeOfTheMonth(decoContainer, DECO_EMPLOYEE_FRAME.x, DECO_EMPLOYEE_FRAME.y)

    // ── WallClock 模拟时钟（翻译自原版 WallClock.tsx, 位置 581,80） ──
    this.drawWallClock(decoContainer, 581, 80)

    // ── SafetySign 安全标牌（翻译自原版 SafetySign.tsx, 位置 1120,40） ──
    this.drawSafetySign(decoContainer, 1120, 40)

    // ── CityWindow 城市窗户（翻译自原版 CityWindow.tsx, 位置 319,30） ──
    this.drawCityWindow(decoContainer, 319, 30)

    // ── Whiteboard 白板（翻译自原版 Whiteboard.tsx, 位置 641,11） ──
    this.drawWhiteboard(decoContainer, 641, 11)

    this.container.addChild(decoContainer)               // 添加装饰容器
    console.log('[OfficeMap] 墙壁装饰绘制完成')
  }

  /**
   * 绘制 EmployeeOfTheMonth 海报（严格翻译自原版 EmployeeOfTheMonth.tsx）
   * 原版位置：EMPLOYEE_OF_MONTH_POSITION = {x: 184, y: 50}
   */
  private drawEmployeeOfTheMonth(parent: Container, x: number, y: number): void {
    const c = new Container()
    c.position.set(x, y)
    c.label = 'employee-of-month'

    const g = new Graphics()
    // 阴影（原版 roundRect(5,5,120,155,4) alpha 0.3）
    g.roundRect(5, 5, 120, 155, 4)
    g.fill({ color: 0x000000, alpha: 0.3 })
    // 主体（原版 cream/off-white 0xf5f0e6）
    g.roundRect(0, 0, 120, 155, 4)
    g.fill(0xf5f0e6)
    g.stroke({ width: 3, color: 0x8b7355 })
    // 深色标题栏（原版 0x2a2a4a）
    g.rect(6, 6, 108, 28)
    g.fill(0x2a2a4a)
    g.stroke({ width: 1, color: 0x1a1a2a })
    // 照片框区域（原版 0x1a1a1a + 金色边框 0xdaa520）
    g.rect(15, 42, 90, 90)
    g.fill(0x1a1a1a)
    g.stroke({ width: 3, color: 0xdaa520 })
    // 铭牌背景（原版 0xdaa520）
    g.rect(15, 138, 90, 12)
    g.fill(0xdaa520)
    // 金色装饰角（原版 4 个角）
    const cs = 8
    g.moveTo(15, 42 + cs); g.lineTo(15, 42); g.lineTo(15 + cs, 42)
    g.stroke({ width: 2, color: 0xffd700 })
    g.moveTo(105 - cs, 42); g.lineTo(105, 42); g.lineTo(105, 42 + cs)
    g.stroke({ width: 2, color: 0xffd700 })
    g.moveTo(15, 132 - cs); g.lineTo(15, 132); g.lineTo(15 + cs, 132)
    g.stroke({ width: 2, color: 0xffd700 })
    g.moveTo(105 - cs, 132); g.lineTo(105, 132); g.lineTo(105, 132 - cs)
    g.stroke({ width: 2, color: 0xffd700 })
    c.addChild(g)

    // 标题文字 "EMPLOYEE"（原版 x=60,y=14, scale=0.5, fontSize=24）
    const titleText = new Text({ text: 'EMPLOYEE', style: {
      fontFamily: '"Arial Black", Arial, sans-serif', fontSize: 24,
      fontWeight: 'bold', fill: '#ffd700',
    }})
    titleText.anchor.set(0.5, 0.5)
    titleText.position.set(60, 14)
    titleText.scale.set(0.5)
    titleText.resolution = 2
    c.addChild(titleText)

    // 副标题 "OF THE MONTH"（原版 x=60,y=26, scale=0.5, fontSize=16）
    const subText = new Text({ text: 'OF THE MONTH', style: {
      fontFamily: '"Arial Black", Arial, sans-serif', fontSize: 16,
      fontWeight: 'bold', fill: '#ffffff',
    }})
    subText.anchor.set(0.5, 0.5)
    subText.position.set(60, 26)
    subText.scale.set(0.5)
    subText.resolution = 2
    c.addChild(subText)

    // 照片（原版 employee-of-month.png, anchor=0.5, x=60, y=87, scale=0.082）
    const photoSprite = this.tryCreateSpriteAnchored('employeeOfMonth', 60, 87, 0.5, 0.5, 0.082)
    c.addChild(photoSprite)

    // 铭牌文字
    const nameText = new Text({ text: 'Claude Code', style: {
      fontFamily: '"Arial Black", Arial, sans-serif', fontSize: 20,
      fontWeight: 'bold', fill: '#1a1a1a',
    }})
    nameText.anchor.set(0.5, 0.5)
    nameText.position.set(60, 144)
    nameText.scale.set(0.5)
    nameText.resolution = 2
    c.addChild(nameText)

    parent.addChild(c)
  }

  /**
   * 绘制模拟时钟（严格翻译自原版 WallClock.tsx drawAnalogClock）
   * 原版位置：WALL_CLOCK_POSITION = {x: 581, y: 80}
   */
  private drawWallClock(parent: Container, x: number, y: number): void {
    const c = new Container()
    c.position.set(x, y)
    c.label = 'wall-clock'

    // 表盘底板（静态，不需要每帧重绘）
    const face = new Graphics()
    // 外圈黑环（原版 circle(0,0,44) fill 0x000000）
    face.circle(0, 0, 44)
    face.fill(0x000000)
    // 白色表盘（原版 circle(0,0,40) fill 0xffffff）
    face.circle(0, 0, 40)
    face.fill(0xffffff)
    face.stroke({ width: 4, color: 0x2d3748 })
    // 12 个刻度点（原版 dots at radius 32）
    for (let i = 0; i < 12; i++) {
      const angle = i * 30 * (Math.PI / 180)
      face.circle(Math.sin(angle) * 32, -Math.cos(angle) * 32, 2)
      face.fill(0x2d3748)
    }
    c.addChild(face)

    // 指针层（动态，每秒重绘）
    const hands = new Graphics()
    c.addChild(hands)
    this._clockHands = hands                          // 缓存引用，ticker 中更新

    parent.addChild(c)
  }

  /** 每帧更新时钟指针（由 tickMarquees 一并调用） */
  private _clockHands: Graphics | null = null
  private _clockLastSec = -1                          // 上次绘制的秒数（避免重复重绘）

  // CityWindow 周期更新（原版每 60 秒更新一次天空/建筑灯光）
  private _cityWindowParent: Container | null = null  // CityWindow 父容器引用
  private _cityWindowRef: Container | null = null     // CityWindow 容器引用
  private _cityWindowPos = { x: 0, y: 0 }            // CityWindow 位置
  private _cityLastMinute = -1                        // 上次更新的分钟数

  // 电梯门动画
  private _elevLeftDoor: Container | null = null            // 左门引用
  private _elevRightDoor: Container | null = null           // 右门引用
  private _elevIndicator: Graphics | null = null           // 指示灯引用
  private _elevDoorOpen = false                            // 门是否打开
  private _elevAnimStart = 0                               // 动画起始时间
  private _elevAnimating = false                           // 是否正在动画中

  // 垃圾桶动态填充
  private _trashFillGfx: Graphics | null = null            // 垃圾桶填充图形
  private _trashPctText: Text | null = null                // 百分比文字
  private _trashCanParams: { x: number, y: number } | null = null // 垃圾桶位置

  private _safetyNumText: Text | null = null               // 安全标牌数字文字

  private tickClock(): void {
    if (!this._clockHands) return
    const now = new Date()
    const secs = now.getSeconds()
    if (secs === this._clockLastSec) return            // 同一秒内不重绘
    this._clockLastSec = secs

    const g = this._clockHands
    g.clear()

    const hours = now.getHours() % 12
    const mins = now.getMinutes()

    // 时针（原版 width=4, length=20, color=0x2d3748）
    const hAngle = (hours * 30 + mins * 0.5) * (Math.PI / 180)
    g.moveTo(0, 0)
    g.lineTo(Math.sin(hAngle) * 20, -Math.cos(hAngle) * 20)
    g.stroke({ width: 4, color: 0x2d3748 })

    // 分针（原版 width=3, length=30, color=0x2d3748）
    const mAngle = mins * 6 * (Math.PI / 180)
    g.moveTo(0, 0)
    g.lineTo(Math.sin(mAngle) * 30, -Math.cos(mAngle) * 30)
    g.stroke({ width: 3, color: 0x2d3748 })

    // 秒针（原版 width=1, length=35, color=0xef4444 红色）
    const sAngle = secs * 6 * (Math.PI / 180)
    g.moveTo(0, 0)
    g.lineTo(Math.sin(sAngle) * 35, -Math.cos(sAngle) * 35)
    g.stroke({ width: 1, color: 0xef4444 })
  }

  /**
   * 绘制安全标牌（严格翻译自原版 SafetySign.tsx）
   * 原版位置：SAFETY_SIGN_POSITION = {x: 1120, y: 40}
   */
  private drawSafetySign(parent: Container, x: number, y: number): void {
    const c = new Container()
    c.position.set(x, y)
    c.label = 'safety-sign'

    const g = new Graphics()
    // 阴影
    g.roundRect(4, 4, 140, 100, 6)
    g.fill({ color: 0x000000, alpha: 0.3 })
    // 主体（原版 safety green 0x1a5f1a）
    g.roundRect(0, 0, 140, 100, 6)
    g.fill(0x1a5f1a)
    g.stroke({ width: 3, color: 0x0d3d0d })
    // 白色内边框
    g.roundRect(6, 6, 128, 88, 4)
    g.stroke({ width: 2, color: 0xffffff })
    // 红色顶部条
    g.rect(10, 10, 120, 20)
    g.fill(0xcc2222)
    c.addChild(g)

    // 标题 "⚠️ SAFETY"（原版 x=70,y=20, scale=0.5, fontSize=22）
    const headerText = new Text({ text: '⚠️ SAFETY', style: {
      fontFamily: '"Arial Black", Arial, sans-serif', fontSize: 22,
      fontWeight: 'bold', fill: '#ffffff',
    }})
    headerText.anchor.set(0.5, 0.5)
    headerText.position.set(70, 20)
    headerText.scale.set(0.5)
    headerText.resolution = 2
    c.addChild(headerText)

    // 大数字（原版 动态 toolUsesSinceCompaction，此处静态 0）
    const numText = new Text({ text: '0', style: {
      fontFamily: '"Arial Black", Arial, sans-serif', fontSize: 56,
      fontWeight: 'bold', fill: '#ffffff',
    }})
    numText.anchor.set(0.5, 0.5)
    numText.position.set(70, 52)
    numText.scale.set(0.5)
    numText.resolution = 2
    c.addChild(numText)
    this._safetyNumText = numText                            // 保存引用用于动态更新

    // 标签 "TOOL USES"
    const label1 = new Text({ text: 'TOOL USES', style: {
      fontFamily: '"Courier New", monospace', fontSize: 18,
      fontWeight: 'bold', fill: '#ffcc00',
    }})
    label1.anchor.set(0.5, 0.5)
    label1.position.set(70, 72)
    label1.scale.set(0.5)
    label1.resolution = 2
    c.addChild(label1)

    // 标签 "SINCE COMPACTION"
    const label2 = new Text({ text: 'SINCE COMPACTION', style: {
      fontFamily: '"Courier New", monospace', fontSize: 18,
      fontWeight: 'bold', fill: '#ffcc00',
    }})
    label2.anchor.set(0.5, 0.5)
    label2.position.set(70, 84)
    label2.scale.set(0.5)
    label2.resolution = 2
    c.addChild(label2)

    parent.addChild(c)
  }

  /**
   * 绘制城市窗户（严格翻译自原版 CityWindow.tsx + city/ 子模块）
   * 原版位置：CITY_WINDOW_POSITION = {x: 319, y: 30}
   * 原版尺寸：FRAME_WIDTH=200, FRAME_HEIGHT=160, FRAME_THICKNESS=8
   * 包含：窗框 → 天空渐变 → 星星/月亮/太阳 → 建筑物剪影+窗灯 → 十字窗格线
   */
  private drawCityWindow(parent: Container, x: number, y: number): void {
    const c = new Container()
    c.position.set(x, y)
    c.label = 'city-window'

    // ── 原版常量 ──
    const FRAME_W = 200, FRAME_H = 160, FRAME_T = 8   // 窗框尺寸和厚度
    const INNER_W = FRAME_W - FRAME_T * 2              // 内部宽度 184
    const INNER_H = FRAME_H - FRAME_T * 2              // 内部高度 144

    // ── 时间状态计算（翻译自 timeUtils.ts） ──
    const now = new Date()
    const hour = now.getHours() + now.getMinutes() / 60 // 小数小时
    const month = now.getMonth()
    // 季节判定
    let season = 'winter'
    if (month >= 2 && month <= 4) season = 'spring'
    else if (month >= 5 && month <= 7) season = 'summer'
    else if (month >= 8 && month <= 10) season = 'fall'
    // 季节时间表 [dawnStart, dawnEnd, duskStart, duskEnd]
    const SEASONAL: Record<string, [number, number, number, number]> = {
      winter: [6.5, 8, 16.5, 18.5],
      spring: [5.5, 7, 18, 20.5],
      summer: [4.5, 6, 19.5, 21.5],
      fall: [6, 7.5, 17.5, 19.5],
    }
    const [dawnStart, dawnEnd, duskStart, duskEnd] = SEASONAL[season]!
    // 计算 phase 和 progress
    let phase: 'night' | 'dawn' | 'day' | 'dusk' = 'night'
    let progress = 0
    if (hour >= duskEnd || hour < dawnStart) {
      phase = 'night'; progress = 0
    } else if (hour >= dawnStart && hour < dawnEnd) {
      phase = 'dawn'; progress = (hour - dawnStart) / (dawnEnd - dawnStart)
    } else if (hour >= dawnEnd && hour < duskStart) {
      phase = 'day'; progress = 0
    } else {
      phase = 'dusk'; progress = (hour - duskStart) / (duskEnd - duskStart)
    }

    // ── 颜色插值工具（翻译自 skyRenderer.ts lerpColor） ──
    const lerp = (c1: number, c2: number, t: number): number => {
      const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff
      const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff
      return (Math.round(r1 + (r2 - r1) * t) << 16) |
             (Math.round(g1 + (g2 - g1) * t) << 8) |
             Math.round(b1 + (b2 - b1) * t)
    }

    // ── 天空色板（翻译自 skyRenderer.ts SKY_PALETTES） ──
    const SKY_PALETTES = {
      night: [0x0a0a1a, 0x0d0d22, 0x12122a, 0x1a1a3a, 0x1f1f45],
      dawn:  [0x1a1a3a, 0x3a2a4a, 0x6a3a5a, 0xff6b4a, 0xffaa66],
      day:   [0x4a90d0, 0x5aa0dd, 0x6ab0e8, 0x7bc0f0, 0x87ceeb],
      dusk:  [0x3a1a3a, 0x5a2a3a, 0x8a3a3a, 0xff4444, 0xff6b4a],
    }

    // ── 计算当前天空颜色（翻译自 getInterpolatedSkyColors） ──
    let skyColors: number[]
    if (phase === 'night') {
      skyColors = SKY_PALETTES.night
    } else if (phase === 'day') {
      skyColors = SKY_PALETTES.day
    } else if (phase === 'dawn') {
      if (progress < 0.5) {
        const p = progress * 2
        skyColors = SKY_PALETTES.night.map((c, i) => lerp(c, SKY_PALETTES.dawn[i]!, p))
      } else {
        const p = (progress - 0.5) * 2
        skyColors = SKY_PALETTES.dawn.map((c, i) => lerp(c, SKY_PALETTES.day[i]!, p))
      }
    } else { // dusk
      if (progress < 0.5) {
        const p = progress * 2
        skyColors = SKY_PALETTES.day.map((c, i) => lerp(c, SKY_PALETTES.dusk[i]!, p))
      } else {
        const p = (progress - 0.5) * 2
        skyColors = SKY_PALETTES.dusk.map((c, i) => lerp(c, SKY_PALETTES.night[i]!, p))
      }
    }

    const g = new Graphics()
    const skyX = FRAME_T, skyY = FRAME_T                // 内部区域起始坐标

    // ── 天空渐变（翻译自 drawSkyGradient） ──
    const bandH = Math.ceil(INNER_H / skyColors.length)  // 每个色带高度
    for (let i = 0; i < skyColors.length; i++) {
      g.rect(skyX, skyY + i * bandH, INNER_W, bandH)
      g.fill(skyColors[i]!)
    }

    // ── 星星（翻译自 drawStars，夜间显示） ──
    const isNight = hour >= duskEnd || hour < dawnStart
    if (isNight) {
      const starPositions: [number, number][] = [
        [20, 15], [45, 25], [70, 10], [100, 20], [130, 12],
        [155, 28], [35, 35], [85, 32], [120, 38], [165, 18],
      ]
      for (const [sx, sy] of starPositions) {
        g.rect(skyX + sx, skyY + sy, 2, 2)
        g.fill(0xffffff)
      }
    }

    // ── 月亮（翻译自 drawMoon，夜间弧线轨迹） ──
    if (isNight) {
      const nightDur = 24 - duskEnd + dawnStart
      const moonProg = hour >= duskEnd
        ? (hour - duskEnd) / nightDur
        : (hour + (24 - duskEnd)) / nightDur
      const arcH = INNER_H - 30
      const horizonY = skyY + INNER_H - 10
      const moonY = horizonY - Math.sin(moonProg * Math.PI) * arcH
      const moonX = skyX + 20 + moonProg * (INNER_W - 40)
      let moonAlpha = 1
      if (moonProg < 0.1) moonAlpha = moonProg / 0.1
      else if (moonProg > 0.9) moonAlpha = (1 - moonProg) / 0.1
      const moonColor = lerp(skyColors[0]!, 0xf5f5dc, moonAlpha)
      g.circle(moonX, moonY, 12)
      g.fill(moonColor)
      g.circle(moonX + 5, moonY - 3, 10)             // 月牙阴影
      g.fill(skyColors[0]!)
    }

    // ── 太阳（翻译自 drawSunAndClouds，白天弧线轨迹） ──
    if (hour >= dawnStart && hour < duskEnd) {
      const dayDur = duskEnd - dawnStart
      const sunProg = (hour - dawnStart) / dayDur
      const arcH = INNER_H - 40
      const horizonY = skyY + INNER_H - 15
      const sunY = horizonY - Math.sin(sunProg * Math.PI) * arcH
      const sunX = skyX + 20 + sunProg * (INNER_W - 40)
      const midday = Math.sin(sunProg * Math.PI)
      const sunColor = lerp(0xff6b4a, 0xffdd44, midday)
      g.circle(sunX, sunY, 15)
      g.fill(sunColor)
      // 白天中段画云（翻译自 drawCloud）
      if (midday > 0.5) {
        const cloudAlpha = (midday - 0.5) * 2
        const cloudColor = lerp(skyColors[2]!, 0xffffff, cloudAlpha)
        // 上层云
        g.circle(skyX + 30, skyY + 18, 8)
        g.circle(skyX + 40, skyY + 16, 10)
        g.circle(skyX + 50, skyY + 18, 7)
        g.fill(cloudColor)
        // 下层云
        g.circle(skyX + 100, skyY + 38, 8)
        g.circle(skyX + 110, skyY + 36, 10)
        g.circle(skyX + 120, skyY + 38, 7)
        g.fill(cloudColor)
      }
    }

    // ── 建筑物剪影+窗灯（翻译自 buildingRenderer.ts） ──
    const BLDG_COLORS: Record<string, number> = {
      night: 0x0d0d1a, dawn: 0x1a1a2a, day: 0x2a2a3a, dusk: 0x1a1a2a,
    }
    const WIN_LIT: Record<string, number> = {
      night: 0.35, dawn: 0.2, day: 0.05, dusk: 0.3,
    }
    // 插值建筑颜色
    let bldgColor: number
    if (phase === 'dawn') bldgColor = lerp(BLDG_COLORS['night']!, BLDG_COLORS['day']!, progress)
    else if (phase === 'dusk') bldgColor = lerp(BLDG_COLORS['day']!, BLDG_COLORS['night']!, progress)
    else bldgColor = BLDG_COLORS[phase]!
    // 插值窗灯亮起概率
    let litChance: number
    if (phase === 'dawn') litChance = WIN_LIT['night']! + (WIN_LIT['day']! - WIN_LIT['night']!) * progress
    else if (phase === 'dusk') litChance = WIN_LIT['day']! + (WIN_LIT['night']! - WIN_LIT['day']!) * progress
    else litChance = WIN_LIT[phase]!
    // 建筑物定义（翻译自 DEFAULT_BUILDINGS）
    const buildings = [
      { x: 5, w: 28, h: 80, rows: 8, cols: 3 },
      { x: 38, w: 35, h: 110, rows: 11, cols: 4 },
      { x: 78, w: 25, h: 65, rows: 6, cols: 3 },
      { x: 108, w: 40, h: 95, rows: 9, cols: 5 },
      { x: 153, w: 30, h: 75, rows: 7, cols: 3 },
    ]
    const baseY = skyY + INNER_H + FRAME_T              // 建筑底部对齐线
    // 伪随机哈希（翻译自 mixHash）
    const mixH = (a: number, b: number, cc: number, d: number): number => {
      let h = a
      h = ((h ^ b) * 2654435761) >>> 0
      h = ((h ^ cc) * 2654435761) >>> 0
      h = ((h ^ d) * 2654435761) >>> 0
      h = h ^ (h >>> 16)
      h = (h * 2246822507) >>> 0
      h = h ^ (h >>> 13)
      return h % 100
    }
    const citySeed = 42                                  // 固定种子
    for (let bi = 0; bi < buildings.length; bi++) {
      const b = buildings[bi]!
      const bx = skyX + b.x
      const by = baseY - b.h
      // 建筑剪影
      g.rect(bx, by, b.w, b.h)
      g.fill(bldgColor)
      // 窗户
      const wSpacingX = Math.floor((b.w - 4) / b.cols)
      const wSpacingY = Math.floor((b.h - 8) / b.rows)
      for (let row = 0; row < b.rows; row++) {
        for (let col = 0; col < b.cols; col++) {
          const wx = bx + 2 + col * wSpacingX + (wSpacingX - 4) / 2
          const wy = by + 4 + row * wSpacingY
          const seed = mixH(citySeed, bi, row, col)
          const isLit = seed < litChance * 100
          g.rect(wx, wy, 4, 5)
          g.fill(isLit ? 0xffdd44 : 0x1a1a2a)
        }
      }
    }

    // ── 窗格十字线（翻译自 drawWindowDividers） ──
    g.rect(skyX + INNER_W / 2 - 2, skyY, 4, INNER_H)    // 垂直线
    g.fill(0x3a3a3a)
    g.rect(skyX, skyY + INNER_H / 2 - 2, INNER_W, 4)    // 水平线
    g.fill(0x3a3a3a)

    c.addChild(g)

    // ── 窗框（翻译自 drawFrame，三层深度效果） ──
    const frame = new Graphics()
    // 顶边框
    frame.rect(0, 0, FRAME_W, FRAME_T); frame.fill(0x1a1a1a)
    frame.rect(2, 2, FRAME_W - 4, FRAME_T - 2); frame.fill(0x2d2d2d)
    frame.rect(FRAME_T - 2, FRAME_T - 2, INNER_W + 4, 2); frame.fill(0x4a4a4a)
    // 底边框
    frame.rect(0, FRAME_H - FRAME_T, FRAME_W, FRAME_T); frame.fill(0x1a1a1a)
    frame.rect(2, FRAME_H - FRAME_T, FRAME_W - 4, FRAME_T - 2); frame.fill(0x2d2d2d)
    frame.rect(FRAME_T - 2, FRAME_H - FRAME_T, INNER_W + 4, 2); frame.fill(0x4a4a4a)
    // 左边框
    frame.rect(0, 0, FRAME_T, FRAME_H); frame.fill(0x1a1a1a)
    frame.rect(2, 2, FRAME_T - 2, FRAME_H - 4); frame.fill(0x2d2d2d)
    frame.rect(FRAME_T - 2, FRAME_T - 2, 2, INNER_H + 4); frame.fill(0x4a4a4a)
    // 右边框
    frame.rect(FRAME_W - FRAME_T, 0, FRAME_T, FRAME_H); frame.fill(0x1a1a1a)
    frame.rect(FRAME_W - FRAME_T, 2, FRAME_T - 2, FRAME_H - 4); frame.fill(0x2d2d2d)
    frame.rect(FRAME_W - FRAME_T, FRAME_T - 2, 2, INNER_H + 4); frame.fill(0x4a4a4a)
    c.addChild(frame)

    // 存储引用用于周期性更新
    this._cityWindowParent = parent
    this._cityWindowRef = c
    this._cityWindowPos = { x, y }
    this._cityLastMinute = new Date().getMinutes()

    parent.addChild(c)
  }

  /** 每分钟更新 CityWindow（重绘天空/建筑灯光） */
  private tickCityWindow(): void {
    if (!this._cityWindowParent || !this._cityWindowRef) return
    const now = new Date()
    const currentMinute = now.getMinutes()
    if (currentMinute === this._cityLastMinute) return  // 同一分钟内不重绘
    this._cityLastMinute = currentMinute

    // 移除旧的 CityWindow 并重绘
    const parent = this._cityWindowParent
    const idx = parent.getChildIndex(this._cityWindowRef)
    parent.removeChild(this._cityWindowRef)
    this._cityWindowRef.destroy({ children: true })
    this._cityWindowRef = null

    // 重绘（会重新设置 _cityWindowRef）
    this.drawCityWindow(parent, this._cityWindowPos.x, this._cityWindowPos.y)

    // 恢复原来的层级位置
    if (this._cityWindowRef && idx >= 0 && idx < parent.children.length) {
      parent.setChildIndex(this._cityWindowRef, idx)
    }
  }

  /**
   * 绘制白板（严格翻译自原版 Whiteboard.tsx WhiteboardFrame）
   * 原版位置：WHITEBOARD_POSITION = {x: 641, y: 11}
   * 原版尺寸：330x205，圆角8，棕色边框，银色内框
   * 包含：白板主体 → 深色标题栏 → 模式指示点 → 标记笔托盘 → 红绿蓝标记笔
   */
  private drawWhiteboard(parent: Container, x: number, y: number): void {
    const c = new Container()
    c.position.set(x, y)
    c.label = 'whiteboard'

    const g = new Graphics()
    // 阴影（原版 roundRect(4,4,330,205,8) alpha 0.2）
    g.roundRect(4, 4, 330, 205, 8)
    g.fill({ color: 0x000000, alpha: 0.2 })
    // 白板主体（原版 0xffffff + 棕色边框 0x5d4037 width=4）
    g.roundRect(0, 0, 330, 205, 8)
    g.fill(0xffffff)
    g.stroke({ width: 4, color: 0x5d4037 })
    // 银色内边框（原版 roundRect(6,6,318,193,4) stroke 0x9e9e9e width=2）
    g.roundRect(6, 6, 318, 193, 4)
    g.stroke({ width: 2, color: 0x9e9e9e })
    // 深色标题栏（原版 rect(10,10,310,24) fill 0x2d3748 + roundRect）
    g.rect(10, 10, 310, 24)
    g.fill(0x2d3748)
    g.roundRect(10, 10, 310, 24, 3)
    g.fill(0x2d3748)
    // 标记笔托盘（原版 rect(115,203,100,8) fill 0x9e9e9e + stroke 0x757575）
    g.rect(115, 203, 100, 8)
    g.fill(0x9e9e9e)
    g.stroke({ width: 1, color: 0x757575 })
    // 三支标记笔（原版 red/green/blue roundRect）
    const markerColors = [0xef4444, 0x22c55e, 0x3b82f6]
    for (let i = 0; i < markerColors.length; i++) {
      g.roundRect(125 + i * 25, 197, 18, 12, 2)
      g.fill(markerColors[i]!)
    }
    c.addChild(g)

    // 标题文字（原版 "📋 Todo List"，此处显示默认模式）
    const headerText = new Text({ text: '📋 Todo List', style: {
      fontFamily: '"Courier New", monospace', fontSize: 24,
      fontWeight: 'bold', fill: '#ffffff',
    }})
    headerText.anchor.set(0.5, 0.5)
    headerText.position.set(165, 22)                     // 原版 x=165,y=22
    headerText.scale.set(0.5)                            // 原版 scale={0.5}
    headerText.resolution = 2
    c.addChild(headerText)

    // 模式指示点（原版 11 个点，当前模式高亮，位于 x=165,y=193）
    const dotGfx = new Graphics()
    for (let i = 0; i < 11; i++) {
      const dx = 165 + (i - 5) * 10                     // 原版 (i-5)*10 居中分布
      const r = i === 0 ? 4 : 2                         // 当前模式 0 高亮
      dotGfx.circle(dx, 193, r)
      dotGfx.fill(i === 0 ? 0x3b82f6 : 0x9ca3af)
    }
    c.addChild(dotGfx)

    // 白板内容区域（简单静态内容，模拟 Todo 列表）
    const contentGfx = new Graphics()
    const todoItems = ['🔧 修复 Bug', '✨ 新功能开发', '📝 代码审查', '🚀 部署上线']
    for (let i = 0; i < todoItems.length; i++) {
      // 复选框（原版 TodoListMode 中的方块）
      contentGfx.rect(20, 42 + i * 28, 12, 12)
      contentGfx.stroke({ width: 2, color: 0x4a5568 })
      if (i < 2) {                                      // 前两项已完成
        contentGfx.moveTo(22, 48 + i * 28)
        contentGfx.lineTo(25, 52 + i * 28)
        contentGfx.lineTo(30, 44 + i * 28)
        contentGfx.stroke({ width: 2, color: 0x22c55e })
      }
    }
    c.addChild(contentGfx)

    // Todo 文字标签
    for (let i = 0; i < todoItems.length; i++) {
      const itemText = new Text({ text: todoItems[i]!, style: {
        fontFamily: '"Courier New", monospace', fontSize: 20,
        fill: i < 2 ? '#9ca3af' : '#2d3748',            // 已完成灰色，未完成深色
      }})
      itemText.position.set(38, 40 + i * 28)
      itemText.scale.set(0.5)
      itemText.resolution = 2
      c.addChild(itemText)
    }

    parent.addChild(c)
  }

  /**
   * 绘制地面装饰物
   * 翻译自原版 OfficeGame.tsx 渲染层级：
   * - Boss 地毯（bossRug sprite, scale=0.3, 位于 640,940）
   * - PrinterStation（desk+printer textures, 位于 50,945）
   * - 盆栽（plant sprite, scale=0.1, 位于 118,970）
   * - Boss 桌区（desk+chair+keyboard+monitor+body，翻译自 BossSprite.tsx）
   */
  private drawFloorDecorations(): void {
    const decoContainer = new Container()
    decoContainer.label = 'floor-decorations'

    // ── Boss 地毯（原版 anchor=0.5, scale=0.3, 位置 640,940） ──
    const rug = this.tryCreateSpriteAnchored('bossRug', DECO_BOSS_RUG.x, DECO_BOSS_RUG.y, 0.5, 0.5, 0.3)
    decoContainer.addChild(rug)

    // ── PrinterStation（严格翻译自原版 PrinterStation.tsx） ──
    this.drawPrinterStation(decoContainer, DECO_PRINTER.x, DECO_PRINTER.y)

    // ── 盆栽（原版 anchor=0.5, scale=0.1, 位置 118,970） ──
    const plant = this.tryCreateSpriteAnchored('plant', DECO_PLANT.x, DECO_PLANT.y, 0.5, 0.5, 0.1)
    decoContainer.addChild(plant)
    this._deskRects.push({ x: DECO_PLANT.x - 16, y: DECO_PLANT.y - 20, w: 32, h: 40 })

    // ── Boss 桌区（翻译自原版 BossSprite.tsx，位于 640,940） ──
    this.drawBossArea(decoContainer, DECO_BOSS_RUG.x, DECO_BOSS_RUG.y)

    this.container.addChild(decoContainer)
    console.log('[OfficeMap] 地面装饰绘制完成')
  }

  /**
   * 绘制打印机站（严格翻译自原版 PrinterStation.tsx）
   * 原版位置：PRINTER_STATION_POSITION = {x: 50, y: 945}
   * 包含：小桌子(desk 60%宽) → 打印机 → 出纸口 → 纸张（静态）
   */
  private drawPrinterStation(parent: Container, x: number, y: number): void {
    const c = new Container()
    c.position.set(x, y)
    c.label = 'printer-station'

    // 小桌子（原版 deskTexture anchor(0.5,0) scale(0.063,0.105)）
    const deskSprite = this.tryCreateSpriteAnchored('desk', 0, 0, 0.5, 0, 0.105)
    if (deskSprite instanceof Sprite) {
      deskSprite.scale.set(0.105 * 0.6, 0.105)          // 原版 scale={x:0.063,y:0.105}
    }
    c.addChild(deskSprite)

    // 打印机（原版 printerTexture anchor(0.5,0.8) y=15 scale=0.08）
    const printerSprite = this.tryCreateSpriteAnchored('printer', 0, 15, 0.5, 0.8, 0.08)
    c.addChild(printerSprite)

    // 静态纸张（原版有打印动画，此处静态渲染一张纸 at progress=1）
    const PAPER_ANGLE_RAD = 24 * Math.PI / 180           // 原版 24° 旋转角
    const paperContainer = new Container()
    paperContainer.position.set(10, -51)                 // 原版 paperX=10, paperY=-51 (progress=1)
    paperContainer.rotation = PAPER_ANGLE_RAD            // 纸张倾斜 24°

    const paper = new Graphics()
    const pw = 23, ph = 41                               // 原版纸张尺寸
    paper.rect(-pw / 2, 0, pw, ph)
    paper.fill(0xf5f5f5)                                 // 原版白色纸张
    paper.stroke({ width: 1, color: 0xcccccc })
    // 原版假文字行（6 行交替长短）
    for (let i = 0; i < 6; i++) {
      const lw = i % 2 === 0 ? 16 : 12                  // 原版行宽
      paper.rect(-pw / 2 + 3, 12 + i * 4, lw, 1.5)     // 原版 startY=12, spacing=4, margin=3
      paper.fill(0x666666)                               // 原版 lineColor
    }
    paperContainer.addChild(paper)

    // "REPORT" 红色标题（原版 fontSize=5, fill=0xff0000, fontWeight=bold）
    const reportText = new Text({ text: 'REPORT', style: {
      fontFamily: 'monospace', fontSize: 5,
      fill: 0xff0000, fontWeight: 'bold',
    }})
    reportText.anchor.set(0.5, 0)
    reportText.position.set(0, 4)                        // 原版 y=4
    paperContainer.addChild(reportText)

    c.addChild(paperContainer)

    // 标记打印机区域不可通行
    this._deskRects.push({ x: x - 25, y: y - 8, w: 50, h: 60 })

    parent.addChild(c)
  }

  /**
   * 绘制 Boss 桌区（严格翻译自原版 BossSprite.tsx）
   * 原版位于 boss.position（通常在 BOSS_RUG_POSITION 附近）
   * 包含：椅子 → Boss 胶囊体(暗色+白边框) → 桌子 → 键盘 → 显示器 → 标签 "Claude"
   * Boss 尺寸：BOSS_WIDTH=48, BOSS_HEIGHT=80, STROKE_WIDTH=4
   */
  private drawBossArea(parent: Container, x: number, y: number): void {
    // ── 椅子（原版 chairTexture anchor=0.5, x=5, y=30, scale=0.1386） ──
    const chairSprite = this.tryCreateSpriteAnchored('chair', x + 5, y + 30, 0.5, 0.5, 0.1386)
    this._chairData.push({ sprite: chairSprite, sortY: y + 20 }) // 存储椅子数据供Y-sorted层使用

    // ── 桌子（原版 deskTexture anchor(0.5,0), y=30, scale=0.105）── 全局坐标
    const deskSprite = this.tryCreateSpriteAnchored('desk', x + 0, y + 30, 0.5, 0, 0.105)
    this.deskBaseContainer.addChild(deskSprite)          // 添加桌子到底层容器

    // ── 键盘（原版 keyboardTexture anchor=0.5, y=42, scale=0.04）── 全局坐标
    const kbSprite = this.tryCreateSpriteAnchored('keyboard', x + 0, y + 42, 0.5, 0.5, 0.04)
    this.deskBaseContainer.addChild(kbSprite)            // 添加键盘到底层容器

    // ── 显示器（原版 monitorTexture anchor=0.5, x=-45, y=27, scale=0.08）── 全局坐标
    const monSprite = this.tryCreateSpriteAnchored('monitor', x - 45, y + 27, 0.5, 0.5, 0.08)
    this.deskTopContainer.addChild(monSprite)            // 添加显示器到顶层容器

    // 标记 Boss 桌区为不可通行
    this._deskRects.push({ x: x - 63, y: y + 30, w: 126, h: 45 })

    // ── 垃圾桶（原版 TrashCanSprite，TRASH_CAN_OFFSET(110,65)） ──
    this.drawTrashCan(parent, x + 110, y + 65)
  }

  /**
   * 绘制垃圾桶（严格翻译自原版 TrashCanSprite.tsx）
   * 铁丝网格垃圾桶，静态渲染 utilization=0，显示 "0%" + "context" 标签
   * 原版位置：BOSS_RUG_POSITION + TRASH_CAN_OFFSET(110,65)
   */
  private drawTrashCan(parent: Container, x: number, y: number): void {
    const c = new Container()
    c.position.set(x, y)
    c.label = 'trash-can'

    const g = new Graphics()

    // ── 垃圾桶尺寸常量 ──
    const CAN_WIDTH = 44                                   // 桶底宽度
    const CAN_HEIGHT = 52                                  // 桶高度
    const CAN_TOP_WIDTH = 50                               // 桶顶宽度
    const RIM_HEIGHT = 4                                   // 顶部边缘高度
    const WIRE_COLOR = 0x4a4a4a                            // 铁丝颜色
    const WIRE_HIGHLIGHT = 0x6a6a6a                        // 铁丝高光色
    const RIM_COLOR = 0x3a3a3a                             // 边缘颜色

    const halfWidth = CAN_WIDTH / 2                        // 22
    const halfTopWidth = CAN_TOP_WIDTH / 2                 // 25
    const topY = -CAN_HEIGHT / 2                           // -26
    const bottomY = CAN_HEIGHT / 2                         // 26

    const meshRows = 6                                     // 水平线行数
    const meshCols = 8                                     // 垂直线列数

    // ── 垂直铁丝（9根，从顶部到底部梯形收窄） ──
    for (let i = 0; i <= meshCols; i++) {
      const t = i / meshCols                               // 0 到 1
      const topX = -halfTopWidth + t * CAN_TOP_WIDTH       // 顶部 x 坐标
      const bottomX = -halfWidth + t * CAN_WIDTH           // 底部 x 坐标
      g.moveTo(topX, topY + RIM_HEIGHT)                    // 从顶部边缘下方开始
      g.lineTo(bottomX, bottomY)                           // 到底部
      g.stroke({ width: 1, color: WIRE_COLOR, alpha: 0.8 })
    }

    // ── 水平铁丝（5根，带弧度模拟3D效果） ──
    for (let i = 1; i < meshRows; i++) {
      const t = i / meshRows                               // 行位置比例
      const hy = topY + RIM_HEIGHT + t * (CAN_HEIGHT - RIM_HEIGHT) // 当前行 y 坐标
      const widthAtY = halfTopWidth - (halfTopWidth - halfWidth) * t // 当前行半宽
      g.moveTo(-widthAtY, hy)                              // 左端起点
      g.quadraticCurveTo(0, hy + 2, widthAtY, hy)         // 二次曲线弧度
      g.stroke({ width: 1, color: WIRE_COLOR, alpha: 0.7 })
    }

    // ── 左右边框线（粗 2px 高光色） ──
    g.moveTo(-halfTopWidth, topY + RIM_HEIGHT)             // 左边从顶部
    g.lineTo(-halfWidth, bottomY)                          // 到底部
    g.stroke({ width: 2, color: WIRE_HIGHLIGHT })

    g.moveTo(halfTopWidth, topY + RIM_HEIGHT)              // 右边从顶部
    g.lineTo(halfWidth, bottomY)                           // 到底部
    g.stroke({ width: 2, color: WIRE_HIGHLIGHT })

    // ── 底部曲线边框（延伸3px） ──
    const bottomExtension = 3                              // 底部视觉延伸
    g.moveTo(-halfWidth, bottomY + bottomExtension)        // 左下角
    g.quadraticCurveTo(0, bottomY + bottomExtension + 3, halfWidth, bottomY + bottomExtension)
    g.stroke({ width: 2, color: WIRE_COLOR })

    // 连接侧面到延伸底部
    g.moveTo(-halfWidth, bottomY)                          // 左侧连接
    g.lineTo(-halfWidth, bottomY + bottomExtension)
    g.stroke({ width: 2, color: WIRE_HIGHLIGHT })

    g.moveTo(halfWidth, bottomY)                           // 右侧连接
    g.lineTo(halfWidth, bottomY + bottomExtension)
    g.stroke({ width: 2, color: WIRE_HIGHLIGHT })

    // ── 顶部椭圆边缘（卷边效果） ──
    g.ellipse(0, topY + RIM_HEIGHT / 2, halfTopWidth, RIM_HEIGHT) // 外部椭圆
    g.fill(RIM_COLOR)                                      // 填充边缘色
    g.stroke({ width: 1.5, color: WIRE_HIGHLIGHT })        // 高光描边

    // ── 内部阴影椭圆 ──
    g.ellipse(0, topY + RIM_HEIGHT / 2 + 1, halfTopWidth - 2, RIM_HEIGHT - 1)
    g.stroke({ width: 1, color: 0x2a2a2a, alpha: 0.5 })   // 半透明阴影

    c.addChild(g)

    // ── 动态填充层（根据 utilization 更新） ──
    const fillGfx = new Graphics()
    c.addChild(fillGfx)
    this._trashFillGfx = fillGfx
    this._trashCanParams = { x, y }

    // ── "0%" 百分比文字（utilization=0 静态渲染） ──
    const pctText = new Text({ text: '0%', style: {
      fontFamily: 'monospace', fontSize: 22,               // 2x 渲染
      fontWeight: 'bold', fill: 0x22c55e,                  // 绿色（空桶状态）
    }})
    pctText.anchor.set(0.5, 0.5)                           // 居中锚点
    pctText.position.set(0, 38)                            // 原版 y=38
    pctText.scale.set(0.5)                                 // 缩小到 0.5x 保持清晰
    pctText.resolution = 2                                 // 高分辨率渲染
    c.addChild(pctText)
    this._trashPctText = pctText                             // 保存引用用于动态更新

    // ── "context" 标签文字 ──
    const ctxText = new Text({ text: 'context', style: {
      fontFamily: 'monospace', fontSize: 16,               // 2x 渲染
      fill: 0x666666,                                      // 灰色
    }})
    ctxText.anchor.set(0.5, 0.5)                           // 居中锚点
    ctxText.position.set(0, 46)                            // 原版 y=46
    ctxText.scale.set(0.5)                                 // 缩小到 0.5x 保持清晰
    ctxText.resolution = 2                                 // 高分辨率渲染
    c.addChild(ctxText)

    parent.addChild(c)
  }

  /**
   * 绘制电梯（严格翻译自原版 Elevator.tsx）
   * 原版使用 frameTexture scale=0.26 + doorTexture scale={0.09, 0.183}
   * 此处用 Graphics 绘制匹配外观：金属框架 + 双开门 + 指示灯
   * 原版位置：ELEVATOR_POSITION（右侧偏上，约 1200, 160）
   */
  private drawElevator(): void {
    const elevContainer = new Container()
    elevContainer.label = 'elevator'
    elevContainer.position.set(ELEVATOR_POS.x, ELEVATOR_POS.y)

    // ── 电梯框架（原版 frameTexture anchor=0.5, scale=0.26） ──
    const frame = this.tryCreateSpriteAnchored('elevatorFrame', 0, 0, 0.5, 0.5, 0.26)
    elevContainer.addChild(frame)

    // ── 左门（原版 doorTexture anchor(0,0.5) x=-50 y=9 scale(doorScale,0.183)） ──
    // 关闭状态 doorScale=0.09
    const leftDoor = this.tryCreateSpriteAnchored('elevatorDoor', -50, 9, 0, 0.5, 0.09)
    if (leftDoor instanceof Sprite) {
      leftDoor.scale.set(0.09, 0.183)                   // 原版 scale={x:0.09, y:0.183}
    }
    elevContainer.addChild(leftDoor)
    this._elevLeftDoor = leftDoor                          // 保存左门引用

    // ── 右门（原版 doorTexture anchor(1,0.5) x=50 y=9 scale(doorScale,0.183)） ──
    const rightDoor = this.tryCreateSpriteAnchored('elevatorDoor', 50, 9, 1, 0.5, 0.09)
    if (rightDoor instanceof Sprite) {
      rightDoor.scale.set(0.09, 0.183)                  // 原版 scale={x:0.09, y:0.183}
    }
    elevContainer.addChild(rightDoor)
    this._elevRightDoor = rightDoor                        // 保存右门引用

    // ── 指示灯（原版 rect(-5,-67,10,8)，关闭状态红色 0xef4444） ──
    const indicator = new Graphics()
    indicator.rect(-5, -67, 10, 8)
    indicator.fill(0xef4444)                             // 红色 = 关闭状态
    elevContainer.addChild(indicator)
    this._elevIndicator = indicator                        // 保存指示灯引用

    this.container.addChild(elevContainer)

    // 标记电梯区域不可通行（框架估算约 100x150）
    this._deskRects.push({
      x: ELEVATOR_POS.x - 50,
      y: ELEVATOR_POS.y - 75,
      w: 100,
      h: 150,
    })

    console.log('[OfficeMap] 电梯绘制完成')
  }

  // ══════════════════════════════════════════════
  //  工具方法
  // ══════════════════════════════════════════════

  /**
   * 尝试创建 Sprite（anchor+scale 模式），纹理不存在时回退为 Graphics 纯色矩形
   * 与原版 DeskGrid.tsx 一致，使用 anchor 定位 + scale 缩放
   * @param textureName 纹理名称（对应 TextureLoader 中的 key）
   * @param x 锚点 X 坐标
   * @param y 锚点 Y 坐标
   * @param anchorX 锚点 X（0-1）
   * @param anchorY 锚点 Y（0-1）
   * @param scale 统一缩放比例
   * @returns Sprite 或 Graphics 容器
   */
  private tryCreateSpriteAnchored(textureName: string, x: number, y: number, anchorX: number, anchorY: number, scale: number): Container {
    const texture = getTexture(textureName)              // 尝试获取纹理

    if (texture) {
      // 纹理加载成功，使用 anchor + scale 创建 Sprite（与原版一致）
      const sprite = new Sprite(texture)                 // 创建精灵
      sprite.anchor.set(anchorX, anchorY)                // 设置锚点
      sprite.scale.set(scale, scale)                     // 设置缩放
      sprite.position.set(x, y)                          // 设置位置
      sprite.label = textureName                         // 调试标签
      return sprite
    }

    // 纹理未加载，估算回退矩形尺寸（假定原始纹理约 256x256）
    const estSize = 256 * scale                          // 估算渲染尺寸
    const fallbackW = Math.max(estSize, 8)               // 最小 8px
    const fallbackH = Math.max(estSize, 8)               // 最小 8px
    const fallbackX = x - fallbackW * anchorX            // 根据锚点算左上角 X
    const fallbackY = y - fallbackH * anchorY            // 根据锚点算左上角 Y

    const color = FALLBACK_COLORS[textureName] ?? 0x888888 // 获取回退颜色
    const gfx = new Graphics()
    gfx.rect(fallbackX, fallbackY, fallbackW, fallbackH) // 绘制矩形
    gfx.fill({ color, alpha: 0.8 })                      // 填充颜色
    gfx.rect(fallbackX, fallbackY, fallbackW, 1)         // 上边线
    gfx.rect(fallbackX, fallbackY + fallbackH - 1, fallbackW, 1) // 下边线
    gfx.rect(fallbackX, fallbackY, 1, fallbackH)         // 左边线
    gfx.rect(fallbackX + fallbackW - 1, fallbackY, 1, fallbackH) // 右边线
    gfx.fill({ color: 0x000000, alpha: 0.2 })            // 半透明边线
    gfx.label = `${textureName}-fallback`                // 调试标签
    return gfx
  }

  // ══════════════════════════════════════════════
  //  DeskMarquee 滚动文字系统
  //  翻译自 claude-office MarqueeText.tsx + DeskMarquee.tsx
  //  位于 DeskSurfacesTop 层，工位被占用时显示绿色滚动任务文字
  // ══════════════════════════════════════════════

  /** Marquee 面板宽度（原版默认 116） */
  private static readonly MARQUEE_WIDTH = 116
  /** Marquee 面板高度（原版 panelHeight = 14） */
  private static readonly MARQUEE_HEIGHT = 14
  /** Marquee Y 偏移（原版默认 y=70） */
  private static readonly MARQUEE_Y = 70
  /** Marquee 文字颜色（原版 #00ff88） */
  private static readonly MARQUEE_COLOR = '#00ff88'
  /** 每字符估算宽度（原版 5.5px at fontSize 9） */
  private static readonly CHAR_WIDTH = 5.5
  /** 滚动速度（原版 40ms/px） */
  private static readonly SCROLL_SPEED = 40

  /**
   * 为单个工位创建 marquee 滚动文字容器（默认隐藏）
   */
  private createDeskMarquee(parent: Container, cx: number, cy: number, deskIndex: number): void {
    const W = OfficeMap.MARQUEE_WIDTH                  // 面板宽度
    const H = OfficeMap.MARQUEE_HEIGHT                 // 面板高度

    // 根容器，居中于工位上方
    const root = new Container()
    root.position.set(cx, cy + OfficeMap.MARQUEE_Y)    // 原版 x=0, y=70 (相对工位)
    root.visible = false                               // 默认隐藏
    root.label = `marquee-${deskIndex}`

    // 背景面板（深色半透明 + 边框）
    const panel = new Graphics()
    panel.roundRect(-W / 2, -H / 2, W, H, 3)          // 居中绘制
    panel.fill({ color: 0x1a1a1a, alpha: 0.9 })       // 原版 alpha=0.9
    panel.stroke({ width: 1, color: 0x444444 })        // 原版边框色
    root.addChild(panel)

    // 裁剪遮罩（比面板内缩 4px padding）
    const mask = new Graphics()
    mask.roundRect(-W / 2 + 4, -H / 2 + 1, W - 8, H - 2, 2) // 原版参数
    mask.fill(0xffffff)
    root.addChild(mask)

    // 文字容器（2x 渲染后 0.5x 缩放，提升清晰度 — 原版技巧）
    const textContainer = new Container()
    textContainer.scale.set(0.5)                       // 原版 scale={0.5}
    textContainer.mask = mask                          // 应用裁剪遮罩

    const textObj = new Text({
      text: '',
      style: {
        fontFamily: '"Courier New", monospace',        // 原版字体
        fontSize: 18,                                  // 原版 fontSize: 18（2x渲染）
        fill: OfficeMap.MARQUEE_COLOR,                 // 原版 #00ff88
        fontWeight: 'bold',                            // 原版 fontWeight: bold
      },
      resolution: 2,                                   // 原版 resolution={2}
    })
    textObj.anchor.set(0.5, 0.5)                       // 默认居中
    textContainer.addChild(textObj)
    root.addChild(textContainer)

    parent.addChild(root)

    // 注册到 marquee 映射表
    this._marquees.set(deskIndex, {
      container: root,
      textObj,
      mask,
      panel,
      text: '',
      offset: 0,
      shouldScroll: false,
      estimatedWidth: 0,
      startTime: 0,
    })
  }

  /**
   * 更新指定工位的 marquee 文字（由 OfficeScene 在 Agent 状态更新时调用）
   * @param deskIndex 工位索引（0-based）
   * @param text 任务文字（空字符串隐藏 marquee）
   */
  updateDeskMarquee(deskIndex: number, text: string): void {
    const m = this._marquees.get(deskIndex)
    if (!m) return

    // 规范化文字（去换行、折叠空格 — 原版逻辑）
    const normalized = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()

    if (!normalized) {
      m.container.visible = false                      // 无文字时隐藏
      m.text = ''
      return
    }

    m.container.visible = true                         // 有文字时显示

    if (normalized !== m.text) {
      // 文字变化，重新计算滚动参数
      m.text = normalized
      m.textObj.text = normalized

      const W = OfficeMap.MARQUEE_WIDTH
      const innerWidth = W - 8                         // 原版 padding 各 4px
      m.estimatedWidth = normalized.length * OfficeMap.CHAR_WIDTH // 估算文字像素宽
      m.shouldScroll = m.estimatedWidth > innerWidth   // 超宽则滚动

      if (m.shouldScroll) {
        m.textObj.anchor.set(0, 0.5)                   // 滚动时左对齐
        m.startTime = performance.now()                // 记录滚动起始时间
      } else {
        m.textObj.anchor.set(0.5, 0.5)                 // 不滚动时居中
        m.textObj.position.set(0, 0)                   // 重置位置
      }
    }
  }

  /**
   * 每帧更新所有 marquee 滚动动画（由 OfficeScene ticker 调用）
   */
  /** 打开电梯门（500ms ease-out cubic 动画） */
  openElevator(): void {
    if (this._elevDoorOpen) return
    this._elevDoorOpen = true
    this._elevAnimStart = performance.now()
    this._elevAnimating = true
  }

  /** 关闭电梯门（500ms ease-out cubic 动画） */
  closeElevator(): void {
    if (!this._elevDoorOpen) return
    this._elevDoorOpen = false
    this._elevAnimStart = performance.now()
    this._elevAnimating = true
  }

  /** 每帧更新电梯门动画 */
  private tickElevator(): void {
    if (!this._elevAnimating || !this._elevLeftDoor || !this._elevRightDoor) return

    const elapsed = performance.now() - this._elevAnimStart
    const duration = 500                                     // 500ms 动画时长
    const t = Math.min(elapsed / duration, 1)                // 0~1 进度
    // ease-out cubic: 1 - (1-t)^3
    const eased = 1 - Math.pow(1 - t, 3)

    // 门关闭时 scaleX=0.09，打开时 scaleX=0
    const closedScale = 0.09
    const targetScale = this._elevDoorOpen
      ? closedScale * (1 - eased)                            // 关→开：0.09→0
      : closedScale * eased                                  // 开→关：0→0.09

    if (this._elevLeftDoor instanceof Sprite) {
      this._elevLeftDoor.scale.x = targetScale
    }
    if (this._elevRightDoor instanceof Sprite) {
      this._elevRightDoor.scale.x = targetScale
    }

    // 更新指示灯颜色
    if (this._elevIndicator) {
      this._elevIndicator.clear()
      this._elevIndicator.rect(-5, -67, 10, 8)
      this._elevIndicator.fill(this._elevDoorOpen ? 0x22c55e : 0xef4444) // 开=绿，关=红
    }

    if (t >= 1) this._elevAnimating = false                  // 动画完成
  }

  /** 更新垃圾桶填充状态（原版 5 级填充） */
  updateTrashCan(utilization: number): void {
    if (!this._trashFillGfx || !this._trashPctText) return

    const u = Math.max(0, Math.min(1, utilization))          // 限制 0~1
    const pct = Math.round(u * 100)

    // 更新百分比文字
    this._trashPctText.text = `${pct}%`

    // 颜色：0%绿 → 50%黄 → 80%橙 → 100%红
    let color: number
    if (u < 0.3) color = 0x22c55e                            // 绿色
    else if (u < 0.5) color = 0xeab308                       // 黄色
    else if (u < 0.8) color = 0xf97316                       // 橙色
    else color = 0xef4444                                     // 红色
    this._trashPctText.style.fill = color

    // 绘制填充（从底部向上填充）
    const CAN_WIDTH = 44, CAN_HEIGHT = 52, CAN_TOP_WIDTH = 50
    const halfW = CAN_WIDTH / 2, halfTopW = CAN_TOP_WIDTH / 2
    const bottomY = CAN_HEIGHT / 2
    const fillH = CAN_HEIGHT * u * 0.8                       // 最多填充 80% 高度
    const fillTop = bottomY - fillH

    this._trashFillGfx.clear()
    if (u > 0.01) {
      // 梯形填充区域
      const topRatio = (bottomY - fillTop) / CAN_HEIGHT
      const wAtFillTop = halfW + (halfTopW - halfW) * (1 - topRatio)
      this._trashFillGfx.moveTo(-wAtFillTop, fillTop)
      this._trashFillGfx.lineTo(wAtFillTop, fillTop)
      this._trashFillGfx.lineTo(halfW, bottomY)
      this._trashFillGfx.lineTo(-halfW, bottomY)
      this._trashFillGfx.closePath()
      this._trashFillGfx.fill({ color, alpha: 0.3 })
    }
  }

  /** 更新安全标牌计数器 */
  updateSafetyCount(count: number): void {
    if (this._safetyNumText) {
      this._safetyNumText.text = String(count)               // 更新数字
    }
  }

  tickMarquees(): void {
    // 更新时钟指针
    this.tickClock()
    // 每分钟更新城市窗户（天空/建筑灯光随时间变化）
    this.tickCityWindow()
    // 更新电梯门动画
    this.tickElevator()

    const now = performance.now()
    const W = OfficeMap.MARQUEE_WIDTH
    const innerWidth = W - 8                           // 内部可视宽度

    for (const m of this._marquees.values()) {
      if (!m.container.visible || !m.shouldScroll) continue

      // 计算滚动进度（原版逻辑：从右到左循环）
      const scrollDistance = m.estimatedWidth + innerWidth // 总滚动距离
      const scrollDuration = scrollDistance * OfficeMap.SCROLL_SPEED // 总时长（ms）
      const elapsed = now - m.startTime
      const progress = (elapsed % scrollDuration) / scrollDuration

      // 原版公式：innerWidth / 2 - progress * scrollDistance（然后 * 2 因为 0.5x 缩放）
      const offset = (innerWidth / 2 - progress * scrollDistance) * 2
      m.textObj.position.set(offset, 0)                // 更新文字 X 位置
    }
  }
}

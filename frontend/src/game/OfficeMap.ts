/**
 * 办公室地图渲染器 - OfficeMap.ts
 *
 * 使用纯 PixiJS Graphics 代码绘制有立体感的办公室地图，不依赖外部素材：
 * - drawMap(): 根据配置绘制完整的办公室地图
 * - 绘制内容：棋盘格地板、墙壁+窗户、功能区域底色、立体桌椅、显示器、绿植、饮水机
 *
 * 所有家具都用 Graphics 代码绘制，阴影/高光产生立体效果。
 * 使用 PixiJS 8 API（Graphics.rect().fill() 而非旧版 beginFill）。
 *
 * 函数列表：
 *   constructor() - 创建地图根容器
 *   drawMap() - 绘制完整办公室（地板/墙壁/区域/桌椅/装饰/标签）
 *   getWalkableGrid() - 返回可通行网格（供 PathSystem 使用）
 *   drawFloor() - 绘制深色棋盘格地板
 *   drawWalls() - 绘制墙壁 + 窗户装饰
 *   drawZones() - 绘制功能区域半透明底色
 *   drawDesks() - 绘制立体桌面 + 显示器 + 椅子
 *   drawDecorations() - 绘制绿植/饮水机/咖啡机/会议桌/白板
 *   drawZoneLabels() - 绘制区域标签文字
 */
import { Container, Graphics, Text } from 'pixi.js'
import { TILE_SIZE } from './TileConfig'

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

// 颜色常量定义
const COLORS = {
  // 地板
  FLOOR_DARK: 0x2d2d3f,      // 深色格子
  FLOOR_LIGHT: 0x323248,     // 浅色格子
  // 墙壁
  WALL: 0x1a1a28,            // 墙壁主色
  WALL_TRIM: 0x252538,       // 墙壁装饰条
  WINDOW: 0x4488aa,          // 窗户玻璃色
  WINDOW_FRAME: 0x333348,    // 窗框色
  WINDOW_SHINE: 0x66aacc,    // 窗户反光
  // 家具
  DESK: 0x8b6914,            // 桌面木色
  DESK_HIGHLIGHT: 0xa07818,  // 桌面高光
  DESK_SIDE: 0x6b4c10,       // 桌子侧面（暗色）
  MONITOR_SCREEN: 0x4488aa,  // 显示器屏幕
  MONITOR_FRAME: 0x333333,   // 显示器边框
  MONITOR_STAND: 0x555555,   // 显示器支架
  CHAIR_SEAT: 0x4a4a5a,      // 椅子座面
  CHAIR_BACK: 0x3a3a4a,      // 椅子靠背
  // 文字
  TEXT: 0xaaaaaa,             // 标签文字色
  // 区域底色
  ZONE_REST: 0x1a3a1a,       // 休息区（深绿）
  ZONE_WORK: 0x1a1a3a,       // 工作区（深蓝）
  ZONE_MEETING: 0x3a2a1a,    // 会议区（深橙）
  ZONE_BUG: 0x3a1a1a,        // Bug 角（深红）
  // 装饰
  PLANT_LEAF: 0x2d8b46,      // 绿植叶子
  PLANT_LEAF_LIGHT: 0x3ca85a, // 绿植亮叶
  PLANT_POT: 0x8b6914,       // 花盆
  PLANT_POT_RIM: 0xa07818,   // 花盆口沿
  WATER_BODY: 0xcccccc,      // 饮水机机身
  WATER_TANK: 0x88bbdd,      // 饮水机水桶
  COFFEE_BODY: 0x4a3a2a,     // 咖啡机机身
  COFFEE_TOP: 0x6b5a4a,      // 咖啡机顶部
} as const

/** 区域类型与颜色映射 */
const ZONE_COLOR_MAP: Record<string, number> = {
  'rest': COLORS.ZONE_REST,         // 休息区 -> 深绿
  'work': COLORS.ZONE_WORK,         // 工作区 -> 深蓝
  'meeting': COLORS.ZONE_MEETING,   // 会议区 -> 深橙
  'bug': COLORS.ZONE_BUG,           // Bug角 -> 深红
}

/** 墙壁高度（像素） */
const WALL_HEIGHT = 100

/** 窗户配置 */
const WINDOW_W = 60            // 窗户宽度
const WINDOW_H = 40            // 窗户高度
const WINDOW_SPACING = 200     // 窗户间距

export class OfficeMap {
  container: Container                       // 地图根容器

  private _mapWidth = 0                      // 缓存地图宽度
  private _mapHeight = 0                     // 缓存地图高度
  private _desks: DeskConfig[] = []          // 缓存工位配置

  constructor() {
    this.container = new Container()         // 创建根容器
    this.container.label = 'office-map'      // 设置调试标签
  }

  /**
   * 绘制完整的办公室地图
   * @param zones 功能区域配置（key 为区域类型）
   * @param desks 工位配置数组
   * @param mapWidth 地图总宽度（像素）
   * @param mapHeight 地图总高度（像素）
   */
  drawMap(zones: Record<string, ZoneConfig>, desks: DeskConfig[], mapWidth: number, mapHeight: number): void {
    this.container.removeChildren()          // 先清空旧内容
    this._mapWidth = mapWidth                // 缓存宽度
    this._mapHeight = mapHeight              // 缓存高度
    this._desks = desks                      // 缓存工位

    this.drawFloor(mapWidth, mapHeight)      // 第一层：棋盘格地板
    this.drawWalls(mapWidth)                 // 第二层：墙壁 + 窗户
    this.drawZones(zones)                    // 第三层：功能区域底色
    this.drawDesks(desks)                    // 第四层：立体桌椅 + 显示器
    this.drawDecorations(zones)              // 第五层：绿植/饮水机/咖啡机等装饰
    this.drawZoneLabels(zones)               // 第六层：区域标签文字

    console.log(`[OfficeMap] 地图绘制完成 ${mapWidth}x${mapHeight}，区域数=${Object.keys(zones).length}，工位数=${desks.length}`)
  }

  /**
   * 获取可通行网格数据（供 PathSystem 使用）
   * @returns 二维布尔数组，true 表示可通行
   */
  getWalkableGrid(): boolean[][] {
    const cols = Math.ceil(this._mapWidth / TILE_SIZE)                    // 网格列数
    const rows = Math.ceil(this._mapHeight / TILE_SIZE)                   // 网格行数

    // 初始化全部可通行
    const grid: boolean[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => true)
    )

    // 标记墙壁区域为不可通行（顶部 WALL_HEIGHT 像素）
    const wallRows = Math.ceil(WALL_HEIGHT / TILE_SIZE)                   // 墙壁占多少行
    for (let r = 0; r < wallRows; r++) {
      for (let c = 0; c < cols; c++) {
        grid[r]![c] = false                                               // 墙壁不可通行
      }
    }

    // 标记边缘墙壁（左右下各 8px，约 1 格）
    for (let r = 0; r < rows; r++) {
      if (grid[r]![0] !== undefined) grid[r]![0] = false                  // 左墙
      if (cols > 1 && grid[r]![cols - 1] !== undefined) grid[r]![cols - 1] = false // 右墙
    }
    for (let c = 0; c < cols; c++) {
      if (rows > 1 && grid[rows - 1]![c] !== undefined) grid[rows - 1]![c] = false // 下墙
    }

    // 标记桌子为不可通行
    for (const desk of this._desks) {
      const startCol = Math.floor(desk.x / TILE_SIZE)                     // 桌子起始列
      const endCol = Math.ceil((desk.x + desk.width) / TILE_SIZE)         // 桌子结束列
      const startRow = Math.floor(desk.y / TILE_SIZE)                     // 桌子起始行
      const endRow = Math.ceil((desk.y + desk.height) / TILE_SIZE)        // 桌子结束行
      for (let r = startRow; r < endRow && r < rows; r++) {
        for (let c = startCol; c < endCol && c < cols; c++) {
          if (r >= 0 && c >= 0) grid[r]![c] = false                      // 桌子不可通行
        }
      }
    }

    return grid
  }

  /**
   * 绘制深色棋盘格地板
   * @param mapWidth 地图宽度
   * @param mapHeight 地图高度
   */
  private drawFloor(mapWidth: number, mapHeight: number): void {
    const floor = new Graphics()
    const gridSize = TILE_SIZE                                            // 每格 32px

    // 交替绘制深浅两色格子
    for (let y = 0; y < mapHeight; y += gridSize) {
      for (let x = 0; x < mapWidth; x += gridSize) {
        const isEven = ((x / gridSize) + (y / gridSize)) % 2 === 0       // 判断奇偶格
        const color = isEven ? COLORS.FLOOR_DARK : COLORS.FLOOR_LIGHT    // 选择颜色
        floor.rect(x, y, gridSize, gridSize)                             // 绘制方格
        floor.fill({ color })                                             // 填充颜色
      }
    }

    this.container.addChild(floor)                                        // 添加到容器
  }

  /**
   * 绘制墙壁 + 窗户装饰
   * @param mapWidth 地图宽度
   */
  private drawWalls(mapWidth: number): void {
    const walls = new Graphics()

    // 墙壁主体（顶部 WALL_HEIGHT 像素区域）
    walls.rect(0, 0, mapWidth, WALL_HEIGHT)                               // 墙壁背景
    walls.fill({ color: COLORS.WALL })

    // 墙壁底部装饰条（踢脚线）
    walls.rect(0, WALL_HEIGHT - 4, mapWidth, 4)                           // 底部装饰条
    walls.fill({ color: COLORS.WALL_TRIM })

    // 墙壁顶部装饰条（顶线）
    walls.rect(0, 0, mapWidth, 3)                                         // 顶部装饰条
    walls.fill({ color: COLORS.WALL_TRIM })

    this.container.addChild(walls)

    // 绘制窗户（均匀分布在墙壁上）
    const windowY = (WALL_HEIGHT - WINDOW_H) / 2                          // 窗户垂直居中
    const windowCount = Math.floor((mapWidth - 100) / WINDOW_SPACING)     // 窗户数量
    const startX = (mapWidth - (windowCount - 1) * WINDOW_SPACING) / 2    // 起始 X（居中分布）

    for (let i = 0; i < windowCount; i++) {
      const wx = startX + i * WINDOW_SPACING - WINDOW_W / 2              // 窗户左上角 X
      const winGfx = new Graphics()

      // 窗框
      winGfx.rect(wx - 3, windowY - 3, WINDOW_W + 6, WINDOW_H + 6)      // 外框
      winGfx.fill({ color: COLORS.WINDOW_FRAME })

      // 窗户玻璃
      winGfx.rect(wx, windowY, WINDOW_W, WINDOW_H)                       // 玻璃区域
      winGfx.fill({ color: COLORS.WINDOW })

      // 窗户十字分隔
      winGfx.rect(wx + WINDOW_W / 2 - 1, windowY, 2, WINDOW_H)          // 垂直分隔
      winGfx.fill({ color: COLORS.WINDOW_FRAME })
      winGfx.rect(wx, windowY + WINDOW_H / 2 - 1, WINDOW_W, 2)          // 水平分隔
      winGfx.fill({ color: COLORS.WINDOW_FRAME })

      // 窗户反光（左上角斜条）
      winGfx.rect(wx + 4, windowY + 4, 12, 3)                            // 反光条1
      winGfx.fill({ color: COLORS.WINDOW_SHINE, alpha: 0.4 })
      winGfx.rect(wx + 4, windowY + 10, 8, 2)                            // 反光条2
      winGfx.fill({ color: COLORS.WINDOW_SHINE, alpha: 0.25 })

      this.container.addChild(winGfx)
    }
  }

  /**
   * 绘制功能区域半透明底色 + 边框
   * @param zones 区域配置字典
   */
  private drawZones(zones: Record<string, ZoneConfig>): void {
    for (const [key, zone] of Object.entries(zones)) {
      const zoneGfx = new Graphics()

      // 根据区域类型选择颜色
      const color = ZONE_COLOR_MAP[key] ?? COLORS.ZONE_WORK              // 默认工作区色

      // 区域底色（半透明填充）
      zoneGfx.rect(zone.x, zone.y, zone.width, zone.height)
      zoneGfx.fill({ color, alpha: 0.4 })

      // 区域边框
      zoneGfx.rect(zone.x, zone.y, zone.width, 2)                        // 上边框
      zoneGfx.rect(zone.x, zone.y + zone.height - 2, zone.width, 2)      // 下边框
      zoneGfx.rect(zone.x, zone.y, 2, zone.height)                        // 左边框
      zoneGfx.rect(zone.x + zone.width - 2, zone.y, 2, zone.height)      // 右边框
      zoneGfx.fill({ color, alpha: 0.6 })

      this.container.addChild(zoneGfx)
    }
  }

  /**
   * 绘制立体工位：梯形侧面 + 矩形桌面 + 高光 + 显示器 + 椅子
   * @param desks 工位配置数组
   */
  private drawDesks(desks: DeskConfig[]): void {
    for (const desk of desks) {
      const deskGfx = new Graphics()

      // ── 桌子阴影 ──
      deskGfx.rect(desk.x + 2, desk.y + desk.height + 1, desk.width, 3)  // 桌子下方阴影
      deskGfx.fill({ color: 0x000000, alpha: 0.2 })

      // ── 桌子侧面（立体感，桌面下方的梯形用矩形模拟） ──
      deskGfx.rect(desk.x + 2, desk.y + desk.height - 2, desk.width - 4, 6) // 侧面（暗色）
      deskGfx.fill({ color: COLORS.DESK_SIDE })

      // ── 桌面主体 ──
      deskGfx.rect(desk.x, desk.y, desk.width, desk.height)              // 桌面矩形
      deskGfx.fill({ color: COLORS.DESK })

      // ── 桌面高光边（顶部和左侧亮边） ──
      deskGfx.rect(desk.x, desk.y, desk.width, 2)                        // 顶部高光
      deskGfx.fill({ color: COLORS.DESK_HIGHLIGHT })
      deskGfx.rect(desk.x, desk.y, 2, desk.height)                       // 左侧高光
      deskGfx.fill({ color: COLORS.DESK_HIGHLIGHT, alpha: 0.6 })

      this.container.addChild(deskGfx)

      // ── 显示器 ──
      const monW = 14                                                     // 显示器宽度
      const monH = 10                                                     // 显示器高度
      const monX = desk.x + (desk.width - monW) / 2                      // 水平居中
      const monY = desk.y + 4                                             // 桌面上方偏内
      const monGfx = new Graphics()

      // 显示器边框
      monGfx.rect(monX - 2, monY - 2, monW + 4, monH + 4)               // 黑色外框
      monGfx.fill({ color: COLORS.MONITOR_FRAME })

      // 显示器屏幕
      monGfx.rect(monX, monY, monW, monH)                                // 蓝色屏幕
      monGfx.fill({ color: COLORS.MONITOR_SCREEN })

      // 屏幕反光
      monGfx.rect(monX + 1, monY + 1, 4, 2)                             // 左上角反光
      monGfx.fill({ color: 0x66aacc, alpha: 0.4 })

      // 显示器支架
      monGfx.rect(monX + monW / 2 - 2, monY + monH + 2, 4, 3)           // 支架竖杆
      monGfx.fill({ color: COLORS.MONITOR_STAND })
      monGfx.rect(monX + monW / 2 - 4, monY + monH + 4, 8, 2)           // 支架底座
      monGfx.fill({ color: COLORS.MONITOR_STAND })

      this.container.addChild(monGfx)

      // ── 椅子（圆形座面 + 靠背） ──
      const chairGfx = new Graphics()
      const chairCX = desk.x + desk.width / 2                            // 椅子中心 X
      const chairCY = desk.y + desk.height + 12                          // 椅子中心 Y

      // 椅子阴影
      chairGfx.ellipse(chairCX, chairCY + 6, 8, 3)                       // 椅子下方阴影
      chairGfx.fill({ color: 0x000000, alpha: 0.15 })

      // 靠背（半圆弧，在座面后方）
      chairGfx.roundRect(chairCX - 8, chairCY - 4, 16, 6, 3)            // 靠背矩形
      chairGfx.fill({ color: COLORS.CHAIR_BACK })

      // 座面（圆形）
      chairGfx.circle(chairCX, chairCY + 2, 7)                           // 圆形座面
      chairGfx.fill({ color: COLORS.CHAIR_SEAT })

      // 座面高光
      chairGfx.circle(chairCX - 2, chairCY, 3)                           // 左上方高光
      chairGfx.fill({ color: 0x5a5a6a, alpha: 0.5 })

      this.container.addChild(chairGfx)
    }
  }

  /**
   * 绘制装饰物：绿植/饮水机/咖啡机/沙发/会议桌/白板/Bug 警告
   * @param zones 区域配置字典
   */
  private drawDecorations(zones: Record<string, ZoneConfig>): void {
    // ── 休息区装饰 ──
    const rest = zones['rest']
    if (rest) {
      // 沙发（L 形）
      this.drawSofa(rest.x + 20, rest.y + rest.height - 80)

      // 绿植 1（休息区右上角）
      this.drawPlant(rest.x + rest.width - 40, rest.y + 50, 12)

      // 饮水机（休息区右侧中间）
      this.drawWaterDispenser(rest.x + rest.width - 35, rest.y + rest.height / 2 - 15)

      // 绿植 2（沙发旁）
      this.drawPlant(rest.x + 100, rest.y + rest.height - 60, 8)
    }

    // ── 工作区装饰 ──
    const work = zones['work']
    if (work) {
      // 咖啡机（工作区右上角）
      this.drawCoffeeMachine(work.x + work.width - 40, work.y + 30)

      // 绿植（工作区左下角）
      this.drawPlant(work.x + 20, work.y + work.height - 40, 10)
    }

    // ── 会议区装饰 ──
    const meeting = zones['meeting']
    if (meeting) {
      // 会议圆桌
      const cx = meeting.x + meeting.width / 2                           // 中心 X
      const cy = meeting.y + meeting.height / 2 + 10                     // 中心 Y
      this.drawMeetingTable(cx, cy)

      // 白板
      this.drawWhiteboard(meeting.x + meeting.width - 45, meeting.y + 40)
    }

    // ── Bug 角落装饰 ──
    const bug = zones['bug']
    if (bug) {
      this.drawBugWarning(bug)
    }
  }

  /**
   * 绘制沙发
   * @param x 左上角 X
   * @param y 左上角 Y
   */
  private drawSofa(x: number, y: number): void {
    const gfx = new Graphics()

    // 沙发阴影
    gfx.roundRect(x + 2, y + 38, 62, 4, 2)
    gfx.fill({ color: 0x000000, alpha: 0.15 })

    // 沙发靠背
    gfx.roundRect(x, y, 60, 20, 4)
    gfx.fill({ color: 0x6b4c3b })

    // 沙发坐垫
    gfx.roundRect(x, y + 18, 60, 18, 4)
    gfx.fill({ color: 0x8b6c5b })

    // 坐垫高光
    gfx.roundRect(x + 4, y + 20, 24, 6, 2)
    gfx.fill({ color: 0x9b7c6b, alpha: 0.5 })

    // 左扶手
    gfx.roundRect(x - 2, y + 4, 8, 32, 3)
    gfx.fill({ color: 0x5b3c2b })

    // 右扶手
    gfx.roundRect(x + 54, y + 4, 8, 32, 3)
    gfx.fill({ color: 0x5b3c2b })

    this.container.addChild(gfx)
  }

  /**
   * 绘制绿植（渐变绿圆形树冠 + 褐色花盆）
   * @param cx 中心 X
   * @param cy 中心 Y（花盆底部）
   * @param size 大小比例
   */
  private drawPlant(cx: number, cy: number, size: number): void {
    const gfx = new Graphics()

    // 花盆阴影
    gfx.ellipse(cx, cy + 2, size * 0.8, 3)
    gfx.fill({ color: 0x000000, alpha: 0.15 })

    // 花盆
    gfx.rect(cx - size * 0.6, cy - size * 0.8, size * 1.2, size * 0.8)
    gfx.fill({ color: COLORS.PLANT_POT })

    // 花盆口沿
    gfx.rect(cx - size * 0.7, cy - size * 0.9, size * 1.4, size * 0.25)
    gfx.fill({ color: COLORS.PLANT_POT_RIM })

    // 树冠（多个重叠圆形模拟蓬松感）
    gfx.circle(cx, cy - size * 1.8, size * 0.9)                          // 中心圆
    gfx.fill({ color: COLORS.PLANT_LEAF })
    gfx.circle(cx - size * 0.5, cy - size * 1.5, size * 0.7)            // 左下
    gfx.fill({ color: COLORS.PLANT_LEAF })
    gfx.circle(cx + size * 0.5, cy - size * 1.5, size * 0.7)            // 右下
    gfx.fill({ color: COLORS.PLANT_LEAF })
    gfx.circle(cx - size * 0.3, cy - size * 2.2, size * 0.6)            // 左上（亮色）
    gfx.fill({ color: COLORS.PLANT_LEAF_LIGHT })
    gfx.circle(cx + size * 0.4, cy - size * 2.0, size * 0.5)            // 右上（亮色）
    gfx.fill({ color: COLORS.PLANT_LEAF_LIGHT })

    // 树干
    gfx.rect(cx - 2, cy - size * 1.1, 4, size * 0.4)
    gfx.fill({ color: 0x6b4c3b })

    this.container.addChild(gfx)
  }

  /**
   * 绘制饮水机
   * @param x 左上角 X
   * @param y 左上角 Y
   */
  private drawWaterDispenser(x: number, y: number): void {
    const gfx = new Graphics()

    // 阴影
    gfx.ellipse(x + 8, y + 30, 8, 3)
    gfx.fill({ color: 0x000000, alpha: 0.15 })

    // 机身
    gfx.roundRect(x, y, 16, 28, 2)
    gfx.fill({ color: COLORS.WATER_BODY })

    // 机身高光
    gfx.rect(x + 1, y + 1, 3, 26)
    gfx.fill({ color: 0xdddddd, alpha: 0.5 })

    // 水桶（顶部蓝色部分）
    gfx.roundRect(x + 2, y + 2, 12, 10, 2)
    gfx.fill({ color: COLORS.WATER_TANK })

    // 水桶反光
    gfx.rect(x + 4, y + 3, 3, 6)
    gfx.fill({ color: 0xaaddee, alpha: 0.4 })

    // 出水口
    gfx.rect(x + 5, y + 16, 6, 3)
    gfx.fill({ color: 0x888888 })

    // 底座
    gfx.rect(x + 2, y + 26, 12, 4)
    gfx.fill({ color: 0x999999 })

    this.container.addChild(gfx)
  }

  /**
   * 绘制咖啡机
   * @param x 左上角 X
   * @param y 左上角 Y
   */
  private drawCoffeeMachine(x: number, y: number): void {
    const gfx = new Graphics()

    // 阴影
    gfx.ellipse(x + 8, y + 24, 8, 3)
    gfx.fill({ color: 0x000000, alpha: 0.15 })

    // 机身
    gfx.roundRect(x, y, 16, 22, 2)
    gfx.fill({ color: COLORS.COFFEE_BODY })

    // 顶部
    gfx.roundRect(x - 1, y - 2, 18, 6, 2)
    gfx.fill({ color: COLORS.COFFEE_TOP })

    // 显示面板（小亮色矩形）
    gfx.rect(x + 3, y + 6, 10, 4)
    gfx.fill({ color: 0x88aa66 })

    // 出液口
    gfx.rect(x + 5, y + 14, 6, 2)
    gfx.fill({ color: 0x333333 })

    // 杯子托盘
    gfx.rect(x + 2, y + 18, 12, 3)
    gfx.fill({ color: 0x666666 })

    this.container.addChild(gfx)
  }

  /**
   * 绘制会议圆桌 + 围椅
   * @param cx 中心 X
   * @param cy 中心 Y
   */
  private drawMeetingTable(cx: number, cy: number): void {
    const gfx = new Graphics()

    // 桌子阴影
    gfx.ellipse(cx, cy + 4, 34, 8)
    gfx.fill({ color: 0x000000, alpha: 0.15 })

    // 圆桌面（外圈暗色）
    gfx.circle(cx, cy, 30)
    gfx.fill({ color: 0x6b5030 })

    // 圆桌面（内圈高光）
    gfx.circle(cx, cy, 26)
    gfx.fill({ color: 0x7b6040 })

    // 桌面反光
    gfx.ellipse(cx - 8, cy - 6, 10, 6)
    gfx.fill({ color: 0x8b7050, alpha: 0.5 })

    // 会议椅（围绕圆桌 6 把）
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2                  // 均匀分布角度
      const chairX = cx + Math.cos(angle) * 44                           // 椅子 X
      const chairY = cy + Math.sin(angle) * 44                           // 椅子 Y

      // 椅子阴影
      gfx.ellipse(chairX, chairY + 2, 6, 2)
      gfx.fill({ color: 0x000000, alpha: 0.1 })

      // 座面
      gfx.circle(chairX, chairY, 6)
      gfx.fill({ color: COLORS.CHAIR_SEAT })

      // 座面高光
      gfx.circle(chairX - 1, chairY - 1, 3)
      gfx.fill({ color: 0x5a5a6a, alpha: 0.4 })
    }

    this.container.addChild(gfx)
  }

  /**
   * 绘制白板
   * @param x 左上角 X
   * @param y 左上角 Y
   */
  private drawWhiteboard(x: number, y: number): void {
    const gfx = new Graphics()

    // 白板阴影
    gfx.rect(x + 2, y + 2, 28, 40)
    gfx.fill({ color: 0x000000, alpha: 0.1 })

    // 白板边框
    gfx.rect(x - 1, y - 1, 30, 42)
    gfx.fill({ color: 0x888888 })

    // 白板面
    gfx.rect(x, y, 28, 40)
    gfx.fill({ color: 0xeeeeee })

    // 白板内容装饰线条
    gfx.rect(x + 4, y + 8, 18, 1)
    gfx.fill({ color: 0x3366cc })
    gfx.rect(x + 4, y + 14, 14, 1)
    gfx.fill({ color: 0x3366cc })
    gfx.rect(x + 4, y + 20, 16, 1)
    gfx.fill({ color: 0x3366cc })
    gfx.rect(x + 4, y + 26, 10, 1)
    gfx.fill({ color: 0xcc3333 })

    // 白板底部笔槽
    gfx.rect(x + 2, y + 38, 24, 3)
    gfx.fill({ color: 0xaaaaaa })

    this.container.addChild(gfx)
  }

  /**
   * 绘制 Bug 角落警告装饰
   * @param bug Bug 区域配置
   */
  private drawBugWarning(bug: ZoneConfig): void {
    const gfx = new Graphics()

    // 警告三角标识
    const wx = bug.x + bug.width / 2                                      // 中心 X
    const wy = bug.y + 50                                                 // Y 位置
    gfx.moveTo(wx, wy - 16)                                              // 三角顶部
    gfx.lineTo(wx + 16, wy + 10)                                         // 右下
    gfx.lineTo(wx - 16, wy + 10)                                         // 左下
    gfx.closePath()
    gfx.fill({ color: 0xffaa00 })                                        // 橙黄色

    // 三角内部（黑色底）
    gfx.moveTo(wx, wy - 10)
    gfx.lineTo(wx + 10, wy + 7)
    gfx.lineTo(wx - 10, wy + 7)
    gfx.closePath()
    gfx.fill({ color: 0x332200 })

    this.container.addChild(gfx)

    // 感叹号
    const excl = new Text({
      text: '!',
      style: { fontSize: 14, fill: 0xffaa00, fontWeight: 'bold', fontFamily: 'monospace' },
    })
    excl.anchor.set(0.5, 0.5)
    excl.position.set(wx, wy + 1)
    this.container.addChild(excl)

    // 烟雾效果（半透明圆）
    const smokeGfx = new Graphics()
    for (let i = 0; i < 4; i++) {
      smokeGfx.circle(bug.x + 40 + i * 40, bug.y + bug.height - 40, 8 + i * 4) // 递增大小
      smokeGfx.fill({ color: 0x888888, alpha: 0.1 + i * 0.04 })         // 递增不透明度
    }
    this.container.addChild(smokeGfx)
  }

  /**
   * 绘制区域标签文字
   * @param zones 区域配置字典
   */
  private drawZoneLabels(zones: Record<string, ZoneConfig>): void {
    for (const zone of Object.values(zones)) {
      const label = new Text({
        text: zone.label,
        style: {
          fontSize: 16,
          fill: COLORS.TEXT,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          dropShadow: {
            color: 0x000000,
            blur: 3,
            distance: 1,
            alpha: 0.5,
          },
        },
      })
      label.anchor.set(0.5, 0)                                           // 水平居中，顶部对齐
      label.position.set(
        zone.x + zone.width / 2,                                         // 区域水平中心
        zone.y + 8,                                                       // 区域顶部偏下 8px
      )
      this.container.addChild(label)
    }
  }
}

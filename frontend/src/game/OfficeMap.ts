/**
 * 办公室地图渲染器 - OfficeMap.ts
 *
 * 使用纯代码绘制像素风格的办公室地图，不依赖外部瓦片图：
 * - drawMap(): 根据配置绘制完整的办公室地图
 * - 绘制内容包括：地板格子、墙壁边框、功能区域底色、工位桌椅、区域标签
 *
 * 颜色方案（像素风深色主题）：
 *   地板背景 0x2d2d3f | 格子线 0x363650 | 墙壁 0x1a1a28
 *   休息区 0x1a3a1a | 工作区 0x1a1a3a | 会议区 0x3a2a1a | Bug角 0x3a1a1a
 *   桌子 0x8b6914 | 椅子 0x4a4a5a | 文字 0xaaaaaa
 *
 * 使用 PixiJS 8 API（Graphics.rect().fill() 而非旧版 beginFill）
 */
import { Container, Graphics, Text } from 'pixi.js'

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
  FLOOR_BG: 0x2d2d3f,       // 地板背景色（深蓝灰）
  FLOOR_GRID: 0x363650,     // 地板格子线颜色（稍亮）
  WALL: 0x1a1a28,           // 墙壁颜色（深色）
  DESK: 0x8b6914,           // 桌子颜色（木色）
  CHAIR: 0x4a4a5a,          // 椅子颜色（灰色）
  TEXT: 0xaaaaaa,            // 文字颜色（浅灰）
  ZONE_REST: 0x1a3a1a,      // 休息区底色（深绿色）
  ZONE_WORK: 0x1a1a3a,      // 工作区底色（深蓝色）
  ZONE_MEETING: 0x3a2a1a,   // 会议区底色（深橙色）
  ZONE_BUG: 0x3a1a1a,       // Bug 角落底色（深红色）
} as const

/** 区域类型与颜色映射 */
const ZONE_COLOR_MAP: Record<string, number> = {
  'rest': COLORS.ZONE_REST,         // 休息区 -> 深绿
  'work': COLORS.ZONE_WORK,         // 工作区 -> 深蓝
  'meeting': COLORS.ZONE_MEETING,   // 会议区 -> 深橙
  'bug': COLORS.ZONE_BUG,           // Bug角 -> 深红
}

export class OfficeMap {
  container: Container // 地图根容器

  constructor() {
    this.container = new Container()   // 创建根容器
    this.container.label = 'office-map' // 设置标签
  }

  /**
   * 绘制完整的办公室地图
   * @param zones 功能区域配置（key 为区域类型）
   * @param desks 工位配置数组
   * @param mapWidth 地图总宽度（像素）
   * @param mapHeight 地图总高度（像素）
   */
  drawMap(zones: Record<string, ZoneConfig>, desks: DeskConfig[], mapWidth: number, mapHeight: number): void {
    this.container.removeChildren()    // 先清空旧内容

    this.drawFloor(mapWidth, mapHeight)     // 第一层：绘制地板背景和格子
    this.drawWalls(mapWidth, mapHeight)     // 第二层：绘制墙壁边框
    this.drawZones(zones)                   // 第三层：绘制功能区域底色
    this.drawDesks(desks)                   // 第四层：绘制工位桌椅
    this.drawDecorations(zones)             // 第五层：绘制装饰物（沙发/绿植/饮水机/会议桌）
    this.drawZoneLabels(zones)              // 第六层：绘制区域标签文字

    console.log(`[OfficeMap] 地图绘制完成 ${mapWidth}x${mapHeight}，区域数=${Object.keys(zones).length}，工位数=${desks.length}`)
  }

  /**
   * 绘制地板背景和格子参考线
   * @param mapWidth 地图宽度
   * @param mapHeight 地图高度
   */
  private drawFloor(mapWidth: number, mapHeight: number): void {
    const floor = new Graphics()

    // 绘制地板背景色
    floor.rect(0, 0, mapWidth, mapHeight)  // 覆盖整个地图
    floor.fill({ color: COLORS.FLOOR_BG }) // 填充深蓝灰

    this.container.addChild(floor)         // 添加到容器

    // 绘制格子参考线（每 32px 一格，与像素风格匹配）
    const gridSize = 32                    // 格子大小
    const grid = new Graphics()

    // 垂直线
    for (let x = 0; x <= mapWidth; x += gridSize) {
      grid.rect(x, 0, 1, mapHeight)       // 1px 宽的竖线
    }
    // 水平线
    for (let y = 0; y <= mapHeight; y += gridSize) {
      grid.rect(0, y, mapWidth, 1)         // 1px 高的横线
    }
    grid.fill({ color: COLORS.FLOOR_GRID, alpha: 0.3 }) // 半透明格子线

    this.container.addChild(grid)          // 添加到容器
  }

  /**
   * 绘制墙壁边框
   * @param mapWidth 地图宽度
   * @param mapHeight 地图高度
   */
  private drawWalls(mapWidth: number, mapHeight: number): void {
    const wallThickness = 8                // 墙壁厚度
    const walls = new Graphics()

    // 上墙
    walls.rect(0, 0, mapWidth, wallThickness)
    // 下墙
    walls.rect(0, mapHeight - wallThickness, mapWidth, wallThickness)
    // 左墙
    walls.rect(0, 0, wallThickness, mapHeight)
    // 右墙
    walls.rect(mapWidth - wallThickness, 0, wallThickness, mapHeight)

    walls.fill({ color: COLORS.WALL })     // 填充深色墙壁
    this.container.addChild(walls)         // 添加到容器
  }

  /**
   * 绘制功能区域半透明底色
   * @param zones 区域配置字典
   */
  private drawZones(zones: Record<string, ZoneConfig>): void {
    for (const [key, zone] of Object.entries(zones)) {
      const zoneGfx = new Graphics()
      zoneGfx.rect(zone.x, zone.y, zone.width, zone.height) // 区域矩形

      // 根据区域类型选择颜色，默认使用工作区颜色
      const color = ZONE_COLOR_MAP[key] ?? COLORS.ZONE_WORK
      zoneGfx.fill({ color, alpha: 0.4 }) // 半透明填充

      // 绘制区域边框虚线效果（用细线模拟）
      zoneGfx.rect(zone.x, zone.y, zone.width, 2)              // 上边框
      zoneGfx.rect(zone.x, zone.y + zone.height - 2, zone.width, 2) // 下边框
      zoneGfx.rect(zone.x, zone.y, 2, zone.height)              // 左边框
      zoneGfx.rect(zone.x + zone.width - 2, zone.y, 2, zone.height) // 右边框
      zoneGfx.fill({ color, alpha: 0.6 }) // 边框略不透明

      this.container.addChild(zoneGfx)    // 添加到容器
    }
  }

  /**
   * 绘制工位（桌子 + 椅子 + 小显示器）
   * @param desks 工位配置数组
   */
  private drawDesks(desks: DeskConfig[]): void {
    for (const desk of desks) {
      const deskGfx = new Graphics()

      // 绘制桌子（主体矩形）
      deskGfx.rect(desk.x, desk.y, desk.width, desk.height)  // 桌面
      deskGfx.fill({ color: COLORS.DESK })                    // 木色填充

      // 桌子高亮边
      deskGfx.rect(desk.x, desk.y, desk.width, 1)             // 上高亮边
      deskGfx.fill({ color: 0xa07818 })                        // 稍亮木色

      this.container.addChild(deskGfx)

      // 小显示器（桌子上方中间的小方块）
      const monW = 10, monH = 8                                // 显示器尺寸
      const monX = desk.x + (desk.width - monW) / 2           // 居中
      const monY = desk.y + 3                                  // 桌面上方
      const monGfx = new Graphics()
      monGfx.rect(monX, monY, monW, monH)                     // 屏幕
      monGfx.fill({ color: 0x4488aa })                         // 蓝灰屏幕色
      monGfx.rect(monX + monW / 2 - 2, monY + monH, 4, 3)    // 支架
      monGfx.fill({ color: 0x555555 })
      this.container.addChild(monGfx)

      // 椅子（桌子下方的小圆角矩形）
      const chairGfx = new Graphics()
      const chairW = 16, chairH = 8                            // 椅子尺寸
      const chairX = desk.x + (desk.width - chairW) / 2       // 居中
      const chairY = desk.y + desk.height + 4                  // 桌下 4px
      chairGfx.roundRect(chairX, chairY, chairW, chairH, 2)   // 圆角椅子
      chairGfx.fill({ color: COLORS.CHAIR })
      this.container.addChild(chairGfx)
    }
  }

  /**
   * 绘制装饰物：休息区沙发/绿植/饮水机，会议区圆桌，Bug 角落警告标识
   * @param zones 区域配置字典
   */
  private drawDecorations(zones: Record<string, ZoneConfig>): void {
    const gfx = new Graphics()

    // ── 休息区装饰 ──
    const rest = zones['rest']
    if (rest) {
      // 沙发（L 形，左下角）
      const sofaX = rest.x + 20, sofaY = rest.y + rest.height - 70
      gfx.roundRect(sofaX, sofaY, 60, 20, 3)                  // 沙发靠背
      gfx.fill({ color: 0x6b4c3b })
      gfx.roundRect(sofaX, sofaY + 20, 60, 16, 3)             // 沙发坐垫
      gfx.fill({ color: 0x8b6c5b })
      gfx.roundRect(sofaX, sofaY + 4, 8, 32, 2)               // 左扶手
      gfx.fill({ color: 0x5b3c2b })

      // 绿植 1（休息区右上角）
      const p1x = rest.x + rest.width - 40, p1y = rest.y + 40
      gfx.circle(p1x, p1y, 10)                                // 树冠
      gfx.circle(p1x - 6, p1y + 4, 7)
      gfx.circle(p1x + 6, p1y + 4, 7)
      gfx.fill({ color: 0x2d8b46 })
      gfx.rect(p1x - 2, p1y + 8, 4, 10)                      // 花盆
      gfx.fill({ color: 0x8b6914 })

      // 饮水机（休息区右侧中间）
      const dwX = rest.x + rest.width - 35, dwY = rest.y + rest.height / 2 - 10
      gfx.rect(dwX, dwY, 16, 24)                              // 机身
      gfx.fill({ color: 0xcccccc })
      gfx.rect(dwX + 2, dwY + 2, 12, 8)                      // 水桶
      gfx.fill({ color: 0x88bbdd })
      gfx.rect(dwX + 4, dwY + 24, 8, 4)                      // 底座
      gfx.fill({ color: 0x999999 })

      // 绿植 2（沙发旁边）
      const p2x = sofaX + 80, p2y = sofaY + 10
      gfx.circle(p2x, p2y - 6, 6)
      gfx.circle(p2x - 4, p2y - 2, 5)
      gfx.circle(p2x + 4, p2y - 2, 5)
      gfx.fill({ color: 0x3ca85a })
      gfx.rect(p2x - 3, p2y + 2, 6, 8)
      gfx.fill({ color: 0x8b6914 })
    }

    // ── 会议区装饰 ──
    const meeting = zones['meeting']
    if (meeting) {
      // 会议圆桌
      const cx = meeting.x + meeting.width / 2
      const cy = meeting.y + meeting.height / 2 + 10
      gfx.circle(cx, cy, 30)                                   // 圆桌面
      gfx.fill({ color: 0x6b5030 })
      gfx.circle(cx, cy, 26)                                   // 桌面高光
      gfx.fill({ color: 0x7b6040 })

      // 会议椅（围绕圆桌 6 把）
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2
        const chairX = cx + Math.cos(angle) * 44
        const chairY = cy + Math.sin(angle) * 44
        gfx.circle(chairX, chairY, 6)                          // 小圆椅
        gfx.fill({ color: 0x4a4a5a })
      }

      // 白板（会议区右侧墙边）
      const wbX = meeting.x + meeting.width - 40, wbY = meeting.y + 40
      gfx.rect(wbX, wbY, 28, 40)                               // 白板
      gfx.fill({ color: 0xeeeeee })
      gfx.rect(wbX + 1, wbY + 1, 26, 38)                      // 白板边框
      gfx.stroke({ color: 0x888888, width: 1 })
      // 白板上的内容（装饰线条）
      gfx.rect(wbX + 4, wbY + 8, 18, 1)
      gfx.rect(wbX + 4, wbY + 14, 14, 1)
      gfx.rect(wbX + 4, wbY + 20, 16, 1)
      gfx.fill({ color: 0x3366cc })
    }

    // ── Bug 角落装饰 ──
    const bug = zones['bug']
    if (bug) {
      // 警告三角标识
      const wx = bug.x + bug.width / 2, wy = bug.y + 50
      gfx.moveTo(wx, wy - 14)
      gfx.lineTo(wx + 14, wy + 10)
      gfx.lineTo(wx - 14, wy + 10)
      gfx.closePath()
      gfx.fill({ color: 0xffaa00 })

      // 感叹号
      const excl = new Text({
        text: '!',
        style: { fontSize: 14, fill: 0x333333, fontWeight: 'bold', fontFamily: 'monospace' },
      })
      excl.anchor.set(0.5, 0.5)
      excl.position.set(wx, wy + 1)
      this.container.addChild(excl)

      // 烟雾效果（几个半透明圆）
      for (let i = 0; i < 3; i++) {
        gfx.circle(bug.x + 40 + i * 30, bug.y + bug.height - 40, 8 + i * 3)
        gfx.fill({ color: 0x888888, alpha: 0.15 + i * 0.05 })
      }
    }

    this.container.addChild(gfx)
  }

  /**
   * 绘制区域标签文字
   * @param zones 区域配置字典
   */
  private drawZoneLabels(zones: Record<string, ZoneConfig>): void {
    for (const zone of Object.values(zones)) {
      const label = new Text({
        text: zone.label,                                      // 区域中文名称
        style: {
          fontSize: 16,                                        // 标签字号
          fill: COLORS.TEXT,                                   // 浅灰色
          fontFamily: 'sans-serif',                            // 无衬线字体
          fontWeight: 'bold',                                  // 加粗
        },
      })
      label.anchor.set(0.5, 0)                                 // 水平居中，顶部对齐
      label.position.set(
        zone.x + zone.width / 2,                               // 区域水平中心
        zone.y + 8,                                            // 区域顶部偏下 8px
      )
      this.container.addChild(label)                           // 添加到容器
    }
  }
}

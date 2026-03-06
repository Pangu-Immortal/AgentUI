/**
 * 宠物精灵类 - PetSprite.ts
 *
 * 使用 PixiJS Graphics 纯代码绘制三种宠物，无需外部图片素材：
 * - 猫：椭圆身体 + 三角耳朵 + 弯曲尾巴
 * - 狗：圆角矩形身体 + 圆耳朵 + 舌头
 * - 植物：圆形树冠 + 矩形花盆（固定不动）
 *
 * 宠物沿固定路线行走（waypoints 数组循环），速度慢，沿地图边缘巡回。
 * 植物类型固定不动。
 *
 * 函数列表：
 *   constructor() - 创建宠物精灵，绘制外观
 *   update() - 每帧更新：沿 waypoints 移动 + 弹跳动画
 *   destroy() - 销毁并释放资源
 */
import { Container, Graphics } from 'pixi.js'

/** 宠物类型枚举 */
const PET_TYPES = ['cat', 'dog', 'plant'] as const                       // 猫、狗、植物
type PetType = typeof PET_TYPES[number]

/** 宠物颜色方案 */
const PET_COLORS: Record<PetType, { body: number; accent: number; detail: number }> = {
  cat:   { body: 0xff9944, accent: 0xffcc88, detail: 0x222222 },         // 橘猫配色
  dog:   { body: 0x8b6914, accent: 0xcc9944, detail: 0xff4466 },         // 棕狗配色（舌头红色）
  plant: { body: 0x2d8b46, accent: 0x3ca85a, detail: 0x8b6914 },         // 绿植配色（花盆棕色）
}

const ROAM_SPEED = 0.6            // 漫游移动速度（像素/帧）
const BOUNCE_SPEED = 0.08         // 弹跳动画速度
const BOUNCE_HEIGHT = 3           // 弹跳高度（像素）

export class PetSprite {
  container: Container                       // 宠物根容器

  private petType: PetType                   // 宠物类型
  private petName: string                    // 宠物名称
  private bodyGfx: Container                 // 身体图形容器
  private waypoints: { x: number; y: number }[] = [] // 巡回路径点
  private waypointIndex = 0                  // 当前路径点索引
  private isMoving: boolean                  // 是否正在移动
  private bounceTime = 0                     // 弹跳动画计时器

  /**
   * 创建宠物精灵
   * @param typeIndex 宠物类型索引（0=猫, 1=狗, 2=植物）
   * @param x 初始 X 坐标
   * @param y 初始 Y 坐标
   * @param mapWidth 地图宽度（用于生成巡回路径）
   * @param mapHeight 地图高度（用于生成巡回路径）
   */
  constructor(typeIndex: number, x: number, y: number, mapWidth: number, mapHeight: number) {
    this.petType = PET_TYPES[typeIndex % PET_TYPES.length] ?? 'cat'       // 选择宠物类型
    this.petName = this.petType === 'cat' ? '小橘' : this.petType === 'dog' ? '旺财' : '绿萝' // 中文名

    this.container = new Container()
    this.container.label = `pet-${this.petName}`                          // 调试标签
    this.container.position.set(x, y)                                     // 初始位置

    // 绘制宠物外观
    this.bodyGfx = new Container()
    this.container.addChild(this.bodyGfx)
    this.drawPet()                                                        // 根据类型绘制

    // 生成巡回路径（沿地图边缘的矩形路线）
    if (this.petType !== 'plant') {
      const margin = 60                                                   // 距离边缘的安全距离
      const offsetX = typeIndex * 80                                      // 不同宠物路径错开
      const offsetY = typeIndex * 50
      this.waypoints = [
        { x: margin + offsetX, y: margin + offsetY },                     // 左上
        { x: mapWidth - margin - offsetX, y: margin + offsetY },          // 右上
        { x: mapWidth - margin - offsetX, y: mapHeight - margin - offsetY }, // 右下
        { x: margin + offsetX, y: mapHeight - margin - offsetY },         // 左下
      ]
      this.waypointIndex = 0                                              // 从第一个点开始
      this.isMoving = true                                                // 动物型宠物开始移动
    } else {
      this.isMoving = false                                               // 植物不移动
    }

    console.log(`[PetSprite] 创建 ${this.petName}(${this.petType}) 位置=(${x},${y})`)
  }

  /** 根据宠物类型绘制外观 */
  private drawPet(): void {
    const colors = PET_COLORS[this.petType]!                              // 获取配色方案

    switch (this.petType) {
      case 'cat':
        this.drawCat(colors)                                              // 绘制猫
        break
      case 'dog':
        this.drawDog(colors)                                              // 绘制狗
        break
      case 'plant':
        this.drawPlant(colors)                                            // 绘制植物
        break
    }
  }

  /**
   * 绘制猫：椭圆身体 + 三角耳朵 + 尾巴
   * @param colors 配色方案
   */
  private drawCat(colors: { body: number; accent: number; detail: number }): void {
    const gfx = new Graphics()

    // 阴影
    gfx.ellipse(0, 2, 12, 3)                                             // 脚底椭圆阴影
    gfx.fill({ color: 0x000000, alpha: 0.2 })

    // 尾巴（弯曲的条状，用多个小圆模拟）
    gfx.circle(14, -8, 3)                                                 // 尾巴尖端
    gfx.circle(12, -5, 3)                                                 // 尾巴中段
    gfx.circle(10, -2, 3)                                                 // 尾巴根部
    gfx.fill({ color: colors.body })

    // 身体（椭圆）
    gfx.ellipse(0, -6, 12, 8)                                            // 横向椭圆身体
    gfx.fill({ color: colors.body })

    // 身体高光
    gfx.ellipse(-2, -8, 6, 4)                                            // 左上方高光
    gfx.fill({ color: colors.accent, alpha: 0.5 })

    // 头部（圆形，偏左上）
    gfx.circle(-6, -16, 8)                                               // 猫头
    gfx.fill({ color: colors.body })

    // 左耳（三角形）
    gfx.moveTo(-12, -22)                                                  // 耳尖
    gfx.lineTo(-14, -16)                                                  // 耳底左
    gfx.lineTo(-8, -18)                                                   // 耳底右
    gfx.closePath()
    gfx.fill({ color: colors.body })

    // 右耳（三角形）
    gfx.moveTo(0, -22)                                                    // 耳尖
    gfx.lineTo(-2, -16)                                                   // 耳底左
    gfx.lineTo(4, -18)                                                    // 耳底右
    gfx.closePath()
    gfx.fill({ color: colors.body })

    // 内耳粉色
    gfx.moveTo(-11, -21)
    gfx.lineTo(-13, -17)
    gfx.lineTo(-9, -18)
    gfx.closePath()
    gfx.fill({ color: 0xffaaaa })

    gfx.moveTo(-1, -21)
    gfx.lineTo(-1, -17)
    gfx.lineTo(3, -18)
    gfx.closePath()
    gfx.fill({ color: 0xffaaaa })

    // 眼睛
    gfx.circle(-9, -16, 2.5)                                             // 左眼白
    gfx.circle(-3, -16, 2.5)                                             // 右眼白
    gfx.fill({ color: 0xffffff })
    gfx.circle(-8, -16, 1.5)                                             // 左瞳孔
    gfx.circle(-2, -16, 1.5)                                             // 右瞳孔
    gfx.fill({ color: colors.detail })

    // 鼻子（小三角）
    gfx.circle(-6, -13, 1)                                               // 小粉鼻
    gfx.fill({ color: 0xff8888 })

    this.bodyGfx.addChild(gfx)
  }

  /**
   * 绘制狗：圆角矩形身体 + 圆耳朵 + 舌头
   * @param colors 配色方案
   */
  private drawDog(colors: { body: number; accent: number; detail: number }): void {
    const gfx = new Graphics()

    // 阴影
    gfx.ellipse(0, 2, 12, 3)                                             // 脚底椭圆阴影
    gfx.fill({ color: 0x000000, alpha: 0.2 })

    // 尾巴（短粗）
    gfx.roundRect(12, -10, 6, 4, 2)                                      // 短尾巴
    gfx.fill({ color: colors.body })

    // 身体（圆角矩形）
    gfx.roundRect(-12, -14, 24, 16, 6)                                   // 圆角矩形身体
    gfx.fill({ color: colors.body })

    // 身体高光
    gfx.roundRect(-8, -12, 8, 6, 3)                                      // 左上方高光
    gfx.fill({ color: colors.accent, alpha: 0.4 })

    // 腿（四条小矩形）
    gfx.roundRect(-10, 0, 5, 4, 1)                                       // 左前腿
    gfx.roundRect(5, 0, 5, 4, 1)                                         // 右前腿
    gfx.fill({ color: colors.body })

    // 头部（圆形）
    gfx.circle(-4, -20, 9)                                               // 狗头
    gfx.fill({ color: colors.body })

    // 圆耳朵（下垂的）
    gfx.circle(-12, -22, 5)                                              // 左耳
    gfx.circle(4, -22, 5)                                                // 右耳
    gfx.fill({ color: colors.accent })

    // 面部白色区域
    gfx.ellipse(-4, -17, 5, 4)                                           // 白色口鼻区
    gfx.fill({ color: 0xffeedd })

    // 眼睛
    gfx.circle(-7, -21, 2.5)                                             // 左眼白
    gfx.circle(-1, -21, 2.5)                                             // 右眼白
    gfx.fill({ color: 0xffffff })
    gfx.circle(-6, -21, 1.5)                                             // 左瞳孔
    gfx.circle(0, -21, 1.5)                                              // 右瞳孔
    gfx.fill({ color: colors.detail === 0xff4466 ? 0x222222 : colors.detail }) // 黑色瞳孔

    // 鼻子
    gfx.circle(-4, -18, 2)                                               // 黑鼻子
    gfx.fill({ color: 0x222222 })

    // 舌头（伸出嘴巴的粉色小条）
    gfx.roundRect(-5, -15, 4, 5, 2)                                      // 粉色舌头
    gfx.fill({ color: colors.detail })

    this.bodyGfx.addChild(gfx)
  }

  /**
   * 绘制植物：圆形树冠 + 矩形花盆
   * @param colors 配色方案
   */
  private drawPlant(colors: { body: number; accent: number; detail: number }): void {
    const gfx = new Graphics()

    // 花盆阴影
    gfx.ellipse(0, 2, 10, 3)                                             // 底部椭圆阴影
    gfx.fill({ color: 0x000000, alpha: 0.15 })

    // 花盆（梯形效果用矩形模拟）
    gfx.rect(-8, -8, 16, 10)                                             // 花盆主体
    gfx.fill({ color: colors.detail })
    // 花盆口沿
    gfx.rect(-10, -10, 20, 4)                                            // 盆口稍宽
    gfx.fill({ color: 0xa07818 })

    // 土壤
    gfx.rect(-7, -10, 14, 2)                                             // 深色土壤
    gfx.fill({ color: 0x4a3210 })

    // 树冠（多个重叠圆形，产生蓬松感）
    gfx.circle(0, -22, 10)                                               // 中心大圆
    gfx.fill({ color: colors.body })
    gfx.circle(-7, -18, 7)                                               // 左下
    gfx.fill({ color: colors.body })
    gfx.circle(7, -18, 7)                                                // 右下
    gfx.fill({ color: colors.body })
    gfx.circle(-4, -26, 6)                                               // 左上
    gfx.fill({ color: colors.accent })
    gfx.circle(5, -24, 6)                                                // 右上
    gfx.fill({ color: colors.accent })

    // 树干
    gfx.rect(-2, -14, 4, 6)                                              // 短树干
    gfx.fill({ color: 0x6b4c3b })

    this.bodyGfx.addChild(gfx)
  }

  /**
   * 每帧更新：沿 waypoints 循环移动 + 弹跳动画
   * @param delta 帧间隔系数
   */
  update(delta: number): void {
    if (!this.isMoving || this.waypoints.length === 0) return             // 植物或无路径不更新

    const target = this.waypoints[this.waypointIndex]!                    // 当前目标路径点
    const dx = target.x - this.container.x                                // 水平差值
    const dy = target.y - this.container.y                                // 垂直差值
    const dist = Math.sqrt(dx * dx + dy * dy)                            // 距离

    if (dist > 5) {
      // 朝目标方向移动
      const speed = ROAM_SPEED * delta                                    // 帧速度
      const nx = dx / dist                                                // X 方向单位向量
      const ny = dy / dist                                                // Y 方向单位向量
      this.container.x += nx * speed                                      // 更新 X
      this.container.y += ny * speed                                      // 更新 Y

      // 弹跳动画（上下跳跃感）
      this.bounceTime += BOUNCE_SPEED * delta                             // 递增弹跳计时
      this.bodyGfx.y = -Math.abs(Math.sin(this.bounceTime)) * BOUNCE_HEIGHT // Y 偏移模拟弹跳

      // 移动方向翻转精灵
      this.bodyGfx.scale.x = dx < 0 ? -1 : 1                            // 朝左时水平翻转
    } else {
      // 到达当前路径点，切换到下一个
      this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length // 循环到下一个点
      this.bodyGfx.y = 0                                                  // 重置弹跳偏移
    }
  }

  /** 销毁宠物精灵 */
  destroy(): void {
    this.container.destroy({ children: true })                            // 销毁容器及子对象
    console.log(`[PetSprite] ${this.petName} 已销毁`)
  }
}

/**
 * 宠物精灵类 - PetSprite.ts
 *
 * 使用 Kenney Tiny Dungeon Pack (CC0) 的史莱姆精灵：
 * - 16x16 原始尺寸，渲染时放大 TILE_SCALE 倍
 * - 宠物在地图上自由漫游，随机选择目标点移动
 * - 到达目标点后停留一段时间再选择新目标
 * - 支持弹跳动画模拟跳跃移动
 *
 * 素材来源：https://kenney.nl/assets/tiny-dungeon (CC0)
 */
import { Container, Sprite, Texture } from 'pixi.js'
import { getTile } from './AssetLoader'
import { DUNGEON_TILES, TILE_SCALE } from './TileConfig'

/** 宠物类型配置 */
const PET_TYPES = [
  { tile: DUNGEON_TILES.slime_green, name: '绿史莱姆' },  // 绿色史莱姆
  { tile: DUNGEON_TILES.slime_red, name: '红史莱姆' },    // 红色史莱姆
  { tile: DUNGEON_TILES.ghost, name: '幽灵' },            // 幽灵
] as const

const ROAM_SPEED = 0.8         // 漫游移动速度（像素/帧）
const IDLE_FRAMES = 120        // 停留帧数（约 2 秒）
const BOUNCE_SPEED = 0.08      // 弹跳动画速度
const BOUNCE_HEIGHT = 3        // 弹跳高度（像素）

export class PetSprite {
  container: Container

  private sprite: Sprite              // 宠物精灵纹理
  private targetX: number             // 漫游目标 X
  private targetY: number             // 漫游目标 Y
  private idleTimer = 0               // 停留计时器
  private isMoving = false            // 是否正在移动
  private bounceTime = 0              // 弹跳动画计时器
  private mapWidth: number            // 地图宽度限制
  private mapHeight: number           // 地图高度限制
  private petName: string             // 宠物名称

  /**
   * 创建宠物精灵
   * @param typeIndex 宠物类型索引（0=绿史莱姆, 1=红史莱姆, 2=幽灵）
   * @param x 初始 X 坐标
   * @param y 初始 Y 坐标
   * @param mapWidth 地图宽度（限制漫游范围）
   * @param mapHeight 地图高度（限制漫游范围）
   */
  constructor(typeIndex: number, x: number, y: number, mapWidth: number, mapHeight: number) {
    this.mapWidth = mapWidth                                      // 缓存地图宽度
    this.mapHeight = mapHeight                                    // 缓存地图高度
    this.targetX = x                                              // 初始目标 = 当前位置
    this.targetY = y

    const petType = PET_TYPES[typeIndex % PET_TYPES.length] ?? PET_TYPES[0]! // 选择宠物类型
    this.petName = petType.name

    this.container = new Container()
    this.container.label = `pet-${this.petName}`
    this.container.position.set(x, y)

    // 加载宠物精灵纹理
    const texture = getTile('dungeon', petType!.tile)             // 从 Dungeon Pack 获取纹理
    this.sprite = new Sprite(texture !== Texture.EMPTY ? texture : Texture.WHITE)
    this.sprite.anchor.set(0.5, 1)                                // 底部中心锚点
    this.sprite.scale.set(TILE_SCALE * 0.8)                       // 比角色稍小（80%）
    this.container.addChild(this.sprite)

    // 初始化时随机一个漫游目标
    this.pickNewTarget()

    console.log(`[PetSprite] 创建 ${this.petName} 位置=(${x},${y})`)
  }

  /** 随机选择新的漫游目标点（在地图范围内） */
  private pickNewTarget(): void {
    const margin = 80                                             // 距离地图边缘的安全距离
    this.targetX = margin + Math.random() * (this.mapWidth - margin * 2)   // 随机 X
    this.targetY = margin + Math.random() * (this.mapHeight - margin * 2)  // 随机 Y
    this.isMoving = true                                          // 开始移动
    this.idleTimer = 0                                            // 重置停留计时
  }

  /** 每帧更新：移动 + 弹跳动画 */
  update(delta: number): void {
    if (this.isMoving) {
      // 计算到目标的距离
      const dx = this.targetX - this.container.x                  // 水平差
      const dy = this.targetY - this.container.y                  // 垂直差
      const dist = Math.sqrt(dx * dx + dy * dy)                  // 欧几里得距离

      if (dist > 5) {
        // 朝目标方向移动
        const speed = ROAM_SPEED * delta                          // 帧速度
        const nx = dx / dist, ny = dy / dist                      // 方向单位向量
        this.container.x += nx * speed                            // 更新 X
        this.container.y += ny * speed                            // 更新 Y

        // 弹跳动画（上下跳跃感）
        this.bounceTime += BOUNCE_SPEED * delta                   // 递增弹跳计时
        this.sprite.y = -Math.abs(Math.sin(this.bounceTime)) * BOUNCE_HEIGHT // Y 偏移模拟弹跳

        // 移动方向翻转精灵
        this.sprite.scale.x = dx < 0                              // 朝左移动时翻转
          ? -Math.abs(this.sprite.scale.x)
          : Math.abs(this.sprite.scale.x)
      } else {
        // 到达目标，进入停留状态
        this.isMoving = false
        this.idleTimer = 0
        this.sprite.y = 0                                         // 重置弹跳偏移
      }
    } else {
      // 停留状态：计时后选择新目标
      this.idleTimer += delta
      if (this.idleTimer > IDLE_FRAMES) {
        this.pickNewTarget()                                      // 停留结束，选新目标
      }
    }
  }

  /** 销毁宠物精灵 */
  destroy(): void {
    this.container.destroy({ children: true })
    console.log(`[PetSprite] ${this.petName} 已销毁`)
  }
}
